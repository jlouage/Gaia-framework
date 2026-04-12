/**
 * E25-S5: JavaScript Stack Adapter
 *
 * Encapsulates all JavaScript/Node-specific logic previously hardcoded in the
 * four-layer protocol core files. This adapter satisfies the StackAdapter
 * contract (architecture §10.20.11.1) and is the sole JS code path after the
 * E25-S5 refactor.
 *
 * Extracted from:
 *   - layer-0-environment-check.js  → readinessCheck()
 *   - layer-1-test-runner-discovery.js → discoverRunners()
 *   - layer-3-result-parsing.js → parseOutput()
 *
 * Traces to: FR-307, NFR-047, ADR-028, ADR-038
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Supported JavaScript test runners (aligned with E17-S20 compatibility
 * guard naming convention).
 */
const SUPPORTED_RUNNERS = ["vitest", "jest", "mocha", "bats"];

const DEFAULT_COMMANDS = {
  vitest: "vitest run",
  jest: "jest",
  mocha: "mocha",
  bats: "bats test/",
};

// Patterns used to identify a runner invocation inside a `scripts.test` string.
const SCRIPT_RUNNER_PATTERNS = [
  { pattern: /\bvitest\b/, runner: "vitest" },
  { pattern: /\bjest\b/, runner: "jest" },
  { pattern: /\bmocha\b/, runner: "mocha" },
  { pattern: /\bbats\b/, runner: "bats" },
];

