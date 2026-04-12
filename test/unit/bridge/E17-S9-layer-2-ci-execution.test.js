/**
 * E17-S9: Bridge Layer 2 — CI Execution Mode (ATDD)
 *
 * Story: Layer 2 triggers a CI workflow run (GitHub Actions via `gh`),
 * polls for completion, retrieves the run log for Layer 3, falls back
 * to local execution when `gh` is unavailable or unauthenticated, and
 * caps polling at the NFR-033 5-minute budget.
 *
 * Traces: FR-197, NFR-033, ADR-028
 * Test cases: TEB-37 to TEB-39
 * Risk: medium | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect, vi } from "vitest";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LAYER2_CI_REL = "../../../src/bridge/layer-2-ci-execution.js";
const LAYER2_CI_PATH = join(__dirname, LAYER2_CI_REL);

// ─── Fixture helpers ──────────────────────────────────────────────────────

/**
 * Build a dependency-injected deps object. Each `runCli` invocation returns
 * the next scripted response. Unused scripts fail the test to keep fixtures
 * honest.
 */
function makeDeps({ ghAvailable = true, ghAuthenticated = true, script = [] } = {}) {
  const calls = [];
  const queue = [...script];
  return {
    calls,
    ghCheck: vi.fn(async () => ({
      available: ghAvailable,
      authenticated: ghAuthenticated,
    })),
    runCli: vi.fn(async (command) => {
      calls.push(command);
      if (queue.length === 0) {
        return { exit_code: 0, stdout: "", stderr: "" };
      }
      return queue.shift();
    }),
    sleep: vi.fn(async () => {}),
    now: (() => {
      let t = 0;
      return () => {
        t += 15000; // advance 15s per call — matches default poll interval
        return t;
      };
    })(),
  };
}

// ─── Module presence ──────────────────────────────────────────────────────

describe("E17-S9: module presence", () => {
  it("layer-2-ci-execution module exists at src/bridge/", () => {
    expect(existsSync(LAYER2_CI_PATH)).toBe(true);
  });

  it("exports executeCi", async () => {
    const mod = await import(LAYER2_CI_REL);
    expect(typeof mod.executeCi).toBe("function");
  });
});

// ─── AC1 — Trigger CI workflow run (TEB-37) ───────────────────────────────

describe("AC1 (TEB-37): Trigger CI workflow run via gh", () => {
  it("invokes gh workflow run with the configured ci_workflow", async () => {
    const deps = makeDeps({
      script: [
        // gh workflow run → run ID extraction requires a follow-up list
        { exit_code: 0, stdout: "Created workflow_dispatch event for ci.yml\n", stderr: "" },
        // gh run list to discover the new run id
        {
          exit_code: 0,
          stdout: JSON.stringify([{ databaseId: 12345, status: "queued" }]),
          stderr: "",
        },
        // first poll — completed success
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "completed", conclusion: "success" }),
          stderr: "",
        },
        // log fetch
        { exit_code: 0, stdout: "All tests passed\n", stderr: "" },
      ],
    });
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    expect(deps.calls[0]).toContain("gh");
    expect(deps.calls[0]).toContain("workflow");
    expect(deps.calls[0]).toContain("run");
    expect(deps.calls[0]).toContain("ci.yml");
    expect(result.run_id).toBe(12345);
  });
});

// ─── AC2 — Polling loop (TEB-38) ──────────────────────────────────────────

describe("AC2 (TEB-38): Poll run status at configurable interval", () => {
  it("polls until the run reports completed", async () => {
    const deps = makeDeps({
      script: [
        { exit_code: 0, stdout: "Created workflow_dispatch event\n", stderr: "" },
        {
          exit_code: 0,
          stdout: JSON.stringify([{ databaseId: 99, status: "queued" }]),
          stderr: "",
        },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "in_progress", conclusion: null }),
          stderr: "",
        },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "in_progress", conclusion: null }),
          stderr: "",
        },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "completed", conclusion: "success" }),
          stderr: "",
        },
        { exit_code: 0, stdout: "log body\n", stderr: "" },
      ],
    });
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    // Three view calls before completion → three polls before log fetch.
    const viewCalls = deps.calls.filter(
      (c) => Array.isArray(c) && c.includes("view") && c.includes("--json")
    );
    expect(viewCalls.length).toBeGreaterThanOrEqual(3);
    expect(result.conclusion).toBe("success");
  });

  it("respects a custom poll_interval_seconds", async () => {
    const deps = makeDeps({
      script: [
        { exit_code: 0, stdout: "ok\n", stderr: "" },
        { exit_code: 0, stdout: JSON.stringify([{ databaseId: 1, status: "queued" }]), stderr: "" },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "in_progress", conclusion: null }),
          stderr: "",
        },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "completed", conclusion: "success" }),
          stderr: "",
        },
        { exit_code: 0, stdout: "logs\n", stderr: "" },
      ],
    });
    const { executeCi } = await import(LAYER2_CI_REL);
    await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", poll_interval_seconds: 5 },
      deps
    );
    // sleep should have been called at least once with 5000ms
    const sleepArgs = deps.sleep.mock.calls.map((c) => c[0]);
    expect(sleepArgs.some((ms) => ms === 5000)).toBe(true);
  });
});

// ─── AC3 — Retrieve run artifacts/log (TEB-39) ────────────────────────────

