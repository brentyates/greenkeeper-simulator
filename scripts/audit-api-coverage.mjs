#!/usr/bin/env node
/**
 * Public API vs E2E Test Coverage Audit
 *
 * Extracts all window.game.* APIs from CLAUDE.md and checks
 * which ones are covered by E2E integration tests.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse CLAUDE.md for documented window.game APIs
function parseDocumentedAPIs() {
  const claudeMd = fs.readFileSync(path.join(rootDir, 'CLAUDE.md'), 'utf-8');
  const apis = new Set();

  // Extract window.game.* method calls from code examples
  const apiMatches = claudeMd.matchAll(/window\.game\.(\w+)\(/g);

  for (const match of apiMatches) {
    apis.add(match[1]);
  }

  return apis;
}

// Search E2E tests for API usage
function analyzeAPIUsageInTests() {
  const apiUsage = new Map();
  const testDir = path.join(rootDir, 'tests/integration');
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.spec.ts'));

  files.forEach(file => {
    const filePath = path.join(testDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Find all window.game.* calls
    const apiMatches = content.matchAll(/window\.game\.(\w+)\(/g);

    for (const match of apiMatches) {
      const apiName = match[1];
      if (!apiUsage.has(apiName)) {
        apiUsage.set(apiName, new Set());
      }
      apiUsage.get(apiName).add(file);
    }
  });

  return apiUsage;
}

// Search BabylonMain.ts for all public methods
function extractPublicAPIs() {
  const babylonMainPath = path.join(rootDir, 'src/babylon/BabylonMain.ts');
  const content = fs.readFileSync(babylonMainPath, 'utf-8');

  const publicMethods = new Set();

  // Match public method declarations
  const methodMatches = content.matchAll(/^\s*public\s+(\w+)\s*\(/gm);

  for (const match of methodMatches) {
    publicMethods.add(match[1]);
  }

  return publicMethods;
}

// Generate report
function generateReport() {
  console.log('='.repeat(80));
  console.log('PUBLIC API COVERAGE AUDIT');
  console.log('='.repeat(80));
  console.log();

  const documentedAPIs = parseDocumentedAPIs();
  const apiUsage = analyzeAPIUsageInTests();
  const publicAPIs = extractPublicAPIs();

  console.log('1. DOCUMENTED APIs (from CLAUDE.md examples)');
  console.log('-'.repeat(80));

  const sortedDocAPIs = Array.from(documentedAPIs).sort();
  sortedDocAPIs.forEach(api => {
    const usage = apiUsage.get(api);
    if (usage) {
      console.log(`✅ window.game.${api.padEnd(35)} ${usage.size.toString().padStart(2)} test files`);
    } else {
      console.log(`❌ window.game.${api.padEnd(35)} NOT TESTED`);
    }
  });

  console.log();
  console.log('2. UNDOCUMENTED APIs (used in tests but not in CLAUDE.md)');
  console.log('-'.repeat(80));

  let undocumentedCount = 0;
  const sortedUsedAPIs = Array.from(apiUsage.keys()).sort();
  sortedUsedAPIs.forEach(api => {
    if (!documentedAPIs.has(api)) {
      const usage = apiUsage.get(api);
      console.log(`⚠️  window.game.${api.padEnd(35)} ${usage.size.toString().padStart(2)} test files`);
      undocumentedCount++;
    }
  });

  if (undocumentedCount === 0) {
    console.log('   (none)');
  }

  console.log();
  console.log('3. PUBLIC APIs NOT TESTED');
  console.log('-'.repeat(80));

  let untestedCount = 0;
  const sortedPublicAPIs = Array.from(publicAPIs).sort();
  sortedPublicAPIs.forEach(api => {
    if (!apiUsage.has(api)) {
      console.log(`⚠️  ${api}`);
      untestedCount++;
    }
  });

  if (untestedCount === 0) {
    console.log('   ✅ All public APIs are covered by tests!');
  }

  console.log();
  console.log('4. API USAGE HEATMAP (most tested APIs)');
  console.log('-'.repeat(80));

  const sortedByUsage = Array.from(apiUsage.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 15);

  sortedByUsage.forEach(([api, files]) => {
    const bar = '█'.repeat(Math.min(files.size, 30));
    console.log(`   ${api.padEnd(35)} ${bar} ${files.size}`);
  });

  console.log();
  console.log('5. SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Total documented APIs:        ${documentedAPIs.size}`);
  console.log(`Total public APIs in code:    ${publicAPIs.size}`);
  console.log(`Total APIs used in tests:     ${apiUsage.size}`);
  console.log(`Undocumented but tested APIs: ${undocumentedCount}`);
  console.log(`Public APIs not tested:       ${untestedCount}`);

  const docCoverage = ((apiUsage.size / publicAPIs.size) * 100).toFixed(1);
  console.log(`Test coverage of public APIs: ${docCoverage}%`);

  console.log();
  console.log('='.repeat(80));
}

// Run the audit
generateReport();
