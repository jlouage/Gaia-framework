/**
 * E17-S13: Bridge Scope Constraint Enforcement (ATDD)
 *
 * Story: Enforce FR-203 scope constraints across Layer 2 (local + CI):
 * - Bridge executes test runners ONLY — never deploys, never alters infra
 * - Layer 2 local only invokes commands on an explicit allowlist
 * - Layer 2 CI only triggers workflows on an explicit allowlist
 * - Shell operator injection guard is shared by both layers
 *
 * Traces: FR-203, ADR-028, Threats T20–T24
 * Risk: medium | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GUARD_REL = "../../../_gaia/core/bridge/bridge-scope-guard.js";
const GUARD_PATH = join(__dirname, GUARD_REL);
const LAYER2_LOCAL_REL = "../../../_gaia/core/bridge/layer-2-local-execution.js";
const LAYER2_CI_REL = "../../../_gaia/core/bridge/layer-2-ci-execution.js";

// ─── AC1 — Documentation (scope constraint stated) ─────────────────────────

describe("AC1: Bridge scope constraint is documented", () => {
  it("Gaia-framework/CLAUDE.md contains a Bridge Scope section stating the constraint", () => {
    const claudeMd = readFileSync(join(__dirname, "../../../CLAUDE.md"), "utf8");
    expect(claudeMd).toMatch(/##\s+Bridge Scope/i);
    expect(claudeMd.toLowerCase()).toContain("orchestrate");
    expect(claudeMd.toLowerCase()).toContain("test");
    expect(claudeMd.toLowerCase()).toMatch(/does not deploy|never deploy/);
    expect(claudeMd.toLowerCase()).toMatch(/infrastructure|database/);
  });
});

// ─── AC2 — Layer 2 local command whitelist ─────────────────────────────────

describe("AC2: Layer 2 local only invokes whitelisted commands", () => {
  it("bridge-scope-guard module exists at _gaia/core/bridge/", () => {
    expect(existsSync(GUARD_PATH)).toBe(true);
  });

  it("assertCommandAllowed passes for commands on the allowed list", async () => {
    const { assertCommandAllowed } = await import(GUARD_REL);
    expect(() =>
      assertCommandAllowed("npx vitest run", ["npx vitest run", "npm test"])
    ).not.toThrow();
  });

  it("assertCommandAllowed rejects commands not on the allowed list", async () => {
    const { assertCommandAllowed } = await import(GUARD_REL);
    expect(() => assertCommandAllowed("rm -rf /", ["npx vitest run"])).toThrow(/scope violation/i);
  });

  it("assertCommandAllowed rejects when allowed list is empty", async () => {
    const { assertCommandAllowed } = await import(GUARD_REL);
    expect(() => assertCommandAllowed("npm test", [])).toThrow(/scope violation/i);
  });

  it("executeLocal rejects arbitrary commands when allowedCommands is supplied", async () => {
    const { executeLocal } = await import(LAYER2_LOCAL_REL);
    const runnerManifest = {
      runner_name: "evil",
      command: "rm -rf node_modules",
      tier: 1,
    };
    const config = {
      bridge_enabled: true,
      mode: "local",
      allowedCommands: ["npx vitest run"],
    };
    await expect(executeLocal(runnerManifest, config)).rejects.toThrow(/scope violation/i);
  });

  it("executeLocal accepts whitelisted commands when allowedCommands is supplied", async () => {
    const { executeLocal } = await import(LAYER2_LOCAL_REL);
    const runnerManifest = {
      runner_name: "node",
      command: 'node -e "process.exit(0)"',
      tier: 1,
    };
    const config = {
      bridge_enabled: true,
      mode: "local",
      timeout_seconds: 10,
      allowedCommands: ['node -e "process.exit(0)"'],
    };
    const result = await executeLocal(runnerManifest, config);
    expect(result.exit_code).toBe(0);
  });

  it("executeLocal preserves backward compatibility when allowedCommands is absent", async () => {
    const { executeLocal } = await import(LAYER2_LOCAL_REL);
    const runnerManifest = {
      runner_name: "node",
      command: 'node -e "process.exit(0)"',
      tier: 1,
    };
    const config = { bridge_enabled: true, mode: "local", timeout_seconds: 10 };
    const result = await executeLocal(runnerManifest, config);
    expect(result.exit_code).toBe(0);
  });
});

// ─── AC3 — Layer 2 CI workflow whitelist ───────────────────────────────────

describe("AC3: Layer 2 CI only triggers whitelisted workflows", () => {
  it("assertCiWorkflowAllowed passes for whitelisted workflow", async () => {
    const { assertCiWorkflowAllowed } = await import(GUARD_REL);
    expect(() => assertCiWorkflowAllowed("test.yml", ["test.yml"])).not.toThrow();
  });

  it("assertCiWorkflowAllowed rejects unlisted workflow", async () => {
    const { assertCiWorkflowAllowed } = await import(GUARD_REL);
    expect(() => assertCiWorkflowAllowed("deploy.yml", ["test.yml"])).toThrow(/scope violation/i);
  });

  it("assertCiWorkflowAllowed rejects non-string workflow", async () => {
    const { assertCiWorkflowAllowed } = await import(GUARD_REL);
    expect(() => assertCiWorkflowAllowed(null, ["test.yml"])).toThrow(/scope violation/i);
  });

  it("assertCiWorkflowAllowed rejects workflow with shell metacharacters", async () => {
    const { assertCiWorkflowAllowed } = await import(GUARD_REL);
    expect(() => assertCiWorkflowAllowed("test.yml; rm -rf /", ["test.yml; rm -rf /"])).toThrow(
      /scope violation/i
    );
  });

  it("executeCi rejects non-whitelisted ci_workflow when allowedWorkflows is supplied", async () => {
    const { executeCi } = await import(LAYER2_CI_REL);
    const runnerManifest = { runner_name: "vitest", command: "npx vitest run", tier: 2 };
    const config = {
      bridge_enabled: true,
      mode: "ci",
      ci_workflow: "deploy.yml",
      allowedWorkflows: ["test.yml"],
    };
    const deps = {
      ghCheck: async () => ({ available: true, authenticated: true }),
      runCli: async () => ({ exit_code: 0, stdout: "[]", stderr: "" }),
      sleep: async () => {},
      now: () => 0,
    };
    await expect(executeCi(runnerManifest, config, deps)).rejects.toThrow(/scope violation/i);
  });
});

// ─── AC4 — Threat model T20–T24 in architecture §10.20 ─────────────────────
//
// The authoritative architecture.md lives at {project-root}/docs/planning-
// artifacts/architecture.md — outside the git repo on dev machines, and
// absent from CI runners entirely. AC4 is enforced two ways:
//   1. Locally: if the framework-instance architecture.md is present, verify
//      it contains §10.20.10 and T20–T24.
//   2. Everywhere (including CI): CLAUDE.md (shipped with the product) must
//      reference the threat model so reviewers can find it. This ensures
//      AC4 cannot silently regress even when the architecture file is not
//      available to the test runner.

describe("AC4: Threat model T20–T24 is documented in architecture §10.20", () => {
  it("CLAUDE.md references the §10.20.10 threat model and T20–T24", () => {
    const claudeMd = readFileSync(join(__dirname, "../../../CLAUDE.md"), "utf8");
    expect(claudeMd).toMatch(/§10\.20\.10|10\.20\.10/);
    for (const id of ["T20", "T21", "T22", "T23", "T24"]) {
      expect(claudeMd).toContain(id);
    }
  });

  it("architecture.md has a §10.20.10 threat model subsection with T20–T24 (local only)", () => {
    const archPath = join(__dirname, "../../../../docs/planning-artifacts/architecture.md");
    if (!existsSync(archPath)) {
      // Architecture file is a framework-instance artifact; not present in CI.
      return;
    }
    const arch = readFileSync(archPath, "utf8");
    expect(arch).toMatch(/#### 10\.20\.10/);
    for (const id of ["T20", "T21", "T22", "T23", "T24"]) {
      expect(arch).toContain(id);
    }
  });
});

// ─── AC5 — Shell operator guard (scope violation) ──────────────────────────

describe("AC5: Shell operator guard rejects injection attempts", () => {
  it("assertInScope is exported from the shared bridge-scope-guard module", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(typeof assertInScope).toBe("function");
  });

  it("assertInScope rejects semicolon chaining", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(() => assertInScope("npm test; rm -rf node_modules")).toThrow(/scope violation/i);
  });

  it("assertInScope rejects pipe operator", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(() => assertInScope("npm test | tee out.log")).toThrow(/scope violation/i);
  });

  it("assertInScope rejects && chaining", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(() => assertInScope("npm test && rm -rf /")).toThrow(/scope violation/i);
  });

  it("assertInScope rejects redirection", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(() => assertInScope("npm test > out.log")).toThrow(/scope violation/i);
  });

  it("assertInScope rejects command substitution $()", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(() => assertInScope('npm test "$(whoami)"')).toThrow(/scope violation/i);
  });

  it("assertInScope allows shell operators inside quoted arguments", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(() => assertInScope("node -e \"console.log('a'); console.log('b')\"")).not.toThrow();
  });

  it("assertInScope rejects empty or non-string commands", async () => {
    const { assertInScope } = await import(GUARD_REL);
    expect(() => assertInScope("")).toThrow(/scope violation/i);
    expect(() => assertInScope(null)).toThrow(/scope violation/i);
  });
});
