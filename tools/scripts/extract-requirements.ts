/**
 * AST-based Requirement Extraction
 *
 * Parses TypeScript source files to extract high-level structures (functions,
 * classes, interfaces, types, constants), then sends each node in isolation
 * to a local LLM for requirement/spec description.
 *
 * Content-hashed for idempotency — unchanged nodes skip LLM calls on re-runs.
 *
 * Run: npm run ast:extract
 * Flags: --dry-run, --skip-llm, --llm-cmd <cmd>, --max-node-lines <n>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, ".ast-requirements");
const CACHE_PATH = path.join(OUTPUT_DIR, "cache.json");
const NODES_PATH = path.join(OUTPUT_DIR, "nodes.json");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface CliOptions {
  dryRun: boolean;
  skipLlm: boolean;
  llmCmd: string;
  maxNodeLines: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    skipLlm: false,
    llmCmd: "claude-local",
    maxNodeLines: 500,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--skip-llm") opts.skipLlm = true;
    else if (arg === "--llm-cmd" && argv[i + 1]) opts.llmCmd = argv[++i];
    else if (arg === "--max-node-lines" && argv[i + 1])
      opts.maxNodeLines = Number(argv[++i]);
  }
  return opts;
}

const opts = parseArgs(process.argv);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeKind = "function" | "class" | "interface" | "type" | "enum" | "const";

interface ExtractedNode {
  id: string;
  kind: NodeKind;
  name: string;
  filePath: string; // relative to project root
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  sourceHash: string;
  sourceText: string;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Phase 1: File discovery & AST extraction
// ---------------------------------------------------------------------------

function discoverFiles(srcDir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(srcDir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith(".ts")) continue;
    if (name.endsWith(".test.ts") || name.endsWith(".d.ts")) continue;
    const fullPath = path.join(entry.parentPath ?? entry.path, name);
    files.push(fullPath);
  }
  return files.sort();
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function nodeLines(sourceFile: ts.SourceFile, node: ts.Node): [number, number] {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return [start.line + 1, end.line + 1]; // 1-based
}

function hashSource(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function extractNodes(filePath: string): ExtractedNode[] {
  const sourceText = fs.readFileSync(filePath, "utf-8");
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const nodes: ExtractedNode[] = [];

  function addNode(kind: NodeKind, name: string, node: ts.Node, exported: boolean) {
    const text = node.getFullText(sourceFile).trimStart();
    const [lineStart, lineEnd] = nodeLines(sourceFile, node);
    nodes.push({
      id: `${relativePath}::${name}`,
      kind,
      name,
      filePath: relativePath,
      lineStart,
      lineEnd,
      exported,
      sourceHash: hashSource(text),
      sourceText: text,
      description: null,
    });
  }

  ts.forEachChild(sourceFile, (node) => {
    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      addNode("function", node.name.text, node, isExported(node));
      return;
    }

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      addNode("class", node.name.text, node, isExported(node));
      return;
    }

    // Interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      addNode("interface", node.name.text, node, isExported(node));
      return;
    }

    // Type alias declarations
    if (ts.isTypeAliasDeclaration(node)) {
      addNode("type", node.name.text, node, isExported(node));
      return;
    }

    // Enum declarations
    if (ts.isEnumDeclaration(node)) {
      addNode("enum", node.name.text, node, isExported(node));
      return;
    }

    // Variable statements — extract each const declarator separately
    if (ts.isVariableStatement(node)) {
      const decl = node.declarationList;
      if (decl.flags & ts.NodeFlags.Const) {
        const exported = isExported(node);
        for (const d of decl.declarations) {
          if (ts.isIdentifier(d.name)) {
            // Use the full VariableStatement text for single declarations,
            // or just the declarator text with export const prefix for multi.
            if (decl.declarations.length === 1) {
              addNode("const", d.name.text, node, exported);
            } else {
              // Multi-declaration: use declarator source
              const declText = d.getFullText(sourceFile).trimStart();
              const [lineStart, lineEnd] = nodeLines(sourceFile, d);
              nodes.push({
                id: `${relativePath}::${d.name.text}`,
                kind: "const",
                name: d.name.text,
                filePath: relativePath,
                lineStart,
                lineEnd,
                exported,
                sourceHash: hashSource(declText),
                sourceText: declText,
                description: null,
              });
            }
          }
        }
      }
      // Also handle let declarations at top level (module-scoped state)
      if (decl.flags & ts.NodeFlags.Let) {
        const exported = isExported(node);
        for (const d of decl.declarations) {
          if (ts.isIdentifier(d.name)) {
            addNode("const", d.name.text, node, exported); // kind "const" for simplicity
          }
        }
      }
      return;
    }

    // Skip re-exports, import declarations, etc.
  });

  return nodes;
}

// ---------------------------------------------------------------------------
// Phase 2: Cache
// ---------------------------------------------------------------------------

type Cache = Record<string, string>; // sourceHash -> description

function loadCache(): Cache {
  if (fs.existsSync(CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  }
  return {};
}

function saveCache(cache: Cache): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// ---------------------------------------------------------------------------
// Phase 3: LLM description
// ---------------------------------------------------------------------------

const PROMPT_TEMPLATE = `Describe the requirements and specifications for the following TypeScript code.
Only describe what this code does, its inputs, outputs, and constraints.
Do not speculate about the broader system.

<code>
{SOURCE}
</code>`;

function describeNode(sourceText: string, llmCmd: string): string | null {
  const prompt = PROMPT_TEMPLATE.replace("{SOURCE}", sourceText);
  try {
    const result = execSync(`${llmCmd} -p -`, {
      input: prompt,
      encoding: "utf-8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ LLM failed: ${msg.slice(0, 120)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 4: Main
// ---------------------------------------------------------------------------

function main() {
  console.log("AST Requirement Extraction");
  console.log("==========================");

  // Discover files
  const srcDir = path.join(PROJECT_ROOT, "src");
  const files = discoverFiles(srcDir);
  console.log(`Found ${files.length} TypeScript files in src/`);

  // Extract all nodes
  const allNodes: ExtractedNode[] = [];
  for (const file of files) {
    const nodes = extractNodes(file);
    allNodes.push(...nodes);
  }
  console.log(`Extracted ${allNodes.length} top-level nodes`);

  // Filter by max lines
  const filtered = allNodes.filter((n) => {
    const lines = n.lineEnd - n.lineStart + 1;
    if (lines > opts.maxNodeLines) {
      console.log(`  Skipping ${n.id} (${lines} lines > ${opts.maxNodeLines})`);
      return false;
    }
    return true;
  });
  if (filtered.length < allNodes.length) {
    console.log(`After filtering: ${filtered.length} nodes`);
  }

  // Load cache and determine what needs LLM processing
  const cache = loadCache();
  let cacheHits = 0;
  let newDescriptions = 0;
  let failures = 0;

  for (const node of filtered) {
    if (cache[node.sourceHash]) {
      node.description = cache[node.sourceHash];
      cacheHits++;
    }
  }

  const uncached = filtered.filter((n) => n.description === null);
  console.log(`Cache hits: ${cacheHits}, Uncached: ${uncached.length}`);

  if (opts.dryRun) {
    console.log("\n[DRY RUN] Would send to LLM:");
    for (const n of uncached) {
      console.log(`  ${n.id} (${n.kind}, ${n.lineEnd - n.lineStart + 1} lines)`);
    }
    console.log(`\nTotal: ${uncached.length} nodes would be processed`);
    // Still write the structural output without descriptions
    writeOutput(filtered);
    return;
  }

  if (!opts.skipLlm && uncached.length > 0) {
    console.log(`\nProcessing ${uncached.length} nodes with ${opts.llmCmd}...`);
    for (let i = 0; i < uncached.length; i++) {
      const node = uncached[i];
      const progress = `[${i + 1}/${uncached.length}]`;
      process.stdout.write(`${progress} ${node.id}...`);

      const description = describeNode(node.sourceText, opts.llmCmd);
      if (description) {
        node.description = description;
        cache[node.sourceHash] = description;
        newDescriptions++;
        console.log(" done");
      } else {
        failures++;
        console.log(" FAILED");
      }

      // Save cache after each node for crash resilience
      saveCache(cache);
    }
  }

  writeOutput(filtered);

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Total nodes: ${filtered.length}`);
  console.log(`Cache hits:  ${cacheHits}`);
  console.log(`New:         ${newDescriptions}`);
  console.log(`Failures:    ${failures}`);
  console.log(`Output:      ${NODES_PATH}`);
}

function writeOutput(nodes: ExtractedNode[]) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Count unique files
  const uniqueFiles = new Set(nodes.map((n) => n.filePath));

  const output = {
    generatedAt: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    totalNodes: nodes.length,
    totalFiles: uniqueFiles.size,
    nodes,
  };

  fs.writeFileSync(NODES_PATH, JSON.stringify(output, null, 2));
}

main();
