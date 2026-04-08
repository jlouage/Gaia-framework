import { describe, it, expect } from "vitest";
import {
  validatePromotionChain,
  resolvePromotionChain,
  PROMOTION_CHAIN_PROVIDERS,
  PROMOTION_CHAIN_MERGE_STRATEGIES,
} from "../../validators/promotion-chain-validator.js";

// E20-S1 — Promotion Chain Schema in global.yaml
//
// Covers the 10 acceptance criteria and the 10 test scenarios documented in
// docs/implementation-artifacts/E20-S1-promotion-chain-schema.md.
//
// The validator is invoked during workflow engine Step 1 (Load and Resolve
// Config). It must:
//   1. Accept a parsed global.yaml object (or null)
//   2. Return { valid: true, chain: [...] } on success
//   3. Throw a PromotionChainValidationError listing every violation on failure
//   4. Treat absent ci_cd block (or absent promotion_chain key) as backward
//      compatible — no error, no chain
//   5. Apply ci_cd.default_merge_strategy as fallback for entries that omit
//      merge_strategy

describe("E20-S1: Promotion Chain Schema Validation", () => {
  // ── AC1, Test 1: Valid chain with multiple entries ────────────
  describe("AC1 — Valid chain accepted", () => {
    it("Test 1: accepts a valid chain with 3 entries (dev, staging, prod)", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dev",
              name: "Development",
              branch: "develop",
              ci_provider: "github_actions",
              merge_strategy: "merge",
              ci_checks: ["lint", "unit"],
            },
            {
              id: "staging",
              name: "Staging",
              branch: "staging",
              ci_provider: "github_actions",
              merge_strategy: "squash",
            },
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "rebase",
            },
          ],
        },
      };
      const result = validatePromotionChain(config);
      expect(result.valid).toBe(true);
      expect(result.chain).toHaveLength(3);
      expect(result.chain[0].id).toBe("dev");
      expect(result.chain[2].branch).toBe("main");
    });

    it("Test 2: accepts a single-entry chain (solo prod)", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "squash",
            },
          ],
        },
      };
      const result = validatePromotionChain(config);
      expect(result.valid).toBe(true);
      expect(result.chain).toHaveLength(1);
    });

    it("AC1: accepts all valid ci_provider enum values", () => {
      for (const provider of PROMOTION_CHAIN_PROVIDERS) {
        const config = {
          ci_cd: {
            promotion_chain: [
              {
                id: "prod",
                name: "Production",
                branch: "main",
                ci_provider: provider,
                merge_strategy: "merge",
              },
            ],
          },
        };
        expect(() => validatePromotionChain(config)).not.toThrow();
      }
    });

    it("AC1: accepts all valid merge_strategy enum values", () => {
      for (const strategy of PROMOTION_CHAIN_MERGE_STRATEGIES) {
        const config = {
          ci_cd: {
            promotion_chain: [
              {
                id: "prod",
                name: "Production",
                branch: "main",
                ci_provider: "github_actions",
                merge_strategy: strategy,
              },
            ],
          },
        };
        expect(() => validatePromotionChain(config)).not.toThrow();
      }
    });

    it("AC1: ci_checks is optional", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).not.toThrow();
    });
  });

  // ── AC2, Test 3: Empty chain rejected ─────────────────────────
  describe("AC2 — Empty chain rejected", () => {
    it("Test 3: rejects an empty promotion_chain array", () => {
      const config = { ci_cd: { promotion_chain: [] } };
      expect(() => validatePromotionChain(config)).toThrow(/at least 1 environment/i);
    });
  });

  // ── AC3, Test 4: Duplicate id rejected ────────────────────────
  describe("AC3 — Duplicate id rejected", () => {
    it("Test 4: rejects two entries with the same id", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dev",
              name: "First",
              branch: "develop",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
            {
              id: "dev",
              name: "Second",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "squash",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow(/Duplicate promotion chain id: dev/);
    });
  });

  // ── AC4, Test 5: Duplicate branch rejected ────────────────────
  describe("AC4 — Duplicate branch rejected", () => {
    it("Test 5: rejects two entries with the same branch", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dev",
              name: "Development",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "squash",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow(
        /Duplicate promotion chain branch: main/
      );
    });
  });

  // ── AC5: First entry is the PR target branch ─────────────────
  describe("AC5 — promotion_chain[0] is the PR target", () => {
    it("resolvePromotionChain returns first entry as pr_target", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "staging",
              name: "Staging",
              branch: "staging",
              ci_provider: "github_actions",
              merge_strategy: "squash",
            },
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "rebase",
            },
          ],
        },
      };
      const resolved = resolvePromotionChain(config);
      expect(resolved.pr_target).toBeDefined();
      expect(resolved.pr_target.id).toBe("staging");
      expect(resolved.pr_target.branch).toBe("staging");
    });
  });

  // ── AC6: Validation runs during config resolution ────────────
  describe("AC6 — Halts on schema/uniqueness violation", () => {
    it("Test 6: rejects an invalid ci_provider with descriptive message", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "travis",
              merge_strategy: "merge",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow(/Invalid ci_provider 'travis'/);
    });

    it("AC6: rejects an invalid merge_strategy", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "fast-forward",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow(/Invalid merge_strategy 'fast-forward'/);
    });

    it("AC6: rejects entries missing required fields", () => {
      const config = {
        ci_cd: {
          promotion_chain: [{ id: "prod", branch: "main" }],
        },
      };
      // missing name + ci_provider
      expect(() => validatePromotionChain(config)).toThrow();
    });
  });

  // ── AC7, Test 7: default_merge_strategy fallback ─────────────
  describe("AC7 — default_merge_strategy fallback", () => {
    it("Test 7: applies default_merge_strategy when entry omits merge_strategy", () => {
      const config = {
        ci_cd: {
          default_merge_strategy: "squash",
          promotion_chain: [
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
            },
          ],
        },
      };
      const result = validatePromotionChain(config);
      expect(result.valid).toBe(true);
      expect(result.chain[0].merge_strategy).toBe("squash");
    });

    it("AC7: explicit entry merge_strategy overrides default_merge_strategy", () => {
      const config = {
        ci_cd: {
          default_merge_strategy: "squash",
          promotion_chain: [
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
              merge_strategy: "rebase",
            },
          ],
        },
      };
      const result = validatePromotionChain(config);
      expect(result.chain[0].merge_strategy).toBe("rebase");
    });

    it("AC7: rejects entry with no merge_strategy AND no default_merge_strategy", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "prod",
              name: "Production",
              branch: "main",
              ci_provider: "github_actions",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow(/merge_strategy/);
    });
  });

  // ── AC8, Test 8: Backward compat when ci_cd absent ────────────
  describe("AC8 — Backward compat (no ci_cd block)", () => {
    it("Test 8: returns chain-absent result when ci_cd is missing entirely", () => {
      const config = { framework_name: "GAIA" };
      const result = validatePromotionChain(config);
      expect(result.valid).toBe(true);
      expect(result.chain).toBeNull();
      expect(result.chain_absent).toBe(true);
    });

    it("AC8: returns chain-absent when entire config is null", () => {
      const result = validatePromotionChain(null);
      expect(result.valid).toBe(true);
      expect(result.chain).toBeNull();
      expect(result.chain_absent).toBe(true);
    });

    it("AC8: resolvePromotionChain has no pr_target when chain absent", () => {
      const resolved = resolvePromotionChain({});
      expect(resolved.pr_target).toBeNull();
      expect(resolved.chain).toBeNull();
    });
  });

  // ── AC9, Test 10: Special characters in id ────────────────────
  describe("AC9 — id format validation", () => {
    it("Test 10: rejects id containing a space", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dev env",
              name: "Dev",
              branch: "develop",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow(/alphanumeric with hyphens only/);
    });

    it("AC9: rejects empty string id", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "",
              name: "Dev",
              branch: "develop",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow();
    });

    it("AC9: rejects id with unicode", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dévelop",
              name: "Dev",
              branch: "develop",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow(/alphanumeric with hyphens only/);
    });

    it("AC9: rejects id with underscore (alphanumeric + hyphens only)", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dev_env",
              name: "Dev",
              branch: "develop",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).toThrow();
    });

    it("AC9: accepts id with hyphens and digits", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dev-1",
              name: "Dev 1",
              branch: "develop",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
          ],
        },
      };
      expect(() => validatePromotionChain(config)).not.toThrow();
    });
  });

  // ── AC10, Test 9: ci_cd present but no promotion_chain ────────
  describe("AC10 — chain-absent path (ci_cd without promotion_chain)", () => {
    it("Test 9: ci_cd with only default_merge_strategy returns chain-absent", () => {
      const config = { ci_cd: { default_merge_strategy: "squash" } };
      const result = validatePromotionChain(config);
      expect(result.valid).toBe(true);
      expect(result.chain).toBeNull();
      expect(result.chain_absent).toBe(true);
    });
  });

  // ── Reporting: all duplicates collected, not just first ──────
  describe("Error reporting collects all violations", () => {
    it("collects multiple duplicate ids in a single error", () => {
      const config = {
        ci_cd: {
          promotion_chain: [
            {
              id: "dev",
              name: "A",
              branch: "a",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
            {
              id: "dev",
              name: "B",
              branch: "b",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
            {
              id: "prod",
              name: "C",
              branch: "c",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
            {
              id: "prod",
              name: "D",
              branch: "d",
              ci_provider: "github_actions",
              merge_strategy: "merge",
            },
          ],
        },
      };
      try {
        validatePromotionChain(config);
        throw new Error("expected to throw");
      } catch (err) {
        expect(err.message).toMatch(/dev/);
        expect(err.message).toMatch(/prod/);
      }
    });
  });
});
