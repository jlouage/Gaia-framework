/**
 * E25-S1: Python/pytest Stack Adapter
 *
 * Plugs into the E25-S5 adapter registry and satisfies the StackAdapter
 * contract (architecture §10.20.11.1). Mirrors the js-adapter.js structure
 * so layer core files remain stack-agnostic.
 *
 * Responsibilities:
 *   - Layer 0: readinessCheck — detect python interpreter + config file + pytest import
 *   - Layer 1: discoverRunners — parse pytest config and emit runner manifest
 *   - Layer 3: parseOutput — read test-results/pytest.xml and build evidence record
 *
 * Detection semantics are OR across the four pytest config files (see
 * registry's per-adapter `detectionMode` field). No new runtime dependencies
 * — JUnit XML parsing uses the existing fast-xml-parser devDependency.
 *
 * Traces to: FR-307, FR-308, NFR-047, ADR-028, ADR-038, architecture §10.20.11
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execFileSync as realExecFileSync } from "child_process";
import { XMLParser } from "fast-xml-parser";

// ─── Constants ──────────────────────────────────────────────────────────────

const DETECTION_PATTERNS = ["pyproject.toml", "pytest.ini", "setup.cfg", "setup.py"];

const DEFAULT_COMMAND = "pytest --junitxml=test-results/pytest.xml";
const JUNIT_REL_PATH = join("test-results", "pytest.xml");
const STDERR_SNIPPET_MAX = 2048;

const REMEDIATION = {
  missingInterpreter:
    "Python interpreter not found on PATH. Install python3 from python.org or add it to PATH before running the bridge.",
  missingPytest:
    "Python package pytest is not importable. Run `pip install pytest` (or `python3 -m pip install pytest`) and retry.",
  missingConfig:
    "No pytest configuration detected. Expected at least one of: pyproject.toml, pytest.ini, setup.cfg, or setup.py in the project root.",
};

// ─── Interpreter detection (Layer 0 helper) ─────────────────────────────────

/**
 * Find the first available python interpreter on PATH.
 * Uses execFileSync (no shell) per AC2 to avoid shell injection.
 *
 * @param {function} execFile - execFileSync implementation (injectable for tests)
 * @returns {string|null} the interpreter name ("python3" / "python") or null if none work
 */
