import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

function parseArgs(argv) {
  let maxStepsProvided = false;
  const config = {
    scenario: "tutorial_basics",
    strategy: "adaptive",
    url: "http://127.0.0.1:4175",
    targetDays: 5,
    maxSteps: 400,
    pollMs: 250,
    targetCrew: 2,
    speedUps: 4,
    maxIterations: 3,
    repairAgent: "claude",
    diagnoseTimeoutMs: 120000,
    repairTimeoutMs: 600000,
    model: "",
    headless: true,
    startDevServer: true,
    devCommand: "npm run dev -- --host 127.0.0.1 --port 4175",
    outputRoot: path.resolve(".agent-harness", "self-heal"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--scenario" && next) config.scenario = next;
    if (arg === "--strategy" && next) config.strategy = next;
    if (arg === "--url" && next) config.url = next;
    if (arg === "--target-days" && next) config.targetDays = Number(next);
    if (arg === "--max-steps" && next) {
      config.maxSteps = Number(next);
      maxStepsProvided = true;
    }
    if (arg === "--poll-ms" && next) config.pollMs = Number(next);
    if (arg === "--target-crew" && next) config.targetCrew = Number(next);
    if (arg === "--speed-ups" && next) config.speedUps = Number(next);
    if (arg === "--max-iterations" && next) config.maxIterations = Number(next);
    if (arg === "--repair-agent" && next) config.repairAgent = next;
    if (arg === "--diagnose-timeout-ms" && next) config.diagnoseTimeoutMs = Number(next);
    if (arg === "--repair-timeout-ms" && next) config.repairTimeoutMs = Number(next);
    if (arg === "--model" && next) config.model = next;
    if (arg === "--dev-command" && next) config.devCommand = next;
    if (arg === "--output-root" && next) config.outputRoot = path.resolve(next);
    if (arg === "--headed") config.headless = false;
    if (arg === "--no-dev-server") config.startDevServer = false;
  }

  if (!maxStepsProvided) {
    config.maxSteps = Math.max(config.maxSteps, config.targetDays * 360);
  }

  return config;
}

function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function mkdirp(target) {
  fs.mkdirSync(target, { recursive: true });
}

async function canReach(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function startDevServer(config, runDir) {
  if (!config.startDevServer) {
    return null;
  }
  if (await canReach(config.url)) {
    return { process: null, startedHere: false, logFile: null };
  }

  const logFile = path.join(runDir, "dev-server.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  const child = spawn(config.devCommand, {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await canReach(config.url)) {
      return { process: child, startedHere: true, logFile };
    }
    if (child.exitCode !== null) {
      throw new Error(`Dev server exited early. See ${logFile}`);
    }
    await delay(1000);
  }

  child.kill("SIGINT");
  throw new Error(`Timed out waiting for dev server at ${config.url}. See ${logFile}`);
}

function stopDevServer(serverHandle) {
  if (!serverHandle?.startedHere || !serverHandle.process) {
    return;
  }
  serverHandle.process.kill("SIGINT");
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
    });

    let stdout = "";
    let stderr = "";
    const stdoutStream = options.stdoutFile
      ? fs.createWriteStream(options.stdoutFile, { flags: "a" })
      : null;
    const stderrStream = options.stderrFile
      ? fs.createWriteStream(options.stderrFile, { flags: "a" })
      : null;
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutStream?.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      stderrStream?.write(text);
    });
    child.on("close", (code) => {
      stdoutStream?.end();
      stderrStream?.end();
      resolve({ code, stdout, stderr, timedOut });
    });

    let timeoutHandle = null;
    if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill("SIGKILL");
          }
        }, 5000);
      }, options.timeoutMs);
    }

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();

    child.on("close", () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    });
  });
}