const LOCKFILE_TO_MANAGER = [
  { file: "package-lock.json", manager: "npm" },
  { file: "npm-shrinkwrap.json", manager: "npm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "pnpm-lock.yaml", manager: "pnpm" },
];

// AC5: first 2KB of stdout+stderr are captured verbatim in
// raw_output_snippet when the parser falls through to the unknown-runner
// path so post-mortem debugging is possible without re-running the test.
const RAW_OUTPUT_SNIPPET_MAX = 2048;

// ─── Readiness helpers (from layer-0) ───────────────────────────────────────

/**
 * Parse a semver-ish range like ">=18", ">=18.0.0", "^20.1.0" and return the
 * minimum major version number, or null if we cannot parse it confidently.
 */
function parseMinimumMajor(range) {
  if (typeof range !== "string" || !range.trim()) return null;
  const match = range.match(/(\d+)(?:\.\d+)?(?:\.\d+)?/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Extract the current process's Node major version.
 */
function currentNodeMajor() {
  const match = process.version.match(/^v(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if the given package.json scripts map declares any test-related script.
 */
function hasTestScript(scripts) {
  if (!scripts || typeof scripts !== "object") return false;
  return Object.keys(scripts).some((name) => name === "test" || name.startsWith("test:"));
}

function checkPackageJsonExists(projectPath) {
  const pkgPath = join(projectPath, "package.json");
  const exists = existsSync(pkgPath);
  return {
    name: "package-json-exists",
    passed: exists,
    path: pkgPath,
    remediation: exists
      ? null
      : `package.json not found at ${pkgPath} — run \`npm init\` or cd into the project root.`,
  };
}

function checkNodeVersion(pkgJson) {
  const required = pkgJson?.engines?.node;
  const current = currentNodeMajor();

  if (!required) {
    return {
      name: "node-version",
      passed: true,
      detected: process.version,
      required: null,
    };
  }

  const min = parseMinimumMajor(required);
  if (min === null || current === null) {
    return {
      name: "node-version",
      passed: true,
      detected: process.version,
      required,
      warning: `Could not parse engines.node range "${required}".`,
    };
  }

  const passed = current >= min;
  return {
    name: "node-version",
    passed,
    detected: process.version,
    required,
    remediation: passed
      ? null
      : `Node.js ${process.version} does not satisfy required range "${required}". Install Node ${min}+ from nodejs.org.`,
  };
}

function checkPackageManager(projectPath) {
  for (const { file, manager } of LOCKFILE_TO_MANAGER) {
    if (existsSync(join(projectPath, file))) {
      return {
        name: "package-manager",
        passed: true,
        detected: manager,
        lockfile: file,
      };
    }
  }
  return {
    name: "package-manager",
    passed: false,
    detected: null,
    remediation:
      "No package manager lockfile found (expected one of: package-lock.json, yarn.lock, pnpm-lock.yaml). Run `npm install`, `yarn install`, or `pnpm install` to generate one.",
  };
}

function checkTestScript(pkgJson) {
  const passed = hasTestScript(pkgJson?.scripts);
  return {
    name: "test-script-defined",
    passed,
    scripts: pkgJson?.scripts ? Object.keys(pkgJson.scripts) : [],
    remediation: passed
      ? null
      : 'No test script defined in package.json. Add a "test" script under "scripts" (e.g., "test": "vitest run").',
  };
}

function renderReport(checks, elapsedMs, ready) {
  const rows = checks.map((c) => {
    const status = c.passed ? "PASS" : "FAIL";
    const detail = c.detected || c.path || c.required || "";
    return `  ${status.padEnd(4)}  ${c.name.padEnd(24)}  ${detail}`;
  });
  const header =
    "Bridge Layer 0 — Environment Readiness\n" +
    "──────────────────────────────────────\n";
  const footer = `\n──────────────────────────────────────\n  Overall: ${
    ready ? "READY" : "NOT READY"
  }  (${elapsedMs}ms)`;
  return header + rows.join("\n") + footer;
}

// ─── Discovery helpers (from layer-1) ───────────────────────────────────────

function readJsonSafe(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readTextSafe(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

// ─── Minimal YAML parser (scoped to the manifest schema) ───────────────────
//
// The repo already ships a richer parser in
// _gaia/core/validators/test-environment-validator.js, but Layer 1 lives in
// src/bridge/ and must not reach into _gaia/. To avoid a cross-tree import we
// inline a small schema-aware parser that handles exactly what Layer 1 needs:
// top-level scalars, a list of runner maps, and an optional `tiers` sub-map.

function parseScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseFlowSequence(raw) {
  return raw
    .slice(1, -1)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseScalar);
}

function parseTestEnvironmentYaml(text) {
  const result = {};
  const lines = text.split("\n");

  let topKey = null;
  let currentList = null;
  let currentMap = null;
  let currentSubKey = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trimStart();

    if (indent === 0 && trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.substring(0, colonIdx).trim();
      const val = trimmed.substring(colonIdx + 1).trim();

      topKey = key;
      currentList = null;
      currentMap = null;
      currentSubKey = null;

      if (val === "") continue;
      result[key] = parseScalar(val);
      topKey = null;
      continue;
    }

    if (trimmed.startsWith("- ") && topKey) {
      if (currentList === null) {
        currentList = [];
        result[topKey] = currentList;
      }
      const itemText = trimmed.substring(2).trim();
      if (itemText.includes(":")) {
        const colonIdx = itemText.indexOf(":");
        const k = itemText.substring(0, colonIdx).trim();
        const v = itemText.substring(colonIdx + 1).trim();
        currentList.push({ [k]: parseScalar(v) });
      } else {
        currentList.push(parseScalar(itemText));
      }
      continue;
    }

    if (indent > 0 && trimmed.includes(":") && topKey) {
      const colonIdx = trimmed.indexOf(":");
      const k = trimmed.substring(0, colonIdx).trim();
      const v = trimmed.substring(colonIdx + 1).trim();

      if (currentList && currentList.length > 0) {
        const last = currentList[currentList.length - 1];
        if (typeof last === "object" && last !== null) {
          if (v === "") {
            last[k] = {};
          } else if (v.startsWith("[") && v.endsWith("]")) {
            last[k] = parseFlowSequence(v);
          } else {
            last[k] = parseScalar(v);
          }
          continue;
        }
      }

      if (currentMap === null) {
        currentMap = {};
        result[topKey] = currentMap;
      }

      if (v === "") {
        currentSubKey = k;
        if (!currentMap[k]) currentMap[k] = {};
        continue;
      }

      const target =
        currentSubKey && currentMap[currentSubKey]
          ? currentMap[currentSubKey]
          : currentMap;

      if (v.startsWith("[") && v.endsWith("]")) {
        target[k] = parseFlowSequence(v);
      } else {
        target[k] = parseScalar(v);
      }
    }
  }

  return result;
}

// ─── Source-specific detectors ──────────────────────────────────────────────

function detectFromTestEnvironment(projectPath) {
  const path = join(projectPath, "test-environment.yaml");
  const content = readTextSafe(path);
  if (!content) {
    return { runners: [], primaryRunnerName: null, tiers: {} };
  }

  let parsed;
  try {
    parsed = parseTestEnvironmentYaml(content);
  } catch {
    return { runners: [], primaryRunnerName: null, tiers: {} };
  }

  const rawRunners = Array.isArray(parsed.runners) ? parsed.runners : [];
  const tiers = parsed.tiers && typeof parsed.tiers === "object" ? parsed.tiers : {};

  const runners = rawRunners
    .filter((r) => r && typeof r === "object" && r.name && r.command)
    .map((r) => ({
      runner_name: String(r.name),
      command: String(r.command),
      source: "test-environment.yaml",
      tier_mapping: resolveTierMapping(r.tier, tiers),
      tier: r.tier ?? null,
    }));

  return {
    runners,
    primaryRunnerName: parsed.primary_runner || null,
    tiers,
  };
}

function resolveTierMapping(tier, tiers) {
  if (tier === null || tier === undefined) return null;
  const entry = tiers[tier] || tiers[String(tier)];
  if (!entry || typeof entry !== "object") return null;
  return {
    tier,
    gates: Array.isArray(entry.gates) ? entry.gates : [],
  };
}

function detectFromPackageJson(projectPath) {
  const pkg = readJsonSafe(join(projectPath, "package.json"));
  if (!pkg) return [];

  const entries = [];
  const seen = new Set();

  const testScript = pkg.scripts?.test;
  if (typeof testScript === "string" && testScript.trim() !== "") {
    for (const { pattern, runner } of SCRIPT_RUNNER_PATTERNS) {
      if (pattern.test(testScript)) {
        entries.push({
          runner_name: runner,
          command: testScript,
          source: "package.json:scripts.test",
          tier_mapping: null,
          tier: null,
        });
        seen.add(runner);
        break;
      }
    }
  }

  const devDeps = pkg.devDependencies || {};
  for (const runner of SUPPORTED_RUNNERS) {
    if (runner in devDeps && !seen.has(runner)) {
      entries.push({
        runner_name: runner,
        command: DEFAULT_COMMANDS[runner],
        source: "package.json:devDependencies",
        tier_mapping: null,
        tier: null,
      });
      seen.add(runner);
    }
  }

  return entries;
}

const SOURCE_PRIORITY = {
  "test-environment.yaml": 0,
  "package.json:scripts.test": 1,
  "package.json:devDependencies": 2,
};

function rankEntries(entries) {
  return [...entries].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 99;
    const pb = SOURCE_PRIORITY[b.source] ?? 99;
    return pa - pb;
  });
}

function dedupeByRunnerName(rankedEntries) {
  const seen = new Map();
  for (const entry of rankedEntries) {
    if (!seen.has(entry.runner_name)) {
      seen.set(entry.runner_name, entry);
    }
  }
  return [...seen.values()];
}

// ─── TAP parser (Vitest + BATS) ────────────────────────────────────────────

function parseTap(output) {
  const lines = output.split(/\r?\n/);
  const tests = [];
  let sawAny = false;
  let currentFailure = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = /^(ok|not ok)\s+(\d+)\s*-?\s*(.*?)(?:\s*#\s*(SKIP|TODO)\b.*)?$/.exec(line);
    if (m) {
      sawAny = true;
      const [, status, , rawName, directive] = m;
      const name = rawName.trim();
      let entry;
      if (directive === "SKIP") {
        entry = { name, status: "skipped", duration_ms: 0 };
      } else if (status === "ok") {
        entry = { name, status: "passed", duration_ms: 0 };
      } else {
        entry = { name, status: "failed", duration_ms: 0 };
        currentFailure = entry;
      }
      tests.push(entry);
      continue;
    }

    if (currentFailure && /^\s*---\s*$/.test(line)) {
      const msgLines = [];
      i += 1;
      while (i < lines.length && !/^\s*\.\.\.\s*$/.test(lines[i])) {
        msgLines.push(lines[i].replace(/^\s*/, ""));
        i += 1;
      }
      currentFailure.failure_message = msgLines.join("\n").trim();
      currentFailure = null;
      continue;
    }

    if (currentFailure && /^#\s+/.test(line) && !currentFailure.failure_message) {
      currentFailure.failure_message = line.replace(/^#\s*/, "").trim();
      continue;
    }
  }

  if (!sawAny) return null;

  const summary = summarise(tests);
  return { summary, tests };
}

// ─── Jest JSON parser ──────────────────────────────────────────────────────

function parseJestJson(output) {
  let doc;
  try {
    doc = JSON.parse(output);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.testResults)) {
    return null;
  }

  const tests = [];
  for (const suite of doc.testResults) {
    if (!suite || !Array.isArray(suite.testResults)) continue;
    for (const t of suite.testResults) {
      const entry = {
        name: t.fullName || t.title || "unnamed",
        status: normaliseJestStatus(t.status),
        duration_ms: typeof t.duration === "number" ? t.duration : 0,
      };
      if (Array.isArray(t.failureMessages) && t.failureMessages.length > 0) {
        entry.failure_message = t.failureMessages.join("\n").trim();
      }
      tests.push(entry);
    }
  }

  const summary = {
    total: typeof doc.numTotalTests === "number" ? doc.numTotalTests : tests.length,
    passed:
      typeof doc.numPassedTests === "number"
        ? doc.numPassedTests
        : tests.filter((t) => t.status === "passed").length,
    failed:
      typeof doc.numFailedTests === "number"
        ? doc.numFailedTests
        : tests.filter((t) => t.status === "failed").length,
    skipped:
      typeof doc.numPendingTests === "number"
        ? doc.numPendingTests
        : tests.filter((t) => t.status === "skipped").length,
  };

  return { summary, tests };
}

function normaliseJestStatus(status) {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "pending" || status === "skipped" || status === "todo") return "skipped";
  return "failed";
}

function summarise(tests) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const t of tests) {
    if (t.status === "passed") passed += 1;
    else if (t.status === "failed") failed += 1;
    else if (t.status === "skipped") skipped += 1;
  }
  return { total: tests.length, passed, failed, skipped };
}

// ─── StackAdapter contract implementation ───────────────────────────────────

/**
 * Readiness check for JavaScript/Node projects.
 * Verifies package.json, Node version, package manager, and test script.
 *
 * @param {string} projectPath - Absolute path to the project root.
 * @param {object} [config] - Resolved GAIA config.
 * @returns {{ ready: boolean, skipped: boolean, checks: Array, remediations: string[], report: string, elapsedMs: number }}
 */
function readinessCheck(projectPath, config = {}) {
  const started = Date.now();

  // AC5 / NFR-035 — bridge_enabled guard
  if (config?.test_execution_bridge?.bridge_enabled === false) {
    return {
      ready: true,
      skipped: true,
      checks: [],
      remediations: [],
      report: "",
      elapsedMs: Date.now() - started,
    };
  }

  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("readinessCheck: projectPath is required");
  }

  const checks = [];

  const pkgCheck = checkPackageJsonExists(projectPath);
  checks.push(pkgCheck);

  let pkgJson = null;
  if (pkgCheck.passed) {
    try {
      pkgJson = JSON.parse(readFileSync(pkgCheck.path, "utf8"));
    } catch (err) {
      pkgCheck.passed = false;
      pkgCheck.remediation = `package.json at ${pkgCheck.path} is not valid JSON: ${err.message}`;
    }
  }

  checks.push(checkNodeVersion(pkgJson));
  checks.push(checkPackageManager(projectPath));
  checks.push(checkTestScript(pkgJson));

  const elapsedMs = Date.now() - started;
  const ready = checks.every((c) => c.passed);
  const remediations = checks
    .filter((c) => !c.passed && c.remediation)
    .map((c) => c.remediation);
  const report = renderReport(checks, elapsedMs, ready);

  return {
    ready,
    skipped: false,
    checks,
    remediations,
    report,
    elapsedMs,
  };
}