function findInterpreter(execFile) {
  for (const candidate of ["python3", "python"]) {
    try {
      execFile(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Probe whether `pytest` is importable under the given interpreter.
 *
 * @param {string} interpreter
 * @param {function} execFile
 * @returns {boolean}
 */
function canImportPytest(interpreter, execFile) {
  try {
    execFile(interpreter, ["-c", "import pytest"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasAnyConfig(projectPath) {
  return DETECTION_PATTERNS.some((p) => existsSync(join(projectPath, p)));
}

// ─── Config parsers (Layer 1 helpers) ───────────────────────────────────────

/**
 * Minimal INI-style parser — extracts a named section's key/value map.
 * Handles multi-line values (continuation lines indented beneath a key).
 * Not a full TOML/INI parser — just enough for pytest's `markers = ...` block
 * and similar scalar fields.
 *
 * @param {string} text
 * @param {string} sectionName - e.g. "tool.pytest.ini_options", "pytest", "tool:pytest"
 * @returns {Object<string,string>|null} section body, or null if not found
 */
function parseIniSection(text, sectionName) {
  const lines = text.split(/\r?\n/);
  const header = "[" + sectionName + "]";
  let inside = false;
  const kv = {};
  let currentKey = null;
  let multilineBuffer = null;

  const flushMultiline = () => {
    if (currentKey !== null && multilineBuffer !== null) {
      kv[currentKey] = multilineBuffer.join("\n").trim();
    }
    currentKey = null;
    multilineBuffer = null;
  };

  for (const raw of lines) {
    const stripped = raw.replace(/\s+$/, "");
    const trimmed = stripped.trim();

    if (/^\[.+\]$/.test(trimmed)) {
      // section header line
      flushMultiline();
      inside = trimmed === header;
      continue;
    }
    if (!inside) continue;
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }

    // Multi-line continuation: indented line with no `=`
    const isIndented = stripped.length > 0 && /^\s/.test(stripped);
    if (currentKey !== null && isIndented && !/^\s*[\w.-]+\s*=/.test(stripped)) {
      multilineBuffer.push(stripped.trim());
      continue;
    }

    // New key
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    flushMultiline();
    currentKey = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    multilineBuffer = [];
    if (value !== "") {
      // inline value — assign immediately, but still support subsequent continuation
      multilineBuffer.push(value);
    }
  }
  flushMultiline();

  return Object.keys(kv).length === 0 ? null : kv;
}

/**
 * Extract the markers block from a parsed pytest config section.
 * Supports the `markers = unit: fast\nintegration: slow` format per Dev Notes.
 *
 * @param {Object<string,string>} section
 * @returns {Object<string,string>} marker name → description, or {} if none
 */
function extractMarkers(section) {
  if (!section) return {};
  const raw = section.markers !== undefined ? section.markers : section["markers"];
  if (!raw || typeof raw !== "string") return {};

  // Strip TOML-style surrounding brackets/quotes if present
  let body = raw.trim();
  if (body.startsWith("[") && body.endsWith("]")) {
    // TOML array form: ["unit: fast", "integration: slow"]
    body = body.slice(1, -1);
    const parts = body.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
    return linesToMarkers(parts);
  }
  // Line-delimited form
  return linesToMarkers(body.split(/\r?\n/));
}

function linesToMarkers(lines) {
  const out = {};
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    const idx = l.indexOf(":");
    if (idx === -1) {
      out[l] = "";
      continue;
    }
    const name = l.substring(0, idx).trim();
    const desc = l.substring(idx + 1).trim();
    if (name) out[name] = desc;
  }
  return out;
}

/**
 * Read pytest configuration from the project. Preference order:
 *   1. pyproject.toml [tool.pytest.ini_options]
 *   2. pytest.ini [pytest]
 *   3. setup.cfg [tool:pytest]
 *
 * @param {string} projectPath
 * @returns {{ source: string, section: Object<string,string>|null }}
 */
function readPytestConfig(projectPath) {
  const candidates = [
    { file: "pyproject.toml", section: "tool.pytest.ini_options" },
    { file: "pytest.ini", section: "pytest" },
    { file: "setup.cfg", section: "tool:pytest" },
  ];
  for (const { file, section } of candidates) {
    const p = join(projectPath, file);
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, "utf8");
      const parsed = parseIniSection(text, section);
      if (parsed) return { source: file, section: parsed };
    } catch {
      // fall through
    }
  }
  return { source: null, section: null };
}

// ─── JUnit XML parser (Layer 3 helper) ─────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: true,
});

function normalizeTestCases(rawCases) {
  if (!rawCases) return [];
  const arr = Array.isArray(rawCases) ? rawCases : [rawCases];
  return arr.map((tc) => {
    const classname = tc["@_classname"] || "";
    const name = tc["@_name"] || "unnamed";
    const fullName = classname ? `${classname}.${name}` : name;
    const time = typeof tc["@_time"] === "number" ? tc["@_time"] : parseFloat(tc["@_time"] || "0");
    const durationMs = Math.round((isNaN(time) ? 0 : time) * 1000);

    let status = "passed";
    let failureMessage;
    if (tc.failure !== undefined || tc.error !== undefined) {
      status = "failed";
      const node = tc.failure || tc.error;
      if (typeof node === "string") failureMessage = node;
      else if (node && typeof node === "object") {
        failureMessage = node["@_message"] || node["#text"] || JSON.stringify(node);
      }
    } else if (tc.skipped !== undefined) {
      status = "skipped";
    }
    const entry = { name: fullName, status, duration_ms: durationMs };
    if (failureMessage !== undefined) entry.failure_message = String(failureMessage).trim();
    return entry;
  });
}

function parseJUnitXml(xmlText) {
  let doc;
  try {
    doc = xmlParser.parse(xmlText);
  } catch {
    return null;
  }
  // Support <testsuites><testsuite>...</testsuite></testsuites> and bare <testsuite>.
  let suites = [];
  if (doc.testsuites) {
    const ts = doc.testsuites.testsuite;
    suites = Array.isArray(ts) ? ts : ts ? [ts] : [];
  } else if (doc.testsuite) {
    suites = Array.isArray(doc.testsuite) ? doc.testsuite : [doc.testsuite];
  } else {
    return null;
  }
  const tests = [];
  for (const suite of suites) {
    if (!suite) continue;
    tests.push(...normalizeTestCases(suite.testcase));
  }
  const summary = {
    total: tests.length,
    passed: tests.filter((t) => t.status === "passed").length,
    failed: tests.filter((t) => t.status === "failed").length,
    skipped: tests.filter((t) => t.status === "skipped").length,
  };
  return { summary, tests };
}

// ─── StackAdapter contract ───────────────────────────────────────────────────

/**
 * Readiness check for Python/pytest projects (AC2).
 *
 * @param {string} projectPath
 * @param {object} [options] - optional dependency injection for tests
 * @param {function} [options._execFile] - override for execFileSync (tests only)
 * @returns {{ passed: boolean, remediation: string|null, ready: boolean, skipped: boolean, checks: Array, remediations: string[], report: string, elapsedMs: number }}
 */
function readinessCheck(projectPath, options = {}) {
  const started = Date.now();
  const execFile = options._execFile || realExecFileSync;

  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("readinessCheck: projectPath is required");
  }

  // AC5 / NFR-035 — bridge_enabled guard (matches js-adapter parity)
  if (options?.test_execution_bridge?.bridge_enabled === false) {
    return {
      passed: true,
      remediation: null,
      ready: true,
      skipped: true,
      checks: [],
      remediations: [],
      report: "",
      elapsedMs: Date.now() - started,
    };
  }

  const checks = [];

  // Check 1: config file present (OR over the four patterns)
  const cfgOk = hasAnyConfig(projectPath);
  checks.push({
    name: "pytest-config",
    passed: cfgOk,
    remediation: cfgOk ? null : REMEDIATION.missingConfig,
  });

  // Check 2: interpreter present
  const interpreter = findInterpreter(execFile);
  const interpreterOk = interpreter !== null;
  checks.push({
    name: "python-interpreter",
    passed: interpreterOk,
    detected: interpreter,
    remediation: interpreterOk ? null : REMEDIATION.missingInterpreter,
  });

  // Check 3: pytest importable (only if interpreter exists)
  let pytestOk = false;
  if (interpreterOk) {
    pytestOk = canImportPytest(interpreter, execFile);
  }
  checks.push({
    name: "pytest-importable",
    passed: pytestOk,
    remediation: pytestOk ? null : REMEDIATION.missingPytest,
  });

  // Pick the first failing check for the single `remediation` field per AC2.
  // Priority: interpreter > pytest > config — the most actionable missing piece first.
  let remediation = null;
  if (!interpreterOk) remediation = REMEDIATION.missingInterpreter;
  else if (!pytestOk) remediation = REMEDIATION.missingPytest;
  else if (!cfgOk) remediation = REMEDIATION.missingConfig;

  const passed = interpreterOk && pytestOk && cfgOk;
  const elapsedMs = Date.now() - started;
  const remediations = checks.filter((c) => !c.passed && c.remediation).map((c) => c.remediation);

  return {
    passed,
    remediation,
    // Parallel shape for js-adapter parity
    ready: passed,
    skipped: false,
    checks,
    remediations,
    report: buildReport(checks, passed, elapsedMs),
    elapsedMs,
  };
}

function buildReport(checks, ready, elapsedMs) {
  const rows = checks.map((c) => {
    const status = c.passed ? "PASS" : "FAIL";
    const detail = c.detected || "";
    return `  ${status.padEnd(4)}  ${c.name.padEnd(24)}  ${detail}`;
  });
  return (
    "Bridge Layer 0 — Python Readiness\n" +
    "──────────────────────────────────────\n" +
    rows.join("\n") +
    `\n──────────────────────────────────────\n  Overall: ${ready ? "READY" : "NOT READY"}  (${elapsedMs}ms)`
  );
}

/**
 * Discover pytest runner and marker-based tiers (AC3, AC6).
 *
 * @param {string} projectPath
 * @param {object} [manifest]
 * @returns {Promise<object>}
 */
async function discoverRunners(projectPath /*, manifest */) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("discoverRunners: projectPath is required");
  }

  const { source, section } = readPytestConfig(projectPath);
  const markers = extractMarkers(section);

  const tiers = {};
  const markerNames = Object.keys(markers);
  if (markerNames.length === 0) {
    tiers.all = { description: "All pytest tests (no markers declared)", marker: null };
  } else {
    for (const name of markerNames) {
      tiers[name] = { description: markers[name] || "", marker: name };
    }
  }

  const primary = {
    runner_name: "pytest",
    command: DEFAULT_COMMAND,
    source: source ? `${source}:pytest-config` : "default",
    tier_mapping: markerNames.length === 0 ? { tier: "all", gates: [] } : null,
    tier: markerNames.length === 0 ? "all" : null,
  };

  return {
    status: "ok",
    primary,
    manifest: {
      primary_runner: primary,
      runners: [primary],
      tiers,
      markers,
    },
  };
}