async function runHarness(config, iterationDir) {
  const args = [
    "tools/playtests/player-playability.mjs",
    "--scenario",
    config.scenario,
    "--strategy",
    config.strategy,
    "--url",
    config.url,
    "--target-days",
    String(config.targetDays),
    "--max-steps",
    String(config.maxSteps),
    "--poll-ms",
    String(config.pollMs),
    "--target-crew",
    String(config.targetCrew),
    "--speed-ups",
    String(config.speedUps),
  ];
  if (!config.headless) {
    args.push("--headed");
  }

  const result = await runCommand("node", args);
  fs.writeFileSync(path.join(iterationDir, "harness.stdout.log"), result.stdout, "utf8");
  fs.writeFileSync(path.join(iterationDir, "harness.stderr.log"), result.stderr, "utf8");

  const trimmed = result.stdout.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart === -1) {
    throw new Error(`Harness did not emit JSON. See ${path.join(iterationDir, "harness.stdout.log")}`);
  }
  return JSON.parse(trimmed.slice(jsonStart));
}

function buildDiagnosePrompt(summary, config, packet) {
  return `Diagnose one failing player-playability surface in greenkeeper-simulator.

Read these files first:
- ${summary.repairDir}/repair-packet.json
- ${summary.reportFile}

Task:
1. Identify the single most likely root cause.
2. Identify the minimal file set that should change.
3. Propose the smallest coherent fix.

Do not edit files.
Do not rerun anything.
Do not inspect unrelated systems.

Return JSON only with this shape:
{
  "root_cause": "string",
  "category": "string",
  "files_to_change": ["absolute/path"],
  "fix_plan": ["step"],
  "confidence": 0.0
}`.trim();
}

function buildPatchPrompt(summary, config, diagnosis, packet) {
  const files = Array.isArray(diagnosis?.files_to_change) && diagnosis.files_to_change.length > 0
    ? diagnosis.files_to_change
    : [];

  return `Patch one failing player-playability surface in greenkeeper-simulator.

Source failure artifacts:
- ${summary.repairDir}/repair-packet.json
- ${summary.reportFile}

Diagnosis:
- Category: ${diagnosis?.category ?? packet?.focus?.category ?? "unknown"}
- Root cause: ${diagnosis?.root_cause ?? "not provided"}
- Confidence: ${diagnosis?.confidence ?? "n/a"}

${files.length > 0 ? `Files to inspect/change first:\n${files.map((file) => `- ${file}`).join("\n")}` : "Read the repair packet to determine which files to inspect."}

Planned fix:
${Array.isArray(diagnosis?.fix_plan) ? diagnosis.fix_plan.map((step) => `- ${step}`).join("\n") : "- Apply the smallest coherent fix for the diagnosed surface"}

Task:
1. Make the smallest coherent code change for this diagnosed surface only.
2. Rerun exactly once:
   node tools/playtests/player-playability.mjs --scenario ${config.scenario} --strategy ${config.strategy} --url ${config.url} --target-days ${config.targetDays} --max-steps ${config.maxSteps} --poll-ms ${config.pollMs} --target-crew ${config.targetCrew} --speed-ups ${config.speedUps}${config.headless ? "" : " --headed"}
3. Stop immediately after the rerun.
4. Write a concise final summary with:
   - root cause
   - files changed
   - rerun outcome

Rules:
- Prefer fixing the real player-facing UI path.
- If only the harness policy is wrong, keep the app unchanged.
- Do not broaden beyond this diagnosed surface.
- Do not do open-ended refactors.`.trim();
}

function parseJsonObject(text) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function getRepairSkipReason(summary) {
  const packetPath = summary?.repairDir ? path.join(summary.repairDir, "repair-packet.json") : null;
  if (!packetPath || !fs.existsSync(packetPath)) {
    return null;
  }

  try {
    const packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
    const category = packet?.focus?.category ?? "unknown";
    if (category === "run_budget_exhausted") {
      return "budget_exhausted";
    }
    if (category === "environment_unavailable") {
      return "environment_unavailable";
    }
    return null;
  } catch {
    return null;
  }
}

