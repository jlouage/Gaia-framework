import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { PROJECT_ROOT } from "../../helpers/project-root.js";
const MEMORY_DIR = join(PROJECT_ROOT, "_memory");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const CONFIG_YAML = join(MEMORY_DIR, "config.yaml");

const REQUIRED_FILES = ["ground-truth.md", "decision-log.md", "conversation-context.md"];

const TIER_1_SIDECARS = ["validator-sidecar", "architect-sidecar", "pm-sidecar", "sm-sidecar"];

function readFile(filePath) {
  return readFileSync(filePath, "utf-8");
}

function sidecarPath(sidecar, file) {
  return join(MEMORY_DIR, sidecar, file);
}

function validateSidecarStructure(sidecarName) {
  const sidecarDir = join(MEMORY_DIR, sidecarName);
  expect(existsSync(sidecarDir), `Directory missing: ${sidecarName}`).toBe(true);

  for (const file of REQUIRED_FILES) {
    const filePath = join(sidecarDir, file);
    expect(existsSync(filePath), `Missing file: ${sidecarName}/${file}`).toBe(true);
    const content = readFile(filePath);
    expect(content.length, `Empty file: ${sidecarName}/${file}`).toBeGreaterThan(0);
  }
}

/**
 * E9-S2: Tier 1 Memory — Theo, Derek, Nate
 *
 * Per E9-S22, Tier 1 sidecars ship as empty templates (entry_count: 0).
 * Migration content (ADRs, velocity data, E9-S3 entries) is populated at
 * runtime by the respective agents, not committed to the repository.
 * These tests validate the shipped template structure, not populated content.
 */
