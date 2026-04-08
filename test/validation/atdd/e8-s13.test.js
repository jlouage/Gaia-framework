import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";
const MEMORY_DIR = join(PROJECT_ROOT, "_memory");
const SIDECAR_DIR = join(MEMORY_DIR, "validator-sidecar");
const GROUND_TRUTH = join(SIDECAR_DIR, "ground-truth.md");
const MEMORY_CONFIG = join(MEMORY_DIR, "config.yaml");

/**
 * E8-S13: Val Permanent Memory and Ground Truth Seed
 *
 * Per E9-S22, sidecars ship as empty templates (entry_count: 0). Ground truth
 * population is a runtime operation performed by `/gaia-refresh-ground-truth`.
 * These tests validate the shipped template structure, not populated content.
 */
describe("E8-S13: Val Permanent Memory and Ground Truth Seed", () => {
  // AC1: validator-sidecar directory with 3 required files
  describe("AC1: Validator sidecar structure", () => {
    const requiredFiles = ["ground-truth.md", "decision-log.md", "conversation-context.md"];

    it("test_ac1_validator_sidecar_structure — directory exists with 3 files", () => {
      expect(existsSync(SIDECAR_DIR)).toBe(true);

      for (const file of requiredFiles) {
        const filePath = join(SIDECAR_DIR, file);
        expect(existsSync(filePath), `Missing file: ${file}`).toBe(true);
        const stat = statSync(filePath);
        expect(stat.size, `File is empty: ${file}`).toBeGreaterThan(0);
      }
    });
  });

  // AC2: Ground truth shipped as empty template (entry_count: 0)
  describe("AC2: Ground truth empty template invariant", () => {
    it("test_ac2_ground_truth_empty_template — frontmatter entry_count is 0", () => {
      expect(existsSync(GROUND_TRUTH)).toBe(true);

      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const entryMatch = content.match(/entry_count:\s*(\d+)/);
      expect(entryMatch, "entry_count must exist in frontmatter").not.toBeNull();
      expect(parseInt(entryMatch[1], 10), "empty template ships with entry_count: 0").toBe(0);

      const tokensMatch = content.match(/estimated_tokens:\s*(\d+)/);
      expect(tokensMatch, "estimated_tokens must exist in frontmatter").not.toBeNull();
      expect(parseInt(tokensMatch[1], 10), "empty template ships with estimated_tokens: 0").toBe(0);
    });
  });

  // AC3: Ground truth has canonical header and description
  describe("AC3: Ground truth canonical structure", () => {
    it("test_ac3_ground_truth_canonical_structure — has header and description", () => {
      expect(existsSync(GROUND_TRUTH)).toBe(true);

      const content = readFileSync(GROUND_TRUTH, "utf-8");
      expect(content, "missing Ground Truth header").toMatch(/# Ground Truth/);
      expect(content, "missing description blockquote").toMatch(/>/);
    });
  });

  // AC4: Token budget for Val (200K) in memory config
  describe("AC4: Val token budget", () => {
    it("test_ac4_val_token_budget — 200K token budget documented in memory config", () => {
      // Check _memory/config.yaml for Val's budget
      expect(existsSync(MEMORY_CONFIG), "_memory/config.yaml must exist").toBe(true);

      const configContent = readFileSync(MEMORY_CONFIG, "utf-8");
      expect(configContent, "config.yaml must reference validator agent").toMatch(/validator/i);
      expect(configContent, "config.yaml must contain 200000 token budget").toMatch(/200000/);

      // Also verify ground-truth.md frontmatter has the budget
      if (existsSync(GROUND_TRUTH)) {
        const gtContent = readFileSync(GROUND_TRUTH, "utf-8");
        expect(gtContent, "ground-truth.md frontmatter must contain token_budget: 200000").toMatch(
          /token_budget:\s*200000/
        );
      }
    });
  });
});