/**
 * Parse pytest execution output (AC4, AC5).
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {number} exitCode
 * @param {object} [options]
 * @param {string} [options._projectPath] - project root used to locate JUnit XML
 * @returns {object}
 */
function parseOutput(stdout, stderr, exitCode, options = {}) {
  const stderrStr = typeof stderr === "string" ? stderr : "";
  const projectPath = options._projectPath || process.cwd();
  const xmlPath = join(projectPath, JUNIT_REL_PATH);

  if (existsSync(xmlPath)) {
    try {
      const xml = readFileSync(xmlPath, "utf8");
      const parsed = parseJUnitXml(xml);
      if (parsed) return parsed;
    } catch {
      // fall through to parse_error
    }
  }

  // AC5: minimal evidence with parse_error flag and stderr snippet
  return {
    parse_error: true,
    stderr_snippet: stderrStr.slice(0, STDERR_SNIPPET_MAX),
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    tests: [],
    exit_code: exitCode,
  };
}

// ─── E25-S6: resolveTierMapping ─────────────────────────────────────────────

/**
 * Resolve per-tier pytest marker mapping for a project. Honours the optional
 * `stackHints.pytest_markers` override (from test-environment.yaml
 * tiers.stack_hints) and falls back to the markers declared in the project's
 * pytest config file when no hint is supplied. The returned evidence records
 * `tier_source: "stack_hints"` when the hint was applied, `"adapter_default"`
 * otherwise (E25-S6 FR-312, ADR-038 §10.20.11).
 *
 * @param {string} projectPath
 * @param {object} [options]
 * @param {string[]} [options.stackHints] - marker names declared in
 *   test-environment.yaml tiers.stack_hints.pytest_markers
 * @returns {{ mapping: object, entries: Array<{ tier: string, marker: string|null, tier_source: "stack_hints"|"adapter_default" }> }}
 */
