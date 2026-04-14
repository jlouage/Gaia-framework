/**
 * E25-S3: Go Stack Adapter
 *
 * Plugs into the E25-S5 adapter registry and satisfies the StackAdapter
 * contract (architecture §10.20.11.1). Unlike the Python and Java adapters
 * (which read JUnit XML files from disk), the Go adapter consumes
 * `go test -json` — a line-delimited JSON event stream emitted on stdout.
 *
 * Responsibilities:
 *   - Layer 0: readinessCheck — detect `go` on PATH + `go.mod` at project root
 *   - Layer 1: discoverRunners — `go list ./...` for single-module,
 *              `go list -m all` for nested-module monorepos
 *   - Layer 3: parseOutput — streaming JSON event parser correlating events
 *              by (Package, Test) keys; tolerant of panic truncation
 *
 * Detection semantics: AND over `go.mod` (single-file detection).
 * No new runtime dependencies — line-delimited JSON.parse only.
 *
 * Traces to: FR-307, FR-310, NFR-047, ADR-028, ADR-038, architecture §10.20.11
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { execFileSync as realExecFileSync } from "child_process";

// ─── Constants ──────────────────────────────────────────────────────────────

const DETECTION_PATTERNS = ["go.mod"];

const DEFAULT_COMMAND = "go test -json ./...";
const STDERR_SNIPPET_MAX = 2048;
const RAW_OUTPUT_SNIPPET_MAX = 2048;

const DEFAULT_BUILD_TAGS = {
  integration: "integration",
  e2e: "e2e",
};

const REMEDIATION = {
  missingGoToolchain: "Go not found — install from https://go.dev/dl/",
  missingGoMod:
    "No go.mod found at the project root. Run `go mod init <module>` to initialize a Go module.",
};

// ─── Layer 0 helpers ────────────────────────────────────────────────────────

function goAvailable(execFile) {
  try {
    execFile("go", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasGoMod(projectPath) {
  return existsSync(join(projectPath, "go.mod"));
}

// ─── Layer 0: readinessCheck ────────────────────────────────────────────────

/**
 * Readiness check for Go projects (AC2).
 *
 * @param {string} projectPath
 * @param {object} [options]
 * @param {function} [options._execFile] - execFileSync override (tests only)
 * @returns {object}
 */
function readinessCheck(projectPath, options = {}) {
  const started = Date.now();
  const execFile = options._execFile || realExecFileSync;

  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("readinessCheck: projectPath is required");
  }

  // NFR-035 bridge_enabled guard — parity with js/python/java adapters.
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

  const toolchainOk = goAvailable(execFile);
  checks.push({
    name: "go-toolchain",
    passed: toolchainOk,
    detected: toolchainOk ? "go" : null,
    remediation: toolchainOk ? null : REMEDIATION.missingGoToolchain,
  });

  const goModOk = hasGoMod(projectPath);
  checks.push({
    name: "go-mod",
    passed: goModOk,
    remediation: goModOk ? null : REMEDIATION.missingGoMod,
  });

  // Priority: missing toolchain is the most actionable failure.
  let remediation = null;
  if (!toolchainOk) remediation = REMEDIATION.missingGoToolchain;
  else if (!goModOk) remediation = REMEDIATION.missingGoMod;

  const passed = toolchainOk && goModOk;
  const elapsedMs = Date.now() - started;
  const remediations = checks.filter((c) => !c.passed && c.remediation).map((c) => c.remediation);

  return {
    passed,
    remediation,
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
    "Bridge Layer 0 — Go Readiness\n" +
    "──────────────────────────────────────\n" +
    rows.join("\n") +
    `\n──────────────────────────────────────\n  Overall: ${
      ready ? "READY" : "NOT READY"
    }  (${elapsedMs}ms)`
  );
}

// ─── Monorepo detection (Layer 1 helper) ────────────────────────────────────

/**
 * Walk the project tree looking for nested `go.mod` files (excluding the
 * root `go.mod`). Returns the list of module-root-relative directories.
 * Stops at common vendor / build / node_modules directories to keep the
 * scan cheap.
 *
 * @param {string} projectPath
 * @returns {string[]} nested module directories (relative), excluding root
 */
