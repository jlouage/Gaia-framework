/**
 * E17-S6: Bridge Layer 2 — Local Execution Mode (ATDD)
 *
 * Story: Layer 2 invokes the discovered runner locally via subprocess,
 * capped at the NFR-033 timeout, captures stdout/stderr/exit code, and
 * respects the bridge_enabled opt-in and local/ci mode guard.
 *
 * Traces: FR-197, FR-203, NFR-033, NFR-035, ADR-028
 * Test cases: TEB-26 to TEB-30
 * Risk: high | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Canonical location for Layer 2 — _gaia/core/bridge/ matches Layer 0 and Layer 1.
const LAYER2_REL = "../../../_gaia/core/bridge/layer-2-local-execution.js";
const LAYER2_PATH = join(__dirname, LAYER2_REL);

// ─── AC1 — Runner Invocation (TEB-26) ──────────────────────────────────────

describe("AC1 (TEB-26): Runner invocation via standard test command", () => {
  it("layer-2-local-execution module exists at _gaia/core/bridge/", () => {
    expect(existsSync(LAYER2_PATH)).toBe(true);
  });

  it("executes the runner command received from the Layer 1 runner manifest", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const runnerManifest = { runner_name: "node", command: 'node -e "process.exit(0)"', tier: 1 };
    const config = { bridge_enabled: true, mode: "local", timeout_seconds: 30 };
    const result = await executeLocal(runnerManifest, config);
    expect(result).toHaveProperty("command");
    expect(result.command).toBe('node -e "process.exit(0)"');
  });

  it("supports echo-style invocation commands", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const runnerManifest = { runner_name: "echo", command: "echo hello", tier: 1 };
    const config = { bridge_enabled: true, mode: "local", timeout_seconds: 30 };
    const result = await executeLocal(runnerManifest, config);
    expect(result.command).toBe("echo hello");
    expect(result.exit_code).toBe(0);
  });
});

// ─── AC2 — Timeout Enforcement (TEB-27) ────────────────────────────────────

describe("AC2 (TEB-27): Timeout enforcement at configured seconds", () => {
  it("accepts timeout_seconds from config and reports it back", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "echo", command: "echo ok", tier: 1 },
      { bridge_enabled: true, mode: "local", timeout_seconds: 300 }
    );
    expect(result).toHaveProperty("timeout_seconds");
    expect(result.timeout_seconds).toBe(300);
  });

  it("enforces the timeout and does not run indefinitely", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "sleeper", command: "sleep 10", tier: 1 },
      { bridge_enabled: true, mode: "local", timeout_seconds: 1 }
    );
    expect(result.timed_out).toBe(true);
  }, 15000);
});

// ─── AC3 — Graceful Timeout with Evidence (TEB-28) ────────────────────────

describe("AC3 (TEB-28): Graceful timeout with evidence record", () => {
  it("emits a timeout evidence record when execution exceeds timeout_seconds", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "sleeper", command: "sleep 10", tier: 1 },
      { bridge_enabled: true, mode: "local", timeout_seconds: 1 }
    );
    expect(result.timed_out).toBe(true);
    expect(result).toHaveProperty("evidence");
    expect(result.evidence).toHaveProperty("event", "timeout");
    expect(result.evidence).toHaveProperty("timeout_seconds", 1);
    expect(result.evidence).toHaveProperty("runner", "sleeper");
    expect(result.evidence).toHaveProperty("terminated_at");
    // terminated_at must be ISO 8601 parseable
    expect(Number.isNaN(Date.parse(result.evidence.terminated_at))).toBe(false);
  }, 15000);

  it("records the termination signal (SIGTERM | SIGKILL | graceful)", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "sleeper", command: "sleep 10", tier: 1 },
      { bridge_enabled: true, mode: "local", timeout_seconds: 1 }
    );
    expect(result.evidence).toHaveProperty("termination_signal");
    expect(["SIGTERM", "SIGKILL", "graceful"]).toContain(result.evidence.termination_signal);
  }, 15000);
});

// ─── AC4 — stdout/stderr Capture (TEB-29) ─────────────────────────────────

describe("AC4 (TEB-29): stdout/stderr capture", () => {
  it("captures stdout from runner execution", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "echo", command: "echo hello-stdout", tier: 1 },
      { bridge_enabled: true, mode: "local", timeout_seconds: 30 }
    );
    expect(result).toHaveProperty("stdout");
    expect(typeof result.stdout).toBe("string");
    expect(result.stdout).toContain("hello-stdout");
  });

  it("captures stderr from runner execution", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      {
        runner_name: "node",
        command: "node -e \"process.stderr.write('hello-stderr'); process.exit(0)\"",
        tier: 1,
      },
      { bridge_enabled: true, mode: "local", timeout_seconds: 30 }
    );
    expect(result).toHaveProperty("stderr");
    expect(typeof result.stderr).toBe("string");
    expect(result.stderr).toContain("hello-stderr");
  });

  it("captures stdout and stderr even when runner exits non-zero", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      {
        runner_name: "node",
        command: "node -e \"console.log('out'); console.error('err'); process.exit(7)\"",
        tier: 1,
      },
      { bridge_enabled: true, mode: "local", timeout_seconds: 30 }
    );
    expect(result.stdout).toContain("out");
    expect(result.stderr).toContain("err");
    expect(result.exit_code).toBe(7);
  });
});

// ─── AC5 — Exit Code Capture (TEB-30) ─────────────────────────────────────

describe("AC5 (TEB-30): Exit code capture and interpretation", () => {
  it("result includes the numeric exit_code from the runner process", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "echo", command: "echo ok", tier: 1 },
      { bridge_enabled: true, mode: "local", timeout_seconds: 30 }
    );
    expect(result).toHaveProperty("exit_code");
    expect(typeof result.exit_code).toBe("number");
    expect(result.exit_code).toBe(0);
  });

  it("interprets exit_code 0 as all tests passing", async () => {
    const { interpretExitCode } = await import(LAYER2_REL);
    expect(interpretExitCode(0)).toBe("pass");
  });

  it("interprets non-zero exit_code as test failures present", async () => {
    const { interpretExitCode } = await import(LAYER2_REL);
    expect(interpretExitCode(1)).toBe("fail");
    expect(interpretExitCode(2)).toBe("fail");
    expect(interpretExitCode(127)).toBe("fail");
  });
});

// ─── AC6 — Mode Guard ──────────────────────────────────────────────────────

describe("AC6: Mode guard — local mode only", () => {
  it("rejects when called with mode: ci", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    await expect(
      executeLocal(
        { runner_name: "echo", command: "echo ok", tier: 1 },
        { bridge_enabled: true, mode: "ci", timeout_seconds: 30 }
      )
    ).rejects.toThrow(/mode/i);
  });

  it("executes normally when mode is local", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "echo", command: "echo ok", tier: 1 },
      { bridge_enabled: true, mode: "local", timeout_seconds: 30 }
    );
    expect(result).toHaveProperty("exit_code", 0);
  });
});

// ─── AC7 — bridge_enabled: false Bypass (NFR-035) ─────────────────────────

describe("AC7 (NFR-035): bridge_enabled: false bypasses all execution", () => {
  it("returns a bypass result without executing any subprocess", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "echo", command: "echo should-not-run", tier: 1 },
      { bridge_enabled: false, mode: "local", timeout_seconds: 30 }
    );
    expect(result).toHaveProperty("bypassed", true);
    expect(result).not.toHaveProperty("exit_code");
  });

  it("bypass produces no stdout, no stderr, and no evidence record", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "echo", command: "echo should-not-run", tier: 1 },
      { bridge_enabled: false, mode: "local", timeout_seconds: 30 }
    );
    expect(result.bypassed).toBe(true);
    expect(result.stdout).toBeUndefined();
    expect(result.stderr).toBeUndefined();
    expect(result.evidence).toBeUndefined();
  });

  it("bypass result is returned even when mode is absent from config", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    const result = await executeLocal(
      { runner_name: "echo", command: "echo should-not-run", tier: 1 },
      { bridge_enabled: false }
    );
    expect(result).toHaveProperty("bypassed", true);
  });
});

// ─── Scope Guard (FR-203) ──────────────────────────────────────────────────

describe("Scope guard (FR-203): rejects dangerous commands", () => {
  it("rejects commands containing shell chaining operators", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    await expect(
      executeLocal(
        { runner_name: "evil", command: "echo ok; rm -rf /tmp/does-not-exist", tier: 1 },
        { bridge_enabled: true, mode: "local", timeout_seconds: 30 }
      )
    ).rejects.toThrow(/scope/i);
  });

  it("rejects commands containing command substitution", async () => {
    const { executeLocal } = await import(LAYER2_REL);
    await expect(
      executeLocal(
        { runner_name: "evil", command: "echo $(whoami)", tier: 1 },
        { bridge_enabled: true, mode: "local", timeout_seconds: 30 }
      )
    ).rejects.toThrow(/scope/i);
  });
});