function resolveTierMapping(projectPath, options = {}) {
  const hints = Array.isArray(options.stackHints) ? options.stackHints : null;

  if (hints && hints.length > 0) {
    const entries = hints.map((marker) => ({
      tier: String(marker),
      marker: String(marker),
      tier_source: "stack_hints",
    }));
    const mapping = {};
    for (const e of entries) mapping[e.tier] = { marker: e.marker };
    return { mapping, entries };
  }

  // Fallback — read markers from pytest config.
  const { section } = readPytestConfig(projectPath);
  const markers = extractMarkers(section);
  const markerNames = Object.keys(markers);
  if (markerNames.length === 0) {
    const entries = [{ tier: "all", marker: null, tier_source: "adapter_default" }];
    return { mapping: { all: { marker: null } }, entries };
  }
  const entries = markerNames.map((name) => ({
    tier: name,
    marker: name,
    tier_source: "adapter_default",
  }));
  const mapping = {};
  for (const e of entries) mapping[e.tier] = { marker: e.marker };
  return { mapping, entries };
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * @type {import('./index.js').StackAdapter}
 */
const pythonAdapter = {
  name: "python",
  detectionPatterns: DETECTION_PATTERNS,
  // OR semantics across detection patterns — registry consults this flag
  detectionMode: "any",
  readinessCheck,
  discoverRunners,
  parseOutput,
  // E25-S6 — exposed for per-stack tier mapping consumers (FR-312).
  resolveTierMapping,
};

export default pythonAdapter;