function findNestedModules(projectPath) {
  const skipDirs = new Set([
    "node_modules",
    "vendor",
    ".git",
    "build",
    "dist",
    "target",
    ".idea",
    ".vscode",
  ]);
  const results = [];

  function walk(dir, depth) {
    if (depth > 6) return; // depth guard
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (skipDirs.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      const sub = join(dir, entry.name);
      if (existsSync(join(sub, "go.mod"))) {
        results.push(relative(projectPath, sub));
      }
      walk(sub, depth + 1);
    }
  }

  walk(projectPath, 0);
  return results;
}

// ─── Layer 1: discoverRunners ───────────────────────────────────────────────

/**
 * Discover Go runners (AC3, AC7).
 *
 * Single-module projects emit one `go test -json ./...` runner.
 * Monorepos (nested go.mod detected) emit one runner per module plus
 * the root runner when the root itself is a module.
 *
 * @param {string} projectPath
 * @param {object} [manifest]
 * @returns {Promise<object>}
 */
async function discoverRunners(projectPath /*, manifest */) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("discoverRunners: projectPath is required");
  }

  if (!hasGoMod(projectPath)) {
    return {
      status: "error",
      message: "No go.mod found at the project root.",
    };
  }

  const nested = findNestedModules(projectPath);

  // Single-module project — flat runner manifest.
  if (nested.length === 0) {
    const primary = {
      runner_name: "go-test",
      command: DEFAULT_COMMAND,
      source: "go.mod",
      tier_mapping: { tier: "unit", gates: [] },
      tier: "unit",
    };
    return {
      status: "ok",
      primary,
      manifest: {
        mode: "single-module",
        primary_runner: primary,
        runners: [primary],
        tiers: { unit: { description: "Go unit tests (go test -json ./...)" } },
      },
    };
  }

  // Monorepo — one runner per module (root + nested).
  const modules = ["."].concat(nested);
  const runners = modules.map((modPath) => {
    const label = modPath === "." ? "root" : modPath;
    return {
      runner_name: `go-test:${label}`,
      command: DEFAULT_COMMAND,
      source: join(modPath === "." ? "" : modPath, "go.mod"),
      module: modPath,
      cwd: modPath === "." ? "." : modPath,
      tier_mapping: { tier: "unit", gates: [] },
      tier: "unit",
    };
  });
  const primary = runners[0];

  return {
    status: "ok",
    primary,
    manifest: {
      mode: "multi-module",
      modules,
      primary_runner: primary,
      runners,
      tiers: { unit: { description: "Go unit tests per-module" } },
    },
  };
}

// ─── Build tag scanner (Layer 1 helper) ─────────────────────────────────────

const buildTagCache = new Map(); // projectPath → Map<filePath, tags[]>

/**
 * Extract `//go:build <expr>` tags from the top of a `_test.go` file.
 * Only scans the first 20 non-empty lines (build tags must appear before
 * the package clause). Returns an array of individual tag tokens.
 *
 * @param {string} filePath
 * @returns {string[]}
 */
function scanFileBuildTags(filePath) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  const lines = text.split(/\r?\n/).slice(0, 40);
  const tags = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("package ")) break;
    const m = /^\/\/go:build\s+(.+)$/.exec(line);
    if (m) {
      // Split on logical operators to extract tag identifiers.
      const tokens = m[1].split(/\s+|\|\||&&|!|\(|\)/).filter(Boolean);
      tags.push(...tokens);
      continue;
    }
    // Legacy `// +build` syntax — supported defensively.
    const legacy = /^\/\/\s*\+build\s+(.+)$/.exec(line);
    if (legacy) {
      const tokens = legacy[1].split(/\s+|,/).filter(Boolean);
      tags.push(...tokens);
    }
  }
  return Array.from(new Set(tags));
}

/**
 * Scan a project for all `*_test.go` files and their build tags.
 * Results are cached per project path.
 *
 * @param {string} projectPath
 * @returns {Map<string, string[]>} file path → tags[]
 */
