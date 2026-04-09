/**
 * E20-S10: E17 Tier Mapping — Test Environment Integration
 *
 * Validates the opt-in linkage between `test-environment.yaml` tier entries
 * and `ci_cd.promotion_chain[]` entries in `global.yaml` (ADR-033, ADR-028,
 * FR-244, MPC-39).
 *
 * The story exposes four surfaces:
 *   1. Extended test-environment schema validator — accepts the optional
 *      `promotion_chain_env_id` field on tier entries (unit/integration/e2e).
 *   2. Bridge resolver module — cross-references the promotion chain, emits
 *      a WARNING on orphaned references, and falls back to tier-local config
 *      when the chain is missing or the id is not found.
 *   3. Backward-compat path — when `ci_cd` is absent from global.yaml,
 *      `promotion_chain_env_id` fields are silently ignored (NFR-045).
 *   4. ci-edit remove safety scan — identifies tier entries that reference
 *      an environment id scheduled for removal.
 *
 * Test case: MPC-39
 */

import { describe, it, expect } from "vitest";
import { validateTestEnvironment } from "../../../_gaia/core/validators/test-environment-validator.js";
import {
  resolvePromotionChainEnv,
  resolveBridgeContext,
} from "../../../_gaia/core/validators/promotion-chain-env-resolver.js";
import { scanTestEnvironmentForEnvId } from "../../../_gaia/core/validators/ci-edit-test-env-scan.js";

// ─── Fixtures ───────────────────────────────────────────────────

const TEST_ENV_WITH_MAPPING = `
version: 2
runners:
  - name: unit
    command: "npm test"
    tier: 1
    promotion_chain_env_id: "dev"
  - name: integration
    command: "npm run test:integration"
    tier: 2
    promotion_chain_env_id: "staging"
  - name: e2e
    command: "npm run test:e2e"
    tier: 3
`;

const TEST_ENV_NO_MAPPING = `
version: 1
runners:
  - name: unit
    command: "npm test"
    tier: 1
  - name: integration
    command: "npm run test:integration"
    tier: 2
`;

const TEST_ENV_ORPHAN = `
version: 2
runners:
  - name: unit
    command: "npm test"
    tier: 1
    promotion_chain_env_id: "ghost"
`;

const GLOBAL_WITH_CHAIN = {
  ci_cd: {
    promotion_chain: [
      {
        id: "dev",
        ci_provider: "github-actions",
        branch: "dev",
        ci_checks: ["lint", "unit"],
      },
      {
        id: "staging",
        ci_provider: "github-actions",
        branch: "staging",
        ci_checks: ["lint", "unit", "integration"],
      },
      {
        id: "prod",
        ci_provider: "github-actions",
        branch: "main",
        ci_checks: ["lint", "unit", "integration", "e2e"],
      },
    ],
  },
};

const GLOBAL_NO_CI_CD = {
  framework_name: "GAIA",
};

const GLOBAL_EMPTY_CHAIN = {
  ci_cd: { promotion_chain: [] },
};

// ─── AC1: Schema Validator accepts promotion_chain_env_id ──────

