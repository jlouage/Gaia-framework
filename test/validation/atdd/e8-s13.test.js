import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const MEMORY_DIR = join(PROJECT_ROOT, "_memory");
const SIDECAR_DIR = join(MEMORY_DIR, "validator-sidecar");
const GROUND_TRUTH = join(SIDECAR_DIR, "ground-truth.md");
const MEMORY_CONFIG = join(MEMORY_DIR, "config.yaml");

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

  // AC2: Ground truth seeded with verified facts and counts
  describe("AC2: Ground truth seeded facts", () => {
    it("test_ac2_ground_truth_seeded_facts — contains sections for all framework asset types with counts", () => {
      expect(existsSync(GROUND_TRUTH)).toBe(true);

      const content = readFileSync(GROUND_TRUTH, "utf-8").toLowerCase();

      const requiredSections = [
        "workflow",
        "instruction",
        "slash command",
        "skill",
        "template",
        "agent",
        "manifest",
      ];

      for (const section of requiredSections) {
        expect(content, `Missing section for: ${section}`).toContain(section);
      }

      // Verify counts are present (numbers following section references)
      const countPattern = /\b\d+\b/;
      expect(content).toMatch(countPattern);

      // Verify counts reference filesystem verification
      expect(content).toMatch(/verif|count|total|found/);
    });
  });

  // AC3: Documentation of corrections, inventories, patterns, structure, coverage
  describe("AC3: Ground truth documentation sections", () => {
    it("test_ac3_ground_truth_documentation_sections — contains correction, inventory, pattern, structure, and coverage sections", () => {
      expect(existsSync(GROUND_TRUTH)).toBe(true);

      const content = readFileSync(GROUND_TRUTH, "utf-8").toLowerCase();

      const requiredDocSections = [
        {
          name: "location corrections",
          patterns: [
            "location correction",
            "path correction",
            "location fix",
            "path verification",
            "path mismatch",
          ],
        },
        {
          name: "variable inventories",
          patterns: ["variable inventor", "variable catalog", "variables"],
        },
        {
          name: "skill system patterns",
          patterns: ["skill system", "skill pattern", "shared skill", "skill"],
        },
        {
          name: "command structure",
          patterns: ["command structure", "slash command", "command routing"],
        },
        {
          name: "manifest coverage",
          patterns: ["manifest coverage", "coverage gap", "manifest gap"],
        },
      ];

      for (const section of requiredDocSections) {
        const found = section.patterns.some((p) => content.includes(p));
        expect(found, `Missing documentation section: ${section.name}`).toBe(true);
      }
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