function scanProjectBuildTags(projectPath) {
  if (buildTagCache.has(projectPath)) return buildTagCache.get(projectPath);
  const out = new Map();
  const skipDirs = new Set([
    "node_modules",
    "vendor",
    ".git",
    "build",
    "dist",
    "target",
    ".idea",
    ".vscode",
  ]);

  function walk(dir, depth) {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const sub = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(sub, depth + 1);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith("_test.go")) {
        out.set(sub, scanFileBuildTags(sub));
      }
    }
  }

  walk(projectPath, 0);
  buildTagCache.set(projectPath, out);
  return out;
}

/**
 * Map a `*_test.go` file to a tier based on its build tags.
 *
 * @param {string[]} tags
 * @param {object} [tagMapping] - { integration: string, e2e: string } override
 * @returns {"unit"|"integration"|"e2e"}
 */
function mapTagsToTier(tags, tagMapping = DEFAULT_BUILD_TAGS) {
  if (!tags || tags.length === 0) return "unit";
  if (tags.includes(tagMapping.e2e)) return "e2e";
  if (tags.includes(tagMapping.integration)) return "integration";
  return "unit";
}

/**
 * Resolve build-tag tier mapping for a project. Exposed for AC6 testing
 * and for downstream consumers (E25-S6 per-stack tier mapping).
 *
 * @param {string} projectPath
 * @param {object} [options]
 * @param {object} [options.stackHints] - test-environment.yaml tiers.stack_hints.go_build_tags override
 * @returns {{ tierByFile: Map<string,string>, mapping: object }}
 */
function resolveTierMapping(projectPath, options = {}) {
  // E25-S6: `stackHints` accepts either a tag-mapping object (legacy shape
  // used internally by this adapter — { integration: "integration", e2e: "e2e" })
  // or the array form from test-environment.yaml
  // (`tiers.stack_hints.go_build_tags: ["integration", "e2e"]`). When the
  // array form is supplied, the first entry is treated as the integration
  // tag and the second as the e2e tag, matching Dev Notes semantics.
  let mapping;
  let tierSource;
  if (Array.isArray(options.stackHints)) {
    const hints = options.stackHints;
    mapping = {
      integration: hints[0] || DEFAULT_BUILD_TAGS.integration,
      e2e: hints[1] || DEFAULT_BUILD_TAGS.e2e,
    };
    tierSource = "stack_hints";
  } else if (options.stackHints && typeof options.stackHints === "object") {
    mapping = { ...DEFAULT_BUILD_TAGS, ...options.stackHints };
    tierSource = "stack_hints";
  } else {
    mapping = DEFAULT_BUILD_TAGS;
    tierSource = "adapter_default";
  }
  const tagged = scanProjectBuildTags(projectPath);
  const tierByFile = new Map();
  for (const [file, tags] of tagged.entries()) {
    tierByFile.set(file, mapTagsToTier(tags, mapping));
  }
  // E25-S6 evidence entries — one per tier with tier_source recorded so
  // downstream evidence files can record whether the resolution came from a
  // project hint or the adapter default (ADR-038 §10.20.11).
  const entries = [
    { tier: "unit", tag: null, tier_source: tierSource },
    { tier: "integration", tag: mapping.integration, tier_source: tierSource },
    { tier: "e2e", tag: mapping.e2e, tier_source: tierSource },
  ];
  return { tierByFile, mapping, entries };
}

// ─── Layer 3: streaming JSON parser ─────────────────────────────────────────

/**
 * Split a `go test -json` stdout buffer into parsed event objects.
 * Silently skips non-JSON lines (Go occasionally emits plain text).
 *
 * @param {string} stdout
 * @returns {Array<object>}
 */
function parseJsonEventStream(stdout) {
  if (!stdout || typeof stdout !== "string") return [];
  const events = [];
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) !== "{") continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === "object") events.push(obj);
    } catch {
      // Skip malformed event — common with truncated panic output.
    }
  }
  return events;
}

/**
 * Correlate `go test -json` events into per-test records keyed by
 * (Package, Test). Package-level events (no Test field) contribute to
 * package summaries but are not emitted as test records.
 *
 * @param {Array<object>} events
 * @returns {{ tests: Array<object>, packageSummaries: Map<string, object> }}
 */