describe("E9-S2: Tier 1 Memory — Theo, Derek, Nate", () => {
  // AC1: Architect sidecar (Theo, 150K)
  describe("AC1: Architect sidecar structure", () => {
    it("architect-sidecar exists with 3 canonical files", () => {
      validateSidecarStructure("architect-sidecar");
    });

    it("architect ground-truth.md has last-refresh metadata", () => {
      const content = readFile(sidecarPath("architect-sidecar", "ground-truth.md"));
      const hasYamlMeta = /last_refresh:/.test(content);
      const hasHtmlMeta = /<!-- last-refresh/.test(content);
      expect(hasYamlMeta || hasHtmlMeta, "ground-truth.md missing last-refresh metadata").toBe(
        true
      );
    });

    it("architect ground-truth budget is 150K in config.yaml", () => {
      const config = yaml.load(readFile(CONFIG_YAML));
      expect(config.agents.architect.ground_truth_budget).toBe(150000);
    });
  });

  // AC2: PM sidecar (Derek, 100K)
  describe("AC2: PM sidecar structure", () => {
    it("pm-sidecar exists with 3 canonical files", () => {
      validateSidecarStructure("pm-sidecar");
    });

    it("pm ground-truth.md has last-refresh metadata", () => {
      const content = readFile(sidecarPath("pm-sidecar", "ground-truth.md"));
      const hasYamlMeta = /last_refresh:/.test(content);
      const hasHtmlMeta = /<!-- last-refresh/.test(content);
      expect(hasYamlMeta || hasHtmlMeta, "ground-truth.md missing last-refresh metadata").toBe(
        true
      );
    });

    it("pm ground-truth budget is 100K in config.yaml", () => {
      const config = yaml.load(readFile(CONFIG_YAML));
      expect(config.agents.pm.ground_truth_budget).toBe(100000);
    });
  });

  // AC3: SM sidecar (Nate, 100K)
  describe("AC3: SM sidecar structure", () => {
    it("sm-sidecar exists with 3 canonical files", () => {
      validateSidecarStructure("sm-sidecar");
    });

    it("sm ground-truth.md has last-refresh metadata", () => {
      const content = readFile(sidecarPath("sm-sidecar", "ground-truth.md"));
      const hasYamlMeta = /last_refresh:/.test(content);
      const hasHtmlMeta = /<!-- last-refresh/.test(content);
      expect(hasYamlMeta || hasHtmlMeta, "ground-truth.md missing last-refresh metadata").toBe(
        true
      );
    });

    it("sm ground-truth budget is 100K in config.yaml", () => {
      const config = yaml.load(readFile(CONFIG_YAML));
      expect(config.agents.sm.ground_truth_budget).toBe(100000);
    });
  });

  // AC4: Legacy files removed post-migration
  describe("AC4: Legacy files removed", () => {
    it("legacy architecture-decisions.md is removed", () => {
      expect(
        existsSync(sidecarPath("architect-sidecar", "architecture-decisions.md")),
        "architecture-decisions.md should be removed after migration"
      ).toBe(false);
    });

    it("legacy velocity-data.md is removed", () => {
      expect(
        existsSync(sidecarPath("sm-sidecar", "velocity-data.md")),
        "velocity-data.md should be removed after migration"
      ).toBe(false);
    });
  });

  // AC5: PM sidecar is greenfield with stub headers
  describe("AC5: PM sidecar greenfield creation", () => {
    it("pm ground-truth.md has stub header with metadata", () => {
      const content = readFile(sidecarPath("pm-sidecar", "ground-truth.md"));
      expect(content).toMatch(/Ground Truth|ground.truth/i);
      const hasYamlMeta = /last_refresh:/.test(content);
      const hasHtmlMeta = /<!-- last-refresh/.test(content);
      expect(hasYamlMeta || hasHtmlMeta).toBe(true);
    });

    it("pm decision-log.md has Decision Log header", () => {
      const content = readFile(sidecarPath("pm-sidecar", "decision-log.md"));
      expect(content).toMatch(/Decision Log|decision.log/i);
    });

    it("pm conversation-context.md has Conversation Context header", () => {
      const content = readFile(sidecarPath("pm-sidecar", "conversation-context.md"));
      expect(content).toMatch(/Conversation Context|conversation.context/i);
    });
  });

  // AC6: Cross-sidecar consistency verification
  describe("AC6: Cross-sidecar consistency", () => {
    it("all 4 Tier 1 sidecars have identical file structure", () => {
      for (const sidecar of TIER_1_SIDECARS) {
        const sidecarDir = join(MEMORY_DIR, sidecar);
        expect(existsSync(sidecarDir), `Missing: ${sidecar}`).toBe(true);

        for (const file of REQUIRED_FILES) {
          expect(existsSync(join(sidecarDir, file)), `Missing: ${sidecar}/${file}`).toBe(true);
        }
      }
    });

    it("all ground-truth.md files have last-refresh metadata", () => {
      for (const sidecar of TIER_1_SIDECARS) {
        const content = readFile(sidecarPath(sidecar, "ground-truth.md"));
        const hasYamlMeta = /last_refresh:/.test(content);
        const hasHtmlMeta = /<!-- last-refresh/.test(content);
        expect(
          hasYamlMeta || hasHtmlMeta,
          `${sidecar}/ground-truth.md missing last-refresh metadata`
        ).toBe(true);
      }
    });

    it("all Tier 1 ground-truth.md files ship with entry_count: 0 (empty template)", () => {
      for (const sidecar of TIER_1_SIDECARS) {
        const content = readFile(sidecarPath(sidecar, "ground-truth.md"));
        const match = content.match(/entry_count:\s*(\d+)/);
        expect(match, `${sidecar}/ground-truth.md missing entry_count field`).not.toBeNull();
        expect(
          parseInt(match[1], 10),
          `${sidecar}/ground-truth.md should ship with entry_count: 0`
        ).toBe(0);
      }
    });

    it("config.yaml budgets match: architect=150K, pm=100K, sm=100K", () => {
      const config = yaml.load(readFile(CONFIG_YAML));
      expect(config.agents.architect.ground_truth_budget).toBe(150000);
      expect(config.agents.pm.ground_truth_budget).toBe(100000);
      expect(config.agents.sm.ground_truth_budget).toBe(100000);
    });
  });

  // AC7: Persona declarations verification (read-only check)
  describe("AC7: Persona memory declarations intact", () => {
    const agents = [
      { file: "architect.md", sidecar: "architect-sidecar" },
      { file: "pm.md", sidecar: "pm-sidecar" },
      { file: "sm.md", sidecar: "sm-sidecar" },
    ];

    for (const agent of agents) {
      it(`${agent.file} has 3 sidecar declarations`, () => {
        const filePath = join(GAIA_DIR, "lifecycle", "agents", agent.file);
        expect(existsSync(filePath), `${agent.file} not found`).toBe(true);

        const content = readFile(filePath);
        const sidecarMatches =
          content.match(new RegExp(`<memory sidecar=.*${agent.sidecar}`, "g")) || [];
        expect(sidecarMatches.length, `${agent.file} should have 3 sidecar declarations`).toBe(3);
      });
    }
  });

  // Legacy file cleanup
  describe("Legacy file cleanup", () => {
    it("no .gitkeep files in sidecars with real content", () => {
      for (const sidecar of ["architect-sidecar", "pm-sidecar", "sm-sidecar"]) {
        expect(
          existsSync(join(MEMORY_DIR, sidecar, ".gitkeep")),
          `${sidecar}/.gitkeep should be removed`
        ).toBe(false);
      }
    });
  });

  // Conversation-context structure validation
  describe("Conversation-context structure", () => {
    it("all Tier 1 conversation-context.md files have YAML frontmatter", () => {
      for (const sidecar of ["architect-sidecar", "pm-sidecar", "sm-sidecar"]) {
        const content = readFile(sidecarPath(sidecar, "conversation-context.md"));
        expect(
          content,
          `${sidecar}/conversation-context.md should start with YAML frontmatter`
        ).toMatch(/^---\r?\n/);
        expect(content).toMatch(/agent:/);
        expect(content).toMatch(/tier: 1/);
      }
    });

    it("all Tier 1 conversation-context.md files have agent-specific headers", () => {
      const expectedHeaders = {
        "architect-sidecar": /Theo|Architect/i,
        "pm-sidecar": /Derek|Product Manager/i,
        "sm-sidecar": /Nate|Scrum Master/i,
      };
      for (const [sidecar, pattern] of Object.entries(expectedHeaders)) {
        const content = readFile(sidecarPath(sidecar, "conversation-context.md"));
        expect(
          content,
          `${sidecar}/conversation-context.md should have agent-specific header`
        ).toMatch(pattern);
      }
    });
  });

  // Ground-truth YAML frontmatter field validation
  describe("Ground-truth frontmatter completeness", () => {
    it("all Tier 1 ground-truth.md files have required YAML frontmatter fields", () => {
      const expectedBudgets = {
        "architect-sidecar": 150000,
        "pm-sidecar": 100000,
        "sm-sidecar": 100000,
      };
      for (const [sidecar, budget] of Object.entries(expectedBudgets)) {
        const content = readFile(sidecarPath(sidecar, "ground-truth.md"));
        expect(content, `${sidecar}/ground-truth.md should have agent field`).toMatch(/agent:/);
        expect(content, `${sidecar}/ground-truth.md should have tier field`).toMatch(/tier: 1/);
        expect(content, `${sidecar}/ground-truth.md should have token_budget field`).toMatch(
          new RegExp(`token_budget: ${budget}`)
        );
      }
    });
  });

  // SM decision-log stub header
  describe("SM decision-log stub structure", () => {
    it("sm decision-log.md has proper header", () => {
      const content = readFile(sidecarPath("sm-sidecar", "decision-log.md"));
      expect(content).toMatch(/Decision Log|decision.log/i);
      expect(content).toMatch(/Nate|Scrum Master/i);
    });
  });

  // Exact file count per sidecar (no extra files)
  describe("Sidecar file count", () => {
    it("each Tier 1 sidecar has exactly 3 files (no extra files)", () => {
      for (const sidecar of ["architect-sidecar", "pm-sidecar", "sm-sidecar"]) {
        const sidecarDir = join(MEMORY_DIR, sidecar);
        const files = readdirSync(sidecarDir).filter((f) => !f.startsWith(".") && f !== "archive");
        expect(files.sort(), `${sidecar} should have exactly 3 files`).toEqual(
          REQUIRED_FILES.sort()
        );
      }
    });
  });
});
