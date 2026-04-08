import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

import { loadEnvironmentPresets } from "../../validators/environment-presets-loader.js";
import { validatePromotionChain } from "../../validators/promotion-chain-validator.js";

// E20-S2 — Environment Presets Definition
//
// Covers the 4 acceptance criteria and the 12 test scenarios documented in
// docs/implementation-artifacts/E20-S2-environment-presets-definition.md.
//
// The presets file lives at Gaia-framework/_gaia/_config/environment-presets.yaml
// and is the user-facing entry point for promotion-chain configuration
// (consumed by /gaia-ci-setup in E20-S3). Each preset must pass the E20-S1
// promotion-chain schema validator when its promotion_chain is wrapped in a
// ci_cd block.

const PRESETS_PATH = path.resolve(process.cwd(), "_gaia/_config/environment-presets.yaml");

const PRESET_NAMES = ["solo", "small-team", "standard", "enterprise"];

describe("E20-S2: Environment Presets Definition", () => {
  let rawContent;
  let parsed;
  let presets;

  beforeAll(() => {
    rawContent = fs.readFileSync(PRESETS_PATH, "utf8");
    parsed = yaml.load(rawContent);
    presets = loadEnvironmentPresets(PRESETS_PATH);
  });

  // ── Test MPC-11 / AC1: All four presets load without parse errors ──
  describe("MPC-11 — Preset file loads and exposes all four presets (AC1)", () => {
    it("Test 1: parses as valid YAML without errors", () => {
      expect(parsed).toBeTypeOf("object");
      expect(parsed).not.toBeNull();
    });

    it("Test 2: defines exactly the four expected preset keys", () => {
      const keys = Object.keys(parsed).sort();
      expect(keys).toEqual([...PRESET_NAMES].sort());
    });

    it("Test 3: loader returns an object keyed by preset name", () => {
      expect(presets).toBeTypeOf("object");
      for (const name of PRESET_NAMES) {
        expect(presets).toHaveProperty(name);
      }
    });

    it("Test 4: solo preset has a single-entry promotion_chain with id=prod, branch=main", () => {
      const solo = presets.solo;
      expect(Array.isArray(solo.promotion_chain)).toBe(true);
      expect(solo.promotion_chain).toHaveLength(1);
      expect(solo.promotion_chain[0].id).toBe("prod");
      expect(solo.promotion_chain[0].branch).toBe("main");
    });

    it("Test 5: small-team preset has a two-entry promotion_chain", () => {
      expect(presets["small-team"].promotion_chain).toHaveLength(2);
    });

    it("Test 6: standard preset has a three-entry promotion_chain", () => {
      expect(presets.standard.promotion_chain).toHaveLength(3);
    });

    it("Test 7: enterprise preset has a four-entry promotion_chain", () => {
      expect(presets.enterprise.promotion_chain).toHaveLength(4);
    });
  });

  // ── Test MPC-12 / AC2: Each preset passes E20-S1 schema validation ──
  describe("MPC-12 — Each preset passes E20-S1 promotion-chain schema validation (AC2)", () => {
    for (const name of ["solo", "small-team", "standard", "enterprise"]) {
      it(`Test 8/${name}: ${name} preset passes validatePromotionChain`, () => {
        const preset = presets[name];
        const config = { ci_cd: { promotion_chain: preset.promotion_chain } };
        expect(() => validatePromotionChain(config)).not.toThrow();
        const result = validatePromotionChain(config);
        expect(result.valid).toBe(true);
        expect(result.chain).toHaveLength(preset.promotion_chain.length);
      });
    }

    it("Test 9: no preset contains duplicate ids in its promotion_chain", () => {
      for (const name of PRESET_NAMES) {
        const ids = presets[name].promotion_chain.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it("Test 10: no preset contains duplicate branches in its promotion_chain", () => {
      for (const name of PRESET_NAMES) {
        const branches = presets[name].promotion_chain.map((e) => e.branch);
        expect(new Set(branches).size).toBe(branches.length);
      }
    });

    it("Test 11: every chain entry has all required fields (id, name, branch, ci_provider)", () => {
      for (const name of PRESET_NAMES) {
        for (const entry of presets[name].promotion_chain) {
          expect(entry.id).toBeTypeOf("string");
          expect(entry.name).toBeTypeOf("string");
          expect(entry.branch).toBeTypeOf("string");
          expect(entry.ci_provider).toBeTypeOf("string");
        }
      }
    });
  });

  // ── Test MPC-13 / AC3: description field present and non-empty ──
  describe("MPC-13 — Description field present for every preset and chain entry (AC3)", () => {
    it("Test 12: each top-level preset has a non-empty description string", () => {
      for (const name of PRESET_NAMES) {
        expect(presets[name].description).toBeTypeOf("string");
        expect(presets[name].description.length).toBeGreaterThan(0);
      }
    });

    it("Test 13: each chain entry has a non-empty description string", () => {
      for (const name of PRESET_NAMES) {
        for (const entry of presets[name].promotion_chain) {
          expect(entry.description).toBeTypeOf("string");
          expect(entry.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ── Test MPC-14 / AC4: Default ci_provider and merge_strategy ──
  describe("MPC-14 — Default ci_provider and merge_strategy per preset (AC4)", () => {
    it("Test 14: all presets use ci_provider=github_actions for every chain entry", () => {
      for (const name of PRESET_NAMES) {
        for (const entry of presets[name].promotion_chain) {
          expect(entry.ci_provider).toBe("github_actions");
        }
      }
    });

    it("Test 15: solo, small-team, and standard use merge_strategy=squash", () => {
      for (const name of ["solo", "small-team", "standard"]) {
        for (const entry of presets[name].promotion_chain) {
          expect(entry.merge_strategy).toBe("squash");
        }
      }
    });

    it("Test 16: enterprise uses merge_strategy=merge", () => {
      for (const entry of presets.enterprise.promotion_chain) {
        expect(entry.merge_strategy).toBe("merge");
      }
    });
  });

  // ── Dev Notes enforcement: solo auto_merge, enterprise approval_required ──
  describe("Dev Notes — preset-specific defaults", () => {
    it("Test 17: solo preset has auto_merge=true on its single entry", () => {
      expect(presets.solo.promotion_chain[0].auto_merge).toBe(true);
    });

    it("Test 18: enterprise staging and prod entries have approval_required=true", () => {
      const chain = presets.enterprise.promotion_chain;
      const late = chain.slice(-2); // staging and prod
      for (const entry of late) {
        expect(entry.approval_required).toBe(true);
      }
    });

    it("Test 19: test_tiers follow additive convention (later >= earlier)", () => {
      for (const name of ["small-team", "standard", "enterprise"]) {
        const chain = presets[name].promotion_chain;
        for (let i = 1; i < chain.length; i++) {
          const prev = new Set(chain[i - 1].test_tiers);
          const curr = chain[i].test_tiers;
          for (const tier of prev) {
            expect(curr).toContain(tier);
          }
        }
      }
    });
  });

  // ── Malformed file handling ──
  describe("Loader — error handling", () => {
    it("Test 20: loadEnvironmentPresets throws on missing file", () => {
      expect(() => loadEnvironmentPresets("/nonexistent/path/environment-presets.yaml")).toThrow();
    });
  });
});