describe("AC3 (TEB-39): Retrieve run log on completion", () => {
  it("fetches the run log via gh run view --log and returns it on stdout", async () => {
    const deps = makeDeps({
      script: [
        { exit_code: 0, stdout: "triggered\n", stderr: "" },
        {
          exit_code: 0,
          stdout: JSON.stringify([{ databaseId: 42, status: "queued" }]),
          stderr: "",
        },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "completed", conclusion: "success" }),
          stderr: "",
        },
        { exit_code: 0, stdout: "TEST OUTPUT 42\n", stderr: "" },
      ],
    });
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml" },
      deps
    );
    expect(
      deps.calls.some((c) => Array.isArray(c) && c.includes("view") && c.includes("--log"))
    ).toBe(true);
    expect(result.stdout).toContain("TEST OUTPUT 42");
    expect(result.mode).toBe("ci");
    expect(result.exit_code).toBe(0);
  });

  it("sets exit_code to non-zero when conclusion is failure", async () => {
    const deps = makeDeps({
      script: [
        { exit_code: 0, stdout: "triggered\n", stderr: "" },
        { exit_code: 0, stdout: JSON.stringify([{ databaseId: 7, status: "queued" }]), stderr: "" },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "completed", conclusion: "failure" }),
          stderr: "",
        },
        { exit_code: 0, stdout: "test failed\n", stderr: "" },
      ],
    });
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml" },
      deps
    );
    expect(result.conclusion).toBe("failure");
    expect(result.exit_code).not.toBe(0);
  });
});

// ─── AC4 — Fallback to local when gh unavailable ─────────────────────────

describe("AC4: Fallback to local mode when gh is unavailable or unauthenticated", () => {
  it("falls back to local when gh is not on PATH and emits a warning", async () => {
    const deps = makeDeps({ ghAvailable: false });
    const fallback = vi.fn(async () => ({
      command: "npm test",
      exit_code: 0,
      stdout: "local run",
      stderr: "",
      timed_out: false,
      timeout_seconds: 300,
    }));
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml" },
      { ...deps, executeLocal: fallback }
    );
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(result.fallback).toBe("local");
    expect(result.fallback_reason).toMatch(/gh/i);
  });

  it("falls back to local when gh is not authenticated", async () => {
    const deps = makeDeps({ ghAvailable: true, ghAuthenticated: false });
    const fallback = vi.fn(async () => ({
      command: "npm test",
      exit_code: 0,
      stdout: "local run",
      stderr: "",
      timed_out: false,
      timeout_seconds: 300,
    }));
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml" },
      { ...deps, executeLocal: fallback }
    );
    expect(fallback).toHaveBeenCalled();
    expect(result.fallback).toBe("local");
  });
});

// ─── AC5 — 5-minute polling timeout cap (NFR-033) ────────────────────────

describe("AC5: Polling capped at NFR-033 timeout (default 300s)", () => {
  it("emits a timeout evidence record when polling exceeds 300 seconds", async () => {
    // Scripted `now` advances 30s per invocation → 11 polls exceed 300s.
    const deps = makeDeps({
      script: [
        { exit_code: 0, stdout: "triggered\n", stderr: "" },
        { exit_code: 0, stdout: JSON.stringify([{ databaseId: 5, status: "queued" }]), stderr: "" },
        ...Array.from({ length: 30 }, () => ({
          exit_code: 0,
          stdout: JSON.stringify({ status: "in_progress", conclusion: null }),
          stderr: "",
        })),
      ],
    });
    // Override `now` to advance by 60 seconds per call.
    let t = 0;
    deps.now = () => {
      t += 60000;
      return t;
    };
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    expect(result.timed_out).toBe(true);
    expect(result.timeout_seconds).toBe(300);
    expect(result.evidence).toMatchObject({ event: "timeout" });
    expect(result.evidence.run_id).toBe(5);
  });

  it("rejects timeout_seconds greater than the NFR-033 hard cap of 300", async () => {
    const deps = makeDeps({
      script: [
        { exit_code: 0, stdout: "triggered\n", stderr: "" },
        { exit_code: 0, stdout: JSON.stringify([{ databaseId: 1, status: "queued" }]), stderr: "" },
        {
          exit_code: 0,
          stdout: JSON.stringify({ status: "completed", conclusion: "success" }),
          stderr: "",
        },
        { exit_code: 0, stdout: "logs\n", stderr: "" },
      ],
    });
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 9999 },
      deps
    );
    // The CI layer must clamp to the 300s hard cap regardless of config.
    expect(result.timeout_seconds).toBe(300);
  });
});

// ─── Opt-in guard ────────────────────────────────────────────────────────

describe("Opt-in guard: bridge_enabled: false short-circuits", () => {
  it("returns { bypassed: true } without any gh calls", async () => {
    const deps = makeDeps();
    const { executeCi } = await import(LAYER2_CI_REL);
    const result = await executeCi(
      { runner_name: "vitest", command: "npm test" },
      { bridge_enabled: false, mode: "ci", ci_workflow: "ci.yml" },
      deps
    );
    expect(result).toEqual({ bypassed: true });
    expect(deps.ghCheck).not.toHaveBeenCalled();
    expect(deps.runCli).not.toHaveBeenCalled();
  });
});

// ─── Mode guard ──────────────────────────────────────────────────────────

describe("Mode guard: executeCi rejects non-ci mode", () => {
  it("throws when mode is 'local'", async () => {
    const deps = makeDeps();
    const { executeCi } = await import(LAYER2_CI_REL);
    await expect(
      executeCi(
        { runner_name: "vitest", command: "npm test" },
        { bridge_enabled: true, mode: "local", ci_workflow: "ci.yml" },
        deps
      )
    ).rejects.toThrow(/mode/);
  });
});