/**
 * Discover test runners for a JavaScript/Node project.
 *
 * @param {string} projectPath - Absolute path to the project root.
 * @param {object} [manifest] - Optional pre-existing manifest.
 * @returns {Promise<object>}
 */
async function discoverRunners(projectPath, manifest = {}) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("discoverRunners: projectPath is required");
  }

  // 1. Explicit declarations from test-environment.yaml
  const {
    runners: envRunners,
    primaryRunnerName,
  } = detectFromTestEnvironment(projectPath);

  // 2. Inferred runners from package.json
  const pkgRunners = detectFromPackageJson(projectPath);

  // 3. Combine and rank by source priority, then de-dupe by runner_name.
  const ranked = dedupeByRunnerName(rankEntries([...envRunners, ...pkgRunners]));

  if (ranked.length === 0) {
    return {
      status: "error",
      message:
        "No test runner found. Declare one in test-environment.yaml at the project root, or add a test runner (vitest, jest, mocha, bats) to package.json.",
    };
  }

  // 4. Primary selection
  let primary = null;

  if (primaryRunnerName) {
    primary =
      ranked.find(
        (r) =>
          r.source === "test-environment.yaml" &&
          r.runner_name === primaryRunnerName
      ) || ranked.find((r) => r.runner_name === primaryRunnerName);
  }

  if (!primary) {
    const topEnv = ranked.find((r) => r.source === "test-environment.yaml");
    if (topEnv) {
      primary = topEnv;
    } else if (ranked.length === 1) {
      primary = ranked[0];
    } else {
      const topPriority = SOURCE_PRIORITY[ranked[0].source] ?? 99;
      const topTier = ranked.filter(
        (r) => (SOURCE_PRIORITY[r.source] ?? 99) === topPriority
      );
      if (topTier.length === 1) {
        primary = topTier[0];
      } else {
        return {
          status: "disambiguation",
          candidates: topTier,
          message:
            "Multiple test runners detected. Set `primary_runner` in test-environment.yaml or pick one interactively.",
        };
      }
    }
  }

  return {
    status: "ok",
    primary,
    manifest: {
      primary_runner: primary,
      runners: ranked,
    },
  };
}