function correlateEvents(events) {
  const byKey = new Map();
  const pkgSummary = new Map();

  for (const ev of events) {
    const pkg = ev.Package || "";
    const action = ev.Action || "";

    if (!ev.Test) {
      // Package-level event.
      if (!pkgSummary.has(pkg)) {
        pkgSummary.set(pkg, { status: null, elapsed: 0 });
      }
      if (["pass", "fail", "skip"].includes(action)) {
        const entry = pkgSummary.get(pkg);
        entry.status = action;
        if (typeof ev.Elapsed === "number") entry.elapsed = ev.Elapsed;
      }
      continue;
    }

    const key = `${pkg}\u0000${ev.Test}`;
    let rec = byKey.get(key);
    if (!rec) {
      rec = {
        package: pkg,
        test: ev.Test,
        name: `${pkg}.${ev.Test}`,
        status: "running",
        duration_ms: 0,
        output: [],
      };
      byKey.set(key, rec);
    }

    if (action === "output" && typeof ev.Output === "string") {
      rec.output.push(ev.Output);
    } else if (action === "pass") {
      rec.status = "passed";
      if (typeof ev.Elapsed === "number") {
        rec.duration_ms = Math.round(ev.Elapsed * 1000);
      }
    } else if (action === "fail") {
      rec.status = "failed";
      if (typeof ev.Elapsed === "number") {
        rec.duration_ms = Math.round(ev.Elapsed * 1000);
      }
    } else if (action === "skip") {
      rec.status = "skipped";
      if (typeof ev.Elapsed === "number") {
        rec.duration_ms = Math.round(ev.Elapsed * 1000);
      }
    }
  }

  const tests = [];
  for (const rec of byKey.values()) {
    const entry = {
      package: rec.package,
      name: rec.name,
      status: rec.status === "running" ? "error" : rec.status,
      duration_ms: rec.duration_ms,
    };
    if (entry.status === "failed" || entry.status === "error") {
      const joined = rec.output.join("");
      if (joined) {
        entry.failure_message =
          joined.length > RAW_OUTPUT_SNIPPET_MAX ? joined.slice(0, RAW_OUTPUT_SNIPPET_MAX) : joined;
      }
    }
    tests.push(entry);
  }
  return { tests, packageSummaries: pkgSummary };
}

/**
 * Parse `go test -json` output (AC4, AC5).
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {number} exitCode
 * @param {object} [options]
 * @returns {object}
 */
function parseOutput(stdout, stderr, exitCode /*, options = {} */) {
  const stdoutStr = typeof stdout === "string" ? stdout : "";
  const stderrStr = typeof stderr === "string" ? stderr : "";

  const events = parseJsonEventStream(stdoutStr);

  // No parseable events at all — fall back to parse_error record.
  if (events.length === 0) {
    return {
      parse_error: true,
      stderr_snippet: stderrStr.slice(0, STDERR_SNIPPET_MAX),
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      tests: [],
      exit_code: exitCode,
    };
  }

  const { tests } = correlateEvents(events);
  const summary = {
    total: tests.length,
    passed: tests.filter((t) => t.status === "passed").length,
    failed: tests.filter((t) => t.status === "failed").length,
    skipped: tests.filter((t) => t.status === "skipped").length,
  };

  // AC5: partial / panic-truncated stream handling.
  // Non-zero exit with at least one running/error record OR a stderr panic:
  // emit partial evidence record with raw_output_snippet.
  const hasRunning = tests.some((t) => t.status === "error");
  const stderrHasPanic = /\bpanic:/i.test(stderrStr);
  if (exitCode !== 0 && (hasRunning || stderrHasPanic)) {
    return {
      parse_error: false,
      status: "error",
      raw_output_snippet: stderrStr.slice(0, RAW_OUTPUT_SNIPPET_MAX),
      summary,
      tests,
      exit_code: exitCode,
    };
  }

  return { summary, tests, exit_code: exitCode };
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * @type {import('./index.js').StackAdapter}
 */
const goAdapter = {
  name: "go",
  detectionPatterns: DETECTION_PATTERNS,
  // Single required file — default ALL semantics are fine.
  readinessCheck,
  discoverRunners,
  parseOutput,
  // Exposed for E25-S6 per-stack tier mapping consumers.
  resolveTierMapping,
};

export default goAdapter;
