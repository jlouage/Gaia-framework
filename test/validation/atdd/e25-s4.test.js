/**
 * ATDD: E25-S4 — Flutter and Dart Stack Adapter
 *
 * Acceptance tests for the Flutter/Dart stack adapter plugging into the
 * E25-S5 registry. Covers TEB-MS-F01..F06.
 *
 * AC coverage: AC1 (contract + patterns + registry), AC2 (readinessCheck),
 *              AC3 (discoverRunners flutter/dart branching),
 *              AC4 (parseOutput JSON event stream + correlation by testID),
 *              AC5 (truncated stream / SIGTERM → incomplete + event=timeout),
 *              AC6 (Tier 1/Tier 3 split when integration_test/ present),
 *              AC7 (all-tier fallback when integration_test/ absent).
 *
 * Traces to: FR-311, NFR-047, ADR-028, ADR-038
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const BRIDGE_DIR = join(PROJECT_ROOT, "src", "bridge");
const ADAPTERS_DIR = join(BRIDGE_DIR, "adapters");
const REGISTRY_PATH = join(ADAPTERS_DIR, "index.js");
const FLUTTER_ADAPTER_PATH = join(ADAPTERS_DIR, "flutter-adapter.js");

const FIXTURES = join(PROJECT_ROOT, "test", "fixtures", "bridge", "flutter");

// Fake execFileSync factory — controls flutter/dart availability independently.
function makeFakeExec({ flutterOk = true, dartOk = true } = {}) {
  const calls = [];
  function fake(cmd, args /*, opts */) {
    calls.push({ cmd, args });
    if (cmd === "flutter") {
      if (!flutterOk) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return Buffer.from("Flutter 3.16.0\n", "utf8");
    }
    if (cmd === "dart") {
      if (!dartOk) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return Buffer.from("Dart SDK version: 3.2.0\n", "utf8");
    }
    const err = new Error("unknown command " + cmd);
    err.code = "ENOENT";
    throw err;
  }
  return { fake, calls };
}

// ─── AC1: Contract compliance (TEB-MS-F01) ──────────────────────────────────

describe("E25-S4 AC1: adapter contract and detection patterns", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(FLUTTER_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("flutter-adapter.js exists", () => {
    expect(existsSync(FLUTTER_ADAPTER_PATH)).toBe(true);
  });

  it("exports default object with name 'flutter'", () => {
    expect(adapter.name).toBe("flutter");
  });

  it("detectionPatterns contains pubspec.yaml", () => {
    expect(adapter.detectionPatterns).toEqual(["pubspec.yaml"]);
  });

  it("exports all three StackAdapter contract functions", () => {
    expect(typeof adapter.readinessCheck).toBe("function");
    expect(typeof adapter.discoverRunners).toBe("function");
    expect(typeof adapter.parseOutput).toBe("function");
  });

  it("is registered by the registry immediately after the go adapter", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const names = reg.listAdapters().map((a) => a.name);
    expect(names).toContain("flutter");
    expect(names.indexOf("flutter")).toBe(names.indexOf("go") + 1);
  });

  it("getAdapter() matches a Flutter project", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const picked = reg.getAdapter(join(FIXTURES, "widget"));
    expect(picked).not.toBeNull();
    expect(picked.name).toBe("flutter");
  });
});

// ─── AC2: readinessCheck (TEB-MS-F02) ───────────────────────────────────────