/**
 * Parse Layer 2 execution output into a structured result object.
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {number} exitCode
 * @returns {{ summary: object, tests: Array, parse_error?: boolean, raw_output_snippet?: string }}
 */
function parseOutput(stdout, stderr, exitCode) {
  const stdoutStr = typeof stdout === "string" ? stdout : "";
  const stderrStr = typeof stderr === "string" ? stderr : "";

  // Jest JSON — try first when the stdout looks like a JSON document.
  if (/^\s*\{/.test(stdoutStr)) {
    const jestResult = parseJestJson(stdoutStr);
    if (jestResult) return jestResult;
  }

  // TAP — covers Vitest and BATS with the same protocol.
  const tap = parseTap(stdoutStr);
  if (tap) return tap;

  // AC5: parse-failure fallback
  const combined = `${stdoutStr}\n${stderrStr}`;
  const raw_output_snippet = combined.slice(0, RAW_OUTPUT_SNIPPET_MAX);
  return {
    parse_error: true,
    raw_output_snippet,
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    tests: [],
  };
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * @type {import('./index.js').StackAdapter}
 */
const jsAdapter = {
  name: "javascript",
  detectionPatterns: ["package.json"],
  readinessCheck,
  discoverRunners,
  parseOutput,
};

export default jsAdapter;
