/**
 * E17-S4: Bridge Layer 0 — Environment Readiness Check
 *
 * First layer of the Test Execution Bridge (ADR-028, architecture §10.20).
 * Verifies that the local environment is ready to run tests before any runner
 * is invoked. On all-pass, emits a readiness report and advances to Layer 1.
 * On any failure, halts and emits a remediation message.
 *
 * Checks performed:
 *   1. Node.js version satisfies package.json `engines.node` (if declared)
 *   2. Package manager detected via lockfile (npm, yarn, or pnpm)
 *   3. package.json exists at {projectPath}
 *   4. A test script is defined in package.json
 *
 * Bridge scope: orchestrate only — this module does NOT modify project files
 * (FR-203). All checks are read-only.
 *
 * Traces to: FR-192, NFR-033 (<5s), NFR-035 (bridge_enabled guard), ADR-028
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ─── Constants ───────────────────────────────────────────────────────────────

const LOCKFILE_TO_MANAGER = [
  { file: "package-lock.json", manager: "npm" },
  { file: "npm-shrinkwrap.json", manager: "npm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "pnpm-lock.yaml", manager: "pnpm" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
 * We accept any script whose name starts with "test" to be generous about
 * mono-repo conventions (test, test:unit, test:integration, etc.).
 */
function hasTestScript(scripts) {
  if (!scripts || typeof scripts !== "object") return false;
  return Object.keys(scripts).some((name) => name === "test" || name.startsWith("test:"));
}

// ─── Individual checks ───────────────────────────────────────────────────────

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
    // No engines constraint — pass with informational note
    return {
      name: "node-version",
      passed: true,
      detected: process.version,
      required: null,
    };
  }

  const min = parseMinimumMajor(required);
  if (min === null || current === null) {
    // Cannot parse — do not block; treat as pass with a warning
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

// ─── Report rendering ────────────────────────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the Layer 0 environment readiness checks.
 *
 * @param {object} options
 * @param {string} options.projectPath - Absolute path to the project root.
 * @param {object} [options.config] - Resolved GAIA config. Layer 0 reads
 *   `config.test_execution_bridge.bridge_enabled`; when explicitly false, all
 *   checks are skipped and the call returns `{ skipped: true, ready: true }`
 *   (NFR-035).
 * @returns {{
 *   ready: boolean,
 *   skipped: boolean,
 *   checks: Array<object>,
 *   remediations: string[],
 *   report: string,
 *   elapsedMs: number,
 * }}
 */
export function checkEnvironmentReadiness({ projectPath, config = {} } = {}) {
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
    throw new TypeError("checkEnvironmentReadiness: projectPath is required");
  }

  const checks = [];

  // Check 1: package.json exists (gates other checks that need to read it)
  const pkgCheck = checkPackageJsonExists(projectPath);
  checks.push(pkgCheck);

  let pkgJson = null;
  if (pkgCheck.passed) {
    try {
      pkgJson = JSON.parse(readFileSync(pkgCheck.path, "utf8"));
    } catch (err) {
      // Malformed package.json — downgrade the exists check to a failure
      pkgCheck.passed = false;
      pkgCheck.remediation = `package.json at ${pkgCheck.path} is not valid JSON: ${err.message}`;
    }
  }

  // Check 2: Node version (only meaningful if package.json was parseable)
  checks.push(checkNodeVersion(pkgJson));

  // Check 3: Package manager
  checks.push(checkPackageManager(projectPath));

  // Check 4: Test script
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
