/**
 * ATDD: E25-S3 — Go Stack Adapter
 *
 * Acceptance tests for the Go stack adapter plugging into the E25-S5
 * registry. Covers TEB-MS-G01..G06.
 *
 * AC coverage: AC1 (contract + patterns + registry), AC2 (readinessCheck),
 *              AC3 (discoverRunners single-module), AC4 (parseOutput JSON stream),
 *              AC5 (panic / partial stream handling), AC6 (build-tag tier mapping),
 *              AC7 (monorepo enumeration + registry init budget).
 *
 * Traces to: FR-307, FR-310, NFR-047, ADR-028, ADR-038
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const BRIDGE_DIR = join(PROJECT_ROOT, "_gaia", "core", "bridge");
const ADAPTERS_DIR = join(BRIDGE_DIR, "adapters");
const REGISTRY_PATH = join(ADAPTERS_DIR, "index.js");
const GO_ADAPTER_PATH = join(ADAPTERS_DIR, "go-adapter.js");

const FIXTURES = join(PROJECT_ROOT, "test", "fixtures", "bridge", "go");

// Fake execFileSync factory — controls whether `go version` succeeds.
function makeFakeExec({ goOk = true } = {}) {
  const calls = [];
  function fake(cmd, args /*, opts */) {
    calls.push({ cmd, args });
    if (cmd === "go") {
      if (!goOk) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return Buffer.from("go version go1.22.0\n", "utf8");
    }
    const err = new Error("unknown command " + cmd);
    err.code = "ENOENT";
    throw err;
  }
  return { fake, calls };
}

// ─── AC1: Contract compliance (TEB-MS-G01) ──────────────────────────────────

describe("E25-S3 AC1: adapter contract and detection patterns", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(GO_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("go-adapter.js exists", () => {
    expect(existsSync(GO_ADAPTER_PATH)).toBe(true);
  });

  it("exports default object with name 'go'", () => {
    expect(adapter.name).toBe("go");
  });

  it("detectionPatterns contains go.mod", () => {
    expect(adapter.detectionPatterns).toEqual(["go.mod"]);
  });

  it("exports all three StackAdapter contract functions", () => {
    expect(typeof adapter.readinessCheck).toBe("function");
    expect(typeof adapter.discoverRunners).toBe("function");
    expect(typeof adapter.parseOutput).toBe("function");
  });

  it("is registered by the registry immediately after the java adapter", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const names = reg.listAdapters().map((a) => a.name);
    expect(names).toContain("go");
    expect(names.indexOf("go")).toBe(names.indexOf("java") + 1);
  });

  it("getAdapter() matches a Go project", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const picked = reg.getAdapter(join(FIXTURES, "single-module-pass"));
    expect(picked).not.toBeNull();
    expect(picked.name).toBe("go");
  });
});

// ─── AC2: readinessCheck (TEB-MS-G02) ───────────────────────────────────────

describe("E25-S3 AC2: readinessCheck success and failure modes", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(GO_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("go on PATH and go.mod present returns passed=true", () => {
    const { fake } = makeFakeExec({ goOk: true });
    const result = adapter.readinessCheck(join(FIXTURES, "single-module-pass"), {
      _execFile: fake,
    });
    expect(result.passed).toBe(true);
    expect(result.remediation).toBeNull();
  });

  it("go missing from PATH returns Go install remediation", () => {
    const { fake } = makeFakeExec({ goOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "single-module-pass"), {
      _execFile: fake,
    });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/Go not found/);
    expect(result.remediation).toMatch(/go\.dev\/dl/);
  });

  it("missing go.mod returns go.mod remediation", () => {
    const { fake } = makeFakeExec({ goOk: true });
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s3-"));
    const result = adapter.readinessCheck(tmp, { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/go\.mod/);
  });

  it("bridge_enabled=false short-circuits to skipped passing result", () => {
    const { fake } = makeFakeExec({ goOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "single-module-pass"), {
      _execFile: fake,
      test_execution_bridge: { bridge_enabled: false },
    });
    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
  });
});

// ─── AC3: discoverRunners single-module (TEB-MS-G03) ────────────────────────

describe("E25-S3 AC3: discoverRunners — single module", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(GO_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("returns primary command `go test -json ./...` mapped to unit tier", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "single-module-pass"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("go test -json ./...");
    expect(result.primary.tier).toBe("unit");
    expect(result.primary.runner_name).toBe("go-test");
    expect(result.manifest.mode).toBe("single-module");
    expect(result.manifest.runners).toHaveLength(1);
  });

  it("returns error status when go.mod is missing", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s3-nomod-"));
    const result = await adapter.discoverRunners(tmp, {});
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/go\.mod/);
  });
});

// ─── AC4: parseOutput streaming JSON (TEB-MS-G04) ───────────────────────────