describe("E25-S4 AC2: readinessCheck success and failure modes", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(FLUTTER_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("flutter project with flutter on PATH returns passed=true", () => {
    const { fake } = makeFakeExec({ flutterOk: true });
    const result = adapter.readinessCheck(join(FIXTURES, "widget"), { _execFile: fake });
    expect(result.passed).toBe(true);
    expect(result.remediation).toBeNull();
  });

  it("pure dart project with dart on PATH returns passed=true", () => {
    const { fake } = makeFakeExec({ dartOk: true });
    const result = adapter.readinessCheck(join(FIXTURES, "dart-lib"), { _execFile: fake });
    expect(result.passed).toBe(true);
    expect(result.remediation).toBeNull();
  });

  it("flutter project missing flutter CLI returns Flutter-specific remediation", () => {
    const { fake } = makeFakeExec({ flutterOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "widget"), { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/flutter CLI not found/);
    expect(result.remediation).toMatch(/Flutter SDK/);
  });

  it("pure dart project missing dart CLI returns Dart-specific remediation", () => {
    const { fake } = makeFakeExec({ dartOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "dart-lib"), { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/dart CLI not found/);
    expect(result.remediation).toMatch(/Dart SDK/);
  });

  it("missing pubspec.yaml returns pubspec remediation", () => {
    const { fake } = makeFakeExec({ flutterOk: true });
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s4-"));
    const result = adapter.readinessCheck(tmp, { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/pubspec\.yaml/);
  });

  it("bridge_enabled=false short-circuits to skipped passing result", () => {
    const { fake } = makeFakeExec({ flutterOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "widget"), {
      _execFile: fake,
      test_execution_bridge: { bridge_enabled: false },
    });
    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
  });
});

// ─── AC3: discoverRunners — flutter vs dart branching (TEB-MS-F03) ──────────

describe("E25-S4 AC3: discoverRunners — flutter vs dart command selection", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(FLUTTER_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("flutter project selects `flutter test --machine`", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "widget"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("flutter test --machine");
    expect(result.primary.runner_name).toBe("flutter-test");
  });

  it("pure dart project selects `dart test --reporter json`", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "dart-lib"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("dart test --reporter json");
    expect(result.primary.runner_name).toBe("dart-test");
  });

  it("returns error status when pubspec.yaml is missing", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s4-nopub-"));
    const result = await adapter.discoverRunners(tmp, {});
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/pubspec\.yaml/);
  });
});

// ─── AC4: parseOutput streaming JSON (TEB-MS-F04) ───────────────────────────

describe("E25-S4 AC4: parseOutput streaming JSON events", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(FLUTTER_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("parses passing flutter widget test stream into tests + summary", () => {
    const stdout = readFileSync(join(FIXTURES, "widget", "stdout.json"), "utf8");
    const result = adapter.parseOutput(stdout, "", 0);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.incomplete).toBe(0);
    expect(result.tests).toHaveLength(2);
    expect(result.tests[0].status).toBe("passed");
    expect(result.tests[0].duration_ms).toBeGreaterThan(0);
    expect(result.tests[0].name).toMatch(/loading screen/);
  });

  it("parses dart test stream with failure and skip; folds error event into failure_message", () => {
    const stdout = readFileSync(join(FIXTURES, "dart-lib", "stdout.json"), "utf8");
    const result = adapter.parseOutput(stdout, "", 1);
    expect(result.summary.total).toBe(3);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.skipped).toBe(1);
    const failed = result.tests.find((t) => t.status === "failed");
    expect(failed).toBeDefined();
    expect(failed.failure_message).toMatch(/Expected/);
  });

  it("correlates testStart and testDone by integer testID, not by name", () => {
    // Two groups each with a test named "same name" — correlation must use IDs.
    const stream =
      [
        {
          type: "testStart",
          test: { id: 1, name: "same name", suiteID: 0, groupIDs: [10] },
          time: 0,
        },
        {
          type: "testStart",
          test: { id: 2, name: "same name", suiteID: 0, groupIDs: [11] },
          time: 1,
        },
        { type: "testDone", testID: 1, result: "success", skipped: false, hidden: false, time: 10 },
        { type: "testDone", testID: 2, result: "failure", skipped: false, hidden: false, time: 20 },
        { type: "error", testID: 2, error: "assertion failed", stackTrace: "at line 5", time: 19 },
        { type: "done", success: false, time: 25 },
      ]
        .map((e) => JSON.stringify(e))
        .join("\n") + "\n";
    const result = adapter.parseOutput(stream, "", 1);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
    const failed = result.tests.find((t) => t.status === "failed");
    expect(failed.failure_message).toMatch(/assertion failed/);
  });

  it("returns parse_error=true with stderr snippet when stdout has no JSON", () => {
    const result = adapter.parseOutput("", "no runner output\n" + "x".repeat(5000), 2);
    expect(result.parse_error).toBe(true);
    expect(result.stderr_snippet.length).toBeLessThanOrEqual(2048);
    expect(result.stderr_snippet).toContain("no runner output");
  });

  it("ignores interleaved print events without breaking correlation", () => {
    const stream =
      [
        { type: "testStart", test: { id: 5, name: "t", suiteID: 0, groupIDs: [] }, time: 0 },
        { type: "print", testID: 5, messageType: "print", message: "noise", time: 5 },
        { type: "testDone", testID: 5, result: "success", skipped: false, hidden: false, time: 10 },
        { type: "done", success: true, time: 11 },
      ]
        .map((e) => JSON.stringify(e))
        .join("\n") + "\n";
    const result = adapter.parseOutput(stream, "", 0);
    expect(result.summary.passed).toBe(1);
  });
});