async function runRepairAgent(summary, config, iterationDir) {
  if (config.repairAgent === "none") {
    return {
      skipped: true,
      reason: "repair agent disabled",
    };
  }
  const skipReason = getRepairSkipReason(summary);
  if (skipReason) {
    return {
      skipped: true,
      reason: skipReason,
    };
  }
  if (!["codex", "claude"].includes(config.repairAgent)) {
    throw new Error(`Unsupported repair agent: ${config.repairAgent}. Expected "codex" or "claude".`);
  }

  const packetPath = path.join(summary.repairDir, "repair-packet.json");
  let packet = null;
  try {
    packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
  } catch {
    packet = null;
  }

  const agentBin = config.repairAgent;
  const commonArgs = config.repairAgent === "claude"
    ? [
        "--print",
        "--dangerously-skip-permissions",
        "--add-dir", process.cwd(),
      ]
    : [
        "exec",
        "--cd", process.cwd(),
        "--sandbox", "workspace-write",
        "-c", "approval_policy=\"never\"",
        "--skip-git-repo-check",
      ];
  if (config.model) {
    commonArgs.push("--model", config.model);
  }

  const diagnoseStdoutLog = path.join(iterationDir, "diagnose.stdout.log");
  const diagnoseStderrLog = path.join(iterationDir, "diagnose.stderr.log");
  const diagnoseLastMessageFile = path.join(iterationDir, "diagnose-last-message.txt");
  const diagnoseArgs = config.repairAgent === "claude"
    ? [...commonArgs, "--prompt", buildDiagnosePrompt(summary, config, packet)]
    : [...commonArgs, "-o", diagnoseLastMessageFile, "-"];
  const diagnosePrompt = buildDiagnosePrompt(summary, config, packet);
  const diagnoseResult = await runCommand(agentBin, diagnoseArgs, {
    stdin: config.repairAgent === "codex" ? diagnosePrompt : undefined,
    timeoutMs: config.diagnoseTimeoutMs,
    stdoutFile: diagnoseStdoutLog,
    stderrFile: diagnoseStderrLog,
  });
  const diagnoseText = fs.existsSync(diagnoseLastMessageFile)
    ? fs.readFileSync(diagnoseLastMessageFile, "utf8")
    : diagnoseResult.stdout;
  const diagnosis = parseJsonObject(diagnoseText);

  if (diagnoseResult.timedOut) {
    return {
      skipped: false,
      stage: "diagnose",
      exitCode: diagnoseResult.code,
      timedOut: true,
      stdoutLog: diagnoseStdoutLog,
      stderrLog: diagnoseStderrLog,
      lastMessageFile: diagnoseLastMessageFile,
      diagnosis: null,
    };
  }
  if (diagnoseResult.code !== 0 || !diagnosis) {
    return {
      skipped: false,
      stage: "diagnose",
      exitCode: diagnoseResult.code,
      timedOut: false,
      stdoutLog: diagnoseStdoutLog,
      stderrLog: diagnoseStderrLog,
      lastMessageFile: diagnoseLastMessageFile,
      diagnosis,
    };
  }

  const patchStdoutLog = path.join(iterationDir, "repair.stdout.log");
  const patchStderrLog = path.join(iterationDir, "repair.stderr.log");
  const patchLastMessageFile = path.join(iterationDir, "repair-last-message.txt");
  const patchPrompt = buildPatchPrompt(summary, config, diagnosis, packet);
  const patchArgs = config.repairAgent === "claude"
    ? [...commonArgs, "--prompt", patchPrompt]
    : [...commonArgs, "-o", patchLastMessageFile, "-"];
  const result = await runCommand(agentBin, patchArgs, {
    stdin: config.repairAgent === "codex" ? patchPrompt : undefined,
    timeoutMs: config.repairTimeoutMs,
    stdoutFile: patchStdoutLog,
    stderrFile: patchStderrLog,
  });
  return {
    skipped: false,
    stage: "patch",
    exitCode: result.code,
    timedOut: result.timedOut,
    stdoutLog: patchStdoutLog,
    stderrLog: patchStderrLog,
    lastMessageFile: patchLastMessageFile,
    diagnoseStdoutLog,
    diagnoseStderrLog,
    diagnoseLastMessageFile,
    diagnosis,
  };
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const runDir = path.join(config.outputRoot, `${stamp()}-${config.scenario}`);
  mkdirp(runDir);

  const summaryFile = path.join(runDir, "summary.json");
  const overall = {
    config,
    startedAt: new Date().toISOString(),
    iterations: [],
    result: null,
  };

  let serverHandle = null;

  try {
    serverHandle = await startDevServer(config, runDir);

    for (let iteration = 1; iteration <= config.maxIterations; iteration += 1) {
      const iterationDir = path.join(runDir, `iteration-${String(iteration).padStart(2, "0")}`);
      mkdirp(iterationDir);

      const harnessSummary = await runHarness(config, iterationDir);
      const iterationRecord = {
        iteration,
        harnessSummary,
        repair: null,
      };

      if (harnessSummary.result?.verdict === "passed") {
        overall.iterations.push(iterationRecord);
        overall.result = {
          verdict: "passed",
          iteration,
          artifactDir: runDir,
        };
        fs.writeFileSync(summaryFile, `${JSON.stringify(overall, null, 2)}\n`, "utf8");
        console.log(JSON.stringify(overall, null, 2));
        return;
      }

      const repairResult = await runRepairAgent(harnessSummary, config, iterationDir);
      iterationRecord.repair = repairResult;
      overall.iterations.push(iterationRecord);
      if (repairResult?.skipped && repairResult.reason === "budget_exhausted") {
        overall.result = {
          verdict: "failed",
          reason: "run_budget_exhausted",
          artifactDir: runDir,
          iteration,
        };
        fs.writeFileSync(summaryFile, `${JSON.stringify(overall, null, 2)}\n`, "utf8");
        console.log(JSON.stringify(overall, null, 2));
        process.exitCode = 1;
        return;
      }
      if (repairResult?.skipped && repairResult.reason === "environment_unavailable") {
        overall.result = {
          verdict: "failed",
          reason: "environment_unavailable",
          artifactDir: runDir,
          iteration,
        };
        fs.writeFileSync(summaryFile, `${JSON.stringify(overall, null, 2)}\n`, "utf8");
        console.log(JSON.stringify(overall, null, 2));
        process.exitCode = 1;
        return;
      }
      if (repairResult?.timedOut) {
        overall.result = {
          verdict: "failed",
          reason: "repair_agent_timeout",
          artifactDir: runDir,
          iteration,
        };
        fs.writeFileSync(summaryFile, `${JSON.stringify(overall, null, 2)}\n`, "utf8");
        console.log(JSON.stringify(overall, null, 2));
        process.exitCode = 1;
        return;
      }
      if (repairResult && repairResult.skipped === false && repairResult.exitCode !== 0) {
        overall.result = {
          verdict: "failed",
          reason: "repair_agent_failed",
          artifactDir: runDir,
          iteration,
        };
        fs.writeFileSync(summaryFile, `${JSON.stringify(overall, null, 2)}\n`, "utf8");
        console.log(JSON.stringify(overall, null, 2));
        process.exitCode = 1;
        return;
      }
      fs.writeFileSync(summaryFile, `${JSON.stringify(overall, null, 2)}\n`, "utf8");
    }

    overall.result = {
      verdict: "failed",
      reason: "max_iterations_exhausted",
      artifactDir: runDir,
    };
    fs.writeFileSync(summaryFile, `${JSON.stringify(overall, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(overall, null, 2));
    process.exitCode = 1;
  } finally {
    stopDevServer(serverHandle);
  }
}

await main();