describe("E25-S3 AC4: parseOutput streaming JSON events", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(GO_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("parses passing go test -json stream into tests + summary", () => {
    const stdout = readFileSync(join(FIXTURES, "single-module-pass", "stdout.json"), "utf8");
    const result = adapter.parseOutput(stdout, "", 0);
    expect(result.summary).toEqual({ total: 2, passed: 2, failed: 0, skipped: 0 });
    expect(result.tests).toHaveLength(2);
    expect(result.tests[0].status).toBe("passed");
    expect(result.tests[0].duration_ms).toBeGreaterThan(0);
    expect(result.tests[0].name).toMatch(/TestAdd/);
  });

  it("correlates events by (Package, Test) across interleaved output", () => {
    const stream =
      [
        { Action: "run", Package: "ex/pkg", Test: "A" },
        { Action: "run", Package: "ex/pkg", Test: "B" },
        {
          Action: "output",
          Package: "ex/pkg",
          Test: "A",
          Output: "hello from A\n",
        },
        {
          Action: "output",
          Package: "ex/pkg",
          Test: "B",
          Output: "hello from B\n",
        },
        { Action: "fail", Package: "ex/pkg", Test: "A", Elapsed: 0.1 },
        { Action: "pass", Package: "ex/pkg", Test: "B", Elapsed: 0.2 },
      ]
        .map((e) => JSON.stringify(e))
        .join("\n") + "\n";
    const result = adapter.parseOutput(stream, "", 1);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
    const failed = result.tests.find((t) => t.status === "failed");
    expect(failed.failure_message).toMatch(/hello from A/);
    const passed = result.tests.find((t) => t.status === "passed");
    expect(passed.duration_ms).toBe(200);
  });

  it("returns parse_error=true with stderr snippet when stdout has no JSON", () => {
    const result = adapter.parseOutput("", "boom\n" + "x".repeat(5000), 2);
    expect(result.parse_error).toBe(true);
    expect(result.stderr_snippet.length).toBeLessThanOrEqual(2048);
    expect(result.stderr_snippet).toContain("boom");
  });
});

// ─── AC5: Panic mid-suite (TEB-MS-G05) ──────────────────────────────────────

describe("E25-S3 AC5: panic mid-suite — partial stream", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(GO_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("emits partial evidence with parse_error=false and raw_output_snippet from stderr", () => {
    const stdout = readFileSync(join(FIXTURES, "single-module-panic", "stdout.json"), "utf8");
    const stderr = readFileSync(join(FIXTURES, "single-module-panic", "stderr.txt"), "utf8");
    const result = adapter.parseOutput(stdout, stderr, 2);
    expect(result.parse_error).toBe(false);
    expect(result.status).toBe("error");
    expect(result.raw_output_snippet).toContain("panic:");
    expect(result.raw_output_snippet.length).toBeLessThanOrEqual(2048);
    // TestOk recorded as passed; TestCrash recorded as error (never terminated).
    expect(result.tests.some((t) => t.name.endsWith(".TestOk") && t.status === "passed")).toBe(
      true
    );
    expect(result.tests.some((t) => t.name.endsWith(".TestCrash") && t.status === "error")).toBe(
      true
    );
  });
});

// ─── AC6: Build-tag tier mapping ────────────────────────────────────────────

describe("E25-S3 AC6: build-tag tier mapping", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(GO_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("maps untagged → unit, integration → integration, e2e → e2e", () => {
    const { tierByFile } = adapter.resolveTierMapping(join(FIXTURES, "tagged-tests"));
    const entries = Array.from(tierByFile.entries());
    const unitEntry = entries.find(([f]) => f.endsWith("unit_test.go"));
    const integEntry = entries.find(([f]) => f.endsWith("integration_test.go"));
    const e2eEntry = entries.find(([f]) => f.endsWith("e2e_test.go"));
    expect(unitEntry[1]).toBe("unit");
    expect(integEntry[1]).toBe("integration");
    expect(e2eEntry[1]).toBe("e2e");
  });

  it("honors stack_hints override for custom tag names", () => {
    const { tierByFile } = adapter.resolveTierMapping(join(FIXTURES, "tagged-tests"), {
      stackHints: { integration: "e2e", e2e: "integration" },
    });
    const entries = Array.from(tierByFile.entries());
    // With swapped mapping, files tagged "integration" now resolve to integration
    // (because the mapping.integration key maps to the "e2e" tag name —
    // swapped interpretation: mapping key defines which source tag counts as
    // which tier). Just assert the overrides yield differing results.
    const integEntry = entries.find(([f]) => f.endsWith("integration_test.go"));
    const e2eEntry = entries.find(([f]) => f.endsWith("e2e_test.go"));
    // With swap, integration_test.go (tag "integration") should now be e2e
    // because mapping.e2e === "integration".
    expect(integEntry[1]).toBe("e2e");
    expect(e2eEntry[1]).toBe("integration");
  });
});

// ─── AC7: Monorepo + registry init performance (TEB-MS-G06) ─────────────────

describe("E25-S3 AC7: monorepo enumeration and registry init budget", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(GO_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("enumerates nested go.mod modules in a monorepo", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "multi-module"), {});
    expect(result.status).toBe("ok");
    expect(result.manifest.mode).toBe("multi-module");
    expect(result.manifest.modules.length).toBeGreaterThanOrEqual(3); // root + a + b
    expect(result.manifest.modules).toContain(".");
    expect(result.manifest.modules.some((m) => m.endsWith("module-a"))).toBe(true);
    expect(result.manifest.modules.some((m) => m.endsWith("module-b"))).toBe(true);
    expect(result.manifest.runners.length).toBe(result.manifest.modules.length);
  });

  it("registry listAdapters() p95 under 50ms over 100 warm runs with go adapter registered", async () => {
    const { listAdapters } = await import(REGISTRY_PATH + "?bust=warmup-" + Date.now());
    listAdapters();
    const timings = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      listAdapters();
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});