// ─── AC5: Truncated stream / SIGTERM (TEB-MS-F05) ───────────────────────────

describe("E25-S4 AC5: truncated event stream (SIGTERM mid-run)", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(FLUTTER_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("marks unmatched testStart as incomplete and sets event=timeout", () => {
    const stdout = readFileSync(join(FIXTURES, "truncated", "stdout.json"), "utf8");
    const stderr = readFileSync(join(FIXTURES, "truncated", "stderr.txt"), "utf8");
    const result = adapter.parseOutput(stdout, stderr, 143);
    expect(result.parse_error).toBe(false);
    // fast test completed; slow hang test has testStart but no testDone.
    const fast = result.tests.find((t) => t.name === "fast test");
    const slow = result.tests.find((t) => t.name === "slow hang test");
    expect(fast.status).toBe("passed");
    expect(slow.status).toBe("incomplete");
    expect(result.summary.incomplete).toBeGreaterThanOrEqual(1);
    expect(result.event).toBe("timeout");
  });

  it("honors explicit Layer-2 timeout signal via options.event", () => {
    const stdout =
      JSON.stringify({
        type: "testStart",
        test: { id: 1, name: "hang", suiteID: 0, groupIDs: [] },
        time: 0,
      }) + "\n";
    const result = adapter.parseOutput(stdout, "SIGTERM\n", 143, { event: "timeout" });
    expect(result.event).toBe("timeout");
    expect(result.tests[0].status).toBe("incomplete");
    expect(result.raw_output_snippet).toContain("SIGTERM");
  });

  it("tolerates a malformed final line without crashing", () => {
    const stdout =
      JSON.stringify({
        type: "testStart",
        test: { id: 1, name: "t", suiteID: 0, groupIDs: [] },
        time: 0,
      }) +
      "\n" +
      '{"type":"testStart","test":{"id":2,"na'; // truncated
    const result = adapter.parseOutput(stdout, "", 143);
    expect(result.parse_error).toBe(false);
    expect(result.tests.length).toBe(1);
    expect(result.tests[0].status).toBe("incomplete");
  });
});

// ─── AC6/AC7: Tier mapping (TEB-MS-F06) ─────────────────────────────────────

describe("E25-S4 AC6/AC7: tier mapping based on integration_test/ presence", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(FLUTTER_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("Flutter project with integration_test/ emits Tier 1 + Tier 3, no Tier 2", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "flutter-with-integration"), {});
    expect(result.status).toBe("ok");
    expect(result.manifest.mode).toBe("flutter-tiered");
    expect(result.manifest.runners).toHaveLength(2);
    const tiers = result.manifest.runners.map((r) => r.tier);
    expect(tiers).toContain("unit");
    expect(tiers).toContain("e2e");
    expect(tiers).not.toContain("integration");
    // C1 regression: Tier 3 runner must include --machine flag so parseOutput
    // can consume JSON output instead of hitting the parse_error branch.
    expect(result.manifest.runners[0].command).toBe("flutter test --machine test/");
    expect(result.manifest.runners[1].command).toBe("flutter test --machine integration_test/");
  });

  it("Flutter project without integration_test/ collapses to single all-tier with fallback log", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "flutter-no-integration"), {});
    expect(result.status).toBe("ok");
    expect(result.manifest.mode).toBe("flutter-all");
    expect(result.manifest.runners).toHaveLength(1);
    expect(result.primary.tier).toBe("all");
    expect(result.manifest.log).toMatch(/all-tier fallback/);
  });

  it("Pure Dart library collapses to single all-tier dart runner", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "dart-lib"), {});
    expect(result.status).toBe("ok");
    expect(result.manifest.mode).toBe("dart-all");
    expect(result.primary.command).toBe("dart test --reporter json");
    expect(result.primary.tier).toBe("all");
  });
});
