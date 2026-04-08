/**
 * E20-S13: Security Controls — Threat Mitigations
 *
 * Validates the security invariants layered on top of the dev-story CI
 * integration (E20-S6 PR create, E20-S7 wait-for-checks, E20-S8 merge PR)
 * and the /gaia-ci-edit audit trail.
 *
 * Threats mitigated (Threat Model v1.3.0):
 *   - T25 — PR target manipulation (AC1, MPC-25)
 *   - T26 — Unexpected CI check bypass (AC2, MPC-28)
 *   - T27 — Force-merge attack (AC3, MPC-31, MPC-31b)
 *   - TB-10 — Credential leakage via CLI arguments (AC4, MPC-35)
 *   - AC5 — Promotion chain audit trail (/gaia-ci-edit)
 *
 * Architecture references:
 *   - ADR-033: Multi-Environment Promotion Chain
 *   - architecture §10.24.5 Steps 14/15/16
 *   - FR-249 (wait-for-ci), FR-250 (merge-gate)
 *
 * Design principles under test:
 *   - Security invariants are pure functions — deterministic, no I/O in the
 *     hot path, no environment reads, no hidden defaults. Every bypass
 *     attempt is rejected by the contract itself, not by runtime heuristics.
 *   - YOLO mode is NEVER an exception: the merge gate MUST refuse failing
 *     checks regardless of user interaction mode (explicit carve-out from
 *     normal YOLO semantics — see story Dev Notes).
 *   - The audit trail is append-only and includes both before and after
 *     snapshots of the promotion chain so /gaia-resume and future audit
 *     tooling can reconstruct history deterministically.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  resolvePrTargetBase,
  classifyCiCheck,
  evaluateMergeGate,
  verifyAuthHygiene,
} from "../../../_gaia/core/validators/dev-story-security-controls.js";

import { writeCiEditAuditCheckpoint } from "../../../_gaia/core/validators/ci-edit-audit.js";

// ─── Fixtures ───────────────────────────────────────────────────

const GLOBAL_WITH_CHAIN = {
  ci_cd: {
    promotion_chain: [
      {
        id: "dev",
        branch: "staging",
        ci_provider: "github-actions",
        ci_checks: ["ci/test", "ci/lint", "ci/security-audit"],
      },
      {
        id: "staging",
        branch: "main",
        ci_provider: "github-actions",
        ci_checks: ["ci/test", "ci/lint"],
      },
    ],
  },
};

const GLOBAL_NO_CHAIN = {};

// ─── T25 / AC1 — PR target pinning (MPC-25) ──────────────────────

describe("T25 — PR target pinning (AC1, MPC-25)", () => {
  it("resolves --base exclusively from promotion_chain[0].branch", () => {
    const base = resolvePrTargetBase(GLOBAL_WITH_CHAIN, {});
    expect(base).toBe("staging");
  });

  it("ignores GAIA_PR_BASE environment variable (hostile input)", () => {
    const runtime = { env: { GAIA_PR_BASE: "main" } };
    const base = resolvePrTargetBase(GLOBAL_WITH_CHAIN, runtime);
    expect(base).toBe("staging");
  });

  it("ignores --base CLI flag (hostile input)", () => {
    const runtime = { cliFlags: { base: "main" } };
    const base = resolvePrTargetBase(GLOBAL_WITH_CHAIN, runtime);
    expect(base).toBe("staging");
  });

  it("ignores user-provided runtime overrides in userInput", () => {
    const runtime = { userInput: { base: "main" } };
    const base = resolvePrTargetBase(GLOBAL_WITH_CHAIN, runtime);
    expect(base).toBe("staging");
  });

  it("throws when promotion_chain is absent — no silent default to main", () => {
    expect(() => resolvePrTargetBase(GLOBAL_NO_CHAIN, {})).toThrow(/promotion_chain\[0\]/);
  });

  it("throws when promotion_chain[0].branch is missing", () => {
    const badConfig = { ci_cd: { promotion_chain: [{ id: "dev" }] } };
    expect(() => resolvePrTargetBase(badConfig, {})).toThrow(/branch/);
  });
});

// ─── T26 / AC2 — CI check name allowlist (MPC-28) ───────────────

describe("T26 — CI check name allowlist (AC2, MPC-28)", () => {
  const chainEntry = GLOBAL_WITH_CHAIN.ci_cd.promotion_chain[0];

  it("classifies expected checks as 'expected'", () => {
    const result = classifyCiCheck("ci/test", chainEntry.ci_checks);
    expect(result).toBe("expected");
  });

  it("classifies an unknown check name as 'unexpected'", () => {
    const result = classifyCiCheck("rubber-stamp", chainEntry.ci_checks);
    expect(result).toBe("unexpected");
  });

  it("emits a WARNING for unexpected check names and does not count them toward PASS", () => {
    const checks = [
      { name: "ci/test", status: "success" },
      { name: "ci/lint", status: "success" },
      { name: "ci/security-audit", status: "success" },
      { name: "rubber-stamp", status: "success" },
    ];
    const gate = evaluateMergeGate(checks, chainEntry.ci_checks);
    expect(gate.allRequiredPassed).toBe(true);
    expect(gate.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/unexpected.*rubber-stamp/i)])
    );
    expect(gate.unexpected).toContain("rubber-stamp");
  });

  it("does NOT mark the gate as passed when only unexpected checks return success", () => {
    const checks = [{ name: "rubber-stamp", status: "success" }];
    const gate = evaluateMergeGate(checks, chainEntry.ci_checks);
    expect(gate.allRequiredPassed).toBe(false);
  });
});

// ─── T27 / AC3 — Merge gate enforcement (MPC-31 / MPC-31b) ──────

describe("T27 — Merge gate enforcement (AC3, MPC-31)", () => {
  const required = ["ci/test", "ci/lint"];

  it("allows merge when all required checks are success", () => {
    const checks = [
      { name: "ci/test", status: "success" },
      { name: "ci/lint", status: "success" },
    ];
    const gate = evaluateMergeGate(checks, required);
    expect(gate.allRequiredPassed).toBe(true);
    expect(gate.halt).toBe(false);
  });

  it("refuses merge when any required check is failure", () => {
    const checks = [
      { name: "ci/test", status: "failure" },
      { name: "ci/lint", status: "success" },
    ];
    const gate = evaluateMergeGate(checks, required);
    expect(gate.allRequiredPassed).toBe(false);
    expect(gate.halt).toBe(true);
    expect(gate.haltMessage).toMatch(
      /Merge refused: required CI check ci\/test is in state failure\. No bypass is supported\./
    );
  });

  it("refuses merge when a required check is cancelled", () => {
    const checks = [
      { name: "ci/test", status: "cancelled" },
      { name: "ci/lint", status: "success" },
    ];
    const gate = evaluateMergeGate(checks, required);
    expect(gate.halt).toBe(true);
    expect(gate.haltMessage).toMatch(/ci\/test.*cancelled/);
  });

  it("refuses merge when a required check is timed_out", () => {
    const checks = [
      { name: "ci/test", status: "timed_out" },
      { name: "ci/lint", status: "success" },
    ];
    const gate = evaluateMergeGate(checks, required);
    expect(gate.halt).toBe(true);
    expect(gate.haltMessage).toMatch(/ci\/test.*timed_out/);
  });

  it("refuses merge when a required check has NO status (missing)", () => {
    const checks = [{ name: "ci/lint", status: "success" }];
    const gate = evaluateMergeGate(checks, required);
    expect(gate.halt).toBe(true);
    expect(gate.haltMessage).toMatch(/ci\/test.*missing/);
  });

  it("refuses merge even when --force flag is set (MPC-31 bypass attempt)", () => {
    const checks = [{ name: "ci/test", status: "failure" }];
    const gate = evaluateMergeGate(checks, required, { force: true });
    expect(gate.halt).toBe(true);
    expect(gate.haltMessage).toMatch(/No bypass is supported/);
  });

  it("refuses merge even when GAIA_FORCE_MERGE env var is set", () => {
    const checks = [{ name: "ci/test", status: "failure" }];
    const gate = evaluateMergeGate(checks, required, {
      env: { GAIA_FORCE_MERGE: "1" },
    });
    expect(gate.halt).toBe(true);
    expect(gate.haltMessage).toMatch(/No bypass is supported/);
  });

  it("refuses merge even in YOLO mode (MPC-31b — YOLO is NOT a security bypass)", () => {
    const checks = [{ name: "ci/test", status: "failure" }];
    const gate = evaluateMergeGate(checks, required, { yolo: true });
    expect(gate.halt).toBe(true);
    expect(gate.haltMessage).toMatch(/No bypass is supported/);
  });

  it("refuses merge when every override is combined (belt-and-braces)", () => {
    const checks = [{ name: "ci/test", status: "failure" }];
    const gate = evaluateMergeGate(checks, required, {
      force: true,
      yolo: true,
      env: { GAIA_FORCE_MERGE: "1" },
      userConfirmation: "yes",
    });
    expect(gate.halt).toBe(true);
  });
});

// ─── TB-10 / AC4 — Credential hygiene (MPC-35) ──────────────────

describe("TB-10 — Credential hygiene (AC4, MPC-35)", () => {
  it("accepts a gh CLI command (no tokens on argv)", () => {
    const result = verifyAuthHygiene({
      command: "gh",
      args: ["pr", "create", "--base", "staging", "--head", "feat/foo"],
      env: {},
    });
    expect(result.ok).toBe(true);
  });

  it("rejects curl with Authorization header on command line", () => {
    const result = verifyAuthHygiene({
      command: "curl",
      args: ["-H", "Authorization: Bearer ghp_abcdef123", "https://api.github.com/repos"],
      env: {},
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toMatch(/curl/i);
  });

  it("rejects a token-like value passed as any CLI argument", () => {
    const result = verifyAuthHygiene({
      command: "gh",
      args: ["api", "-H", "Authorization: token ghp_abcdefghijklmnopqrstuvwxyz012345"],
      env: {},
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toMatch(/token/i);
  });

  it("rejects a URL that embeds a token in userinfo", () => {
    const result = verifyAuthHygiene({
      command: "git",
      args: ["push", "https://x-access-token:ghp_abc@github.com/org/repo.git"],
      env: {},
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toMatch(/url/i);
  });

  it("flags GH_TOKEN in process env as a leak risk", () => {
    const result = verifyAuthHygiene({
      command: "gh",
      args: ["pr", "create"],
      env: { GH_TOKEN: "ghp_abcdef0123456789" },
    });
    expect(result.ok).toBe(false);
    expect(result.violation).toMatch(/env/i);
  });

  it("accepts an authenticated gh session with no token in env", () => {
    const result = verifyAuthHygiene({
      command: "gh",
      args: ["pr", "merge", "42", "--squash"],
      env: { PATH: "/usr/bin" },
    });
    expect(result.ok).toBe(true);
  });
});

// ─── AC5 — Promotion chain audit trail ──────────────────────────

describe("AC5 — /gaia-ci-edit promotion chain audit trail", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gaia-ci-edit-audit-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a checkpoint YAML capturing before_state, after_state, and diff_summary for 'add'", () => {
    const before = [{ id: "dev", branch: "staging", ci_checks: ["ci/test"] }];
    const after = [
      { id: "dev", branch: "staging", ci_checks: ["ci/test"] },
      { id: "staging", branch: "main", ci_checks: ["ci/test", "ci/lint"] },
    ];

    const checkpointPath = writeCiEditAuditCheckpoint({
      operation: "add",
      user: "alice",
      beforeState: before,
      afterState: after,
      checkpointDir: tmpDir,
      now: new Date("2026-04-08T10:30:00Z"),
    });

    expect(checkpointPath).toMatch(/ci-edit-.*\.yaml$/);
    expect(existsSync(checkpointPath)).toBe(true);

    const content = readFileSync(checkpointPath, "utf8");
    expect(content).toMatch(/operation:\s*add/);
    expect(content).toMatch(/user:\s*alice/);
    expect(content).toMatch(/timestamp:\s*['"]?2026-04-08T10:30:00/);
    expect(content).toMatch(/before_state:/);
    expect(content).toMatch(/after_state:/);
    expect(content).toMatch(/diff_summary:/);
    expect(content).toMatch(/added:.*staging/s);
  });

  it("captures a 'remove' diff summary", () => {
    const before = [
      { id: "dev", branch: "staging", ci_checks: ["ci/test"] },
      { id: "prod", branch: "main", ci_checks: ["ci/test"] },
    ];
    const after = [{ id: "dev", branch: "staging", ci_checks: ["ci/test"] }];

    const checkpointPath = writeCiEditAuditCheckpoint({
      operation: "remove",
      user: "bob",
      beforeState: before,
      afterState: after,
      checkpointDir: tmpDir,
      now: new Date("2026-04-08T11:00:00Z"),
    });

    const content = readFileSync(checkpointPath, "utf8");
    expect(content).toMatch(/operation:\s*remove/);
    expect(content).toMatch(/removed:.*prod/s);
  });

  it("captures a 'reorder' diff summary when ids match but order changes", () => {
    const before = [
      { id: "dev", branch: "staging", ci_checks: [] },
      { id: "staging", branch: "main", ci_checks: [] },
    ];
    const after = [
      { id: "staging", branch: "main", ci_checks: [] },
      { id: "dev", branch: "staging", ci_checks: [] },
    ];

    const checkpointPath = writeCiEditAuditCheckpoint({
      operation: "reorder",
      user: "carol",
      beforeState: before,
      afterState: after,
      checkpointDir: tmpDir,
      now: new Date("2026-04-08T12:00:00Z"),
    });

    const content = readFileSync(checkpointPath, "utf8");
    expect(content).toMatch(/operation:\s*reorder/);
    expect(content).toMatch(/reordered/);
  });

  it("captures a 'modify' diff summary for mutated ci_checks", () => {
    const before = [{ id: "dev", branch: "staging", ci_checks: ["ci/test"] }];
    const after = [{ id: "dev", branch: "staging", ci_checks: ["ci/test", "ci/lint"] }];

    const checkpointPath = writeCiEditAuditCheckpoint({
      operation: "modify",
      user: "dana",
      beforeState: before,
      afterState: after,
      checkpointDir: tmpDir,
      now: new Date("2026-04-08T13:00:00Z"),
    });

    const content = readFileSync(checkpointPath, "utf8");
    expect(content).toMatch(/operation:\s*modify/);
    expect(content).toMatch(/modified:.*dev/s);
  });

  it("uses ISO-8601 timestamp in the file name (sortable, no spaces or colons replaced)", () => {
    writeCiEditAuditCheckpoint({
      operation: "add",
      user: "alice",
      beforeState: [],
      afterState: [{ id: "dev", branch: "staging", ci_checks: [] }],
      checkpointDir: tmpDir,
      now: new Date("2026-04-08T09:15:30Z"),
    });

    const files = readdirSync(tmpDir);
    expect(files.length).toBe(1);
    // Filesystem-safe ISO-8601 variant: colons replaced with hyphens
    expect(files[0]).toMatch(/^ci-edit-2026-04-08T09-15-30Z\.yaml$/);
  });

  it("throws when the checkpoint directory is not provided", () => {
    expect(() =>
      writeCiEditAuditCheckpoint({
        operation: "add",
        user: "alice",
        beforeState: [],
        afterState: [],
      })
    ).toThrow(/checkpointDir/);
  });
});