describe("E20-S10 AC1: Schema validator accepts promotion_chain_env_id", () => {
  it("accepts schema_version 2 with promotion_chain_env_id on tier entries", () => {
    const result = validateTestEnvironment(TEST_ENV_WITH_MAPPING);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("accepts legacy schema (no promotion_chain_env_id) without warning", () => {
    const result = validateTestEnvironment(TEST_ENV_NO_MAPPING);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("treats null promotion_chain_env_id as absent (no error)", () => {
    const yaml = `version: 2
runners:
  - name: unit
    command: "npm test"
    tier: 1
    promotion_chain_env_id: null
`;
    const result = validateTestEnvironment(yaml);
    expect(result.valid).toBe(true);
  });
});

// ─── AC2: Bridge resolves CI provider, branch, ci_checks from chain ──

describe("E20-S10 AC2: Bridge resolver cross-references promotion chain", () => {
  it("resolves CI provider, branch, and ci_checks from matching chain entry", () => {
    const tierEntry = { name: "integration", tier: 2, promotion_chain_env_id: "staging" };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    expect(result.promotion_chain_env_id).toBe("staging");
    expect(result.ci_provider).toBe("github-actions");
    expect(result.branch).toBe("staging");
    expect(result.ci_checks).toEqual(["lint", "unit", "integration"]);
    expect(result.warnings).toEqual([]);
  });

  it("resolvePromotionChainEnv returns the matching chain entry", () => {
    const match = resolvePromotionChainEnv("dev", GLOBAL_WITH_CHAIN);
    expect(match).not.toBeNull();
    expect(match.id).toBe("dev");
    expect(match.branch).toBe("dev");
  });
});

// ─── AC3: Missing field fallback — pre-E20 behavior ─────────────

describe("E20-S10 AC3: Missing field fallback (no regression)", () => {
  it("falls back to tier-local config when promotion_chain_env_id is absent", () => {
    const tierEntry = { name: "unit", tier: 1 };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    expect(result.promotion_chain_env_id).toBeNull();
    expect(result.ci_provider).toBeUndefined();
    expect(result.branch).toBeUndefined();
    expect(result.ci_checks).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("falls back when promotion_chain_env_id is explicitly null", () => {
    const tierEntry = { name: "unit", tier: 1, promotion_chain_env_id: null };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    expect(result.promotion_chain_env_id).toBeNull();
    expect(result.warnings).toEqual([]);
  });
});

// ─── AC4: Orphaned id → WARNING, not HALT ───────────────────────

describe("E20-S10 AC4: Orphaned promotion_chain_env_id emits WARNING", () => {
  it("emits WARNING when promotion_chain_env_id does not match any chain entry", () => {
    const tierEntry = { name: "unit", tier: 1, promotion_chain_env_id: "ghost" };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    expect(result.warnings.length).toBe(1);
    const warning = result.warnings[0];
    expect(warning).toContain("unit");
    expect(warning).toContain("ghost");
    // Known ids must be listed
    expect(warning).toContain("dev");
    expect(warning).toContain("staging");
    expect(warning).toContain("prod");
  });

  it("does not halt execution — falls back to tier-local config", () => {
    const tierEntry = { name: "unit", tier: 1, promotion_chain_env_id: "ghost" };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    // Fallback: no ci_provider attached
    expect(result.ci_provider).toBeUndefined();
    expect(result.promotion_chain_env_id).toBe("ghost"); // recorded even if orphaned
  });

  it("schema validator also emits warning for orphaned ids when chain is provided", () => {
    const result = validateTestEnvironment(TEST_ENV_ORPHAN, {
      globalConfig: GLOBAL_WITH_CHAIN,
    });
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.includes("ghost"))).toBe(true);
  });
});

// ─── AC5: ci-edit remove safety scan ────────────────────────────

describe("E20-S10 AC5: ci-edit remove safety scan", () => {
  it("returns list of tier names referencing the target env id", () => {
    const refs = scanTestEnvironmentForEnvId(TEST_ENV_WITH_MAPPING, "staging");
    expect(refs).toContain("integration");
    expect(refs.length).toBe(1);
  });

  it("returns empty list when env id has no references", () => {
    const refs = scanTestEnvironmentForEnvId(TEST_ENV_WITH_MAPPING, "prod");
    expect(refs).toEqual([]);
  });

  it("returns multiple tier names when env is referenced more than once", () => {
    const multiRef = `
version: 2
runners:
  - name: unit
    command: "npm test"
    tier: 1
    promotion_chain_env_id: "dev"
  - name: integration
    command: "npm run test:integration"
    tier: 2
    promotion_chain_env_id: "dev"
`;
    const refs = scanTestEnvironmentForEnvId(multiRef, "dev");
    expect(refs.sort()).toEqual(["integration", "unit"]);
  });

  it("returns empty list when test-environment.yaml is null/empty", () => {
    expect(scanTestEnvironmentForEnvId(null, "dev")).toEqual([]);
    expect(scanTestEnvironmentForEnvId("", "dev")).toEqual([]);
  });
});

// ─── AC6: Backward compat — no ci_cd block ─────────────────────

describe("E20-S10 AC6: Backward compat — no ci_cd block", () => {
  it("silently ignores promotion_chain_env_id when ci_cd is absent", () => {
    const tierEntry = { name: "unit", tier: 1, promotion_chain_env_id: "dev" };
    const result = resolveBridgeContext(tierEntry, GLOBAL_NO_CI_CD);
    expect(result.ci_provider).toBeUndefined();
    expect(result.branch).toBeUndefined();
    expect(result.ci_checks).toBeUndefined();
    // Crucially — NO warnings in this path
    expect(result.warnings).toEqual([]);
    // id still recorded in evidence context
    expect(result.promotion_chain_env_id).toBe("dev");
  });

  it("schema validator does not warn on promotion_chain_env_id when ci_cd is absent", () => {
    const result = validateTestEnvironment(TEST_ENV_WITH_MAPPING, {
      globalConfig: GLOBAL_NO_CI_CD,
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("empty promotion_chain array is treated as orphan path (WARNING)", () => {
    const tierEntry = { name: "unit", tier: 1, promotion_chain_env_id: "dev" };
    const result = resolveBridgeContext(tierEntry, GLOBAL_EMPTY_CHAIN);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("dev");
  });
});

// ─── AC7: MPC-39 — the four mandatory sub-scenarios ─────────────

describe("E20-S10 AC7: MPC-39 coverage — four required sub-scenarios", () => {
  it("(a) valid mapping resolution", () => {
    const tierEntry = { name: "integration", tier: 2, promotion_chain_env_id: "staging" };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    expect(result.ci_provider).toBe("github-actions");
    expect(result.branch).toBe("staging");
  });

  it("(b) missing field fallback", () => {
    const tierEntry = { name: "unit", tier: 1 };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    expect(result.ci_provider).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("(c) orphaned id warning", () => {
    const tierEntry = { name: "unit", tier: 1, promotion_chain_env_id: "missing" };
    const result = resolveBridgeContext(tierEntry, GLOBAL_WITH_CHAIN);
    expect(result.warnings.length).toBe(1);
  });

  it("(d) ci-edit remove safety scan surfaces referencing tier", () => {
    const refs = scanTestEnvironmentForEnvId(TEST_ENV_WITH_MAPPING, "staging");
    expect(refs).toContain("integration");
  });
});
