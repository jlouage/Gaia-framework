import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
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

describe("E9-S2: Tier 1 Memory — Theo, Derek, Nate", () => {
  // AC1: Architect sidecar (Theo, 150K)
  describe("AC1: Architect sidecar structure", () => {
    it("architect-sidecar exists with 3 canonical files", () => {
      validateSidecarStructure("architect-sidecar");
    });

    it("architect ground-truth.md has last-refresh metadata", () => {
      const content = readFile(sidecarPath("architect-sidecar", "ground-truth.md"));
      // Accept either YAML frontmatter last_refresh or HTML comment <!-- last-refresh -->
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

  // AC4: Architect decision-log migration — architecture-decisions.md consolidated
  describe("AC4: Architect decision-log migration", () => {
    it("architect decision-log contains migrated ADR entries from architecture-decisions.md", () => {
      const content = readFile(sidecarPath("architect-sidecar", "decision-log.md"));
      // architecture-decisions.md had ADR-012 through ADR-016 entries
      expect(content).toMatch(/ADR-012/);
      expect(content).toMatch(/ADR-013/);
      expect(content).toMatch(/ADR-014/);
    });

    it("architect decision-log contains original decision-log entries", () => {
      const content = readFile(sidecarPath("architect-sidecar", "decision-log.md"));
      // Original decision-log had architecture v1.2.1 update and dual directory entries
      expect(content).toMatch(/v1\.2\.1/);
      expect(content).toMatch(/Dual.*Directory|Dual.*_gaia/i);
    });

    it("architect decision-log preserves retro entries", () => {
      const content = readFile(sidecarPath("architect-sidecar", "decision-log.md"));
      // Retro entries from 2026-03-19 (skill budget) and 2026-03-20 (dual-directory friction)
      expect(content).toMatch(/300-Line Skill Budget|skill budget/i);
      expect(content).toMatch(/Version.*Drift|Version String Duplication/i);
    });

    it("architect decision-log entries use E9-S3 standardized format", () => {
      const content = readFile(sidecarPath("architect-sidecar", "decision-log.md"));
      // E9-S3 format: ### [YYYY-MM-DD] {Title} with Agent/Status fields
      const entries = content.match(/### \[\d{4}-\d{2}-\d{2}\]/g) || [];
      expect(entries.length, "No E9-S3 formatted entries found").toBeGreaterThan(0);
      // Each entry should have Agent and Status fields
      expect(content).toMatch(/\*\*Agent:\*\*/);
      expect(content).toMatch(/\*\*Status:\*\*/);
    });

    it("legacy architecture-decisions.md is removed", () => {
      expect(
        existsSync(sidecarPath("architect-sidecar", "architecture-decisions.md")),
        "architecture-decisions.md should be removed after migration"
      ).toBe(false);
    });
  });

  // AC5: SM velocity data migrated to ground-truth.md
  describe("AC5: SM velocity migration", () => {
    it("sm ground-truth.md contains sprint velocity data", () => {
      const content = readFile(sidecarPath("sm-sidecar", "ground-truth.md"));
      // Sprint 1: 20 pts, Sprint 2: 77 pts
      expect(content).toMatch(/Sprint 1|sprint-1/i);
      expect(content).toMatch(/Sprint 2|sprint-2/i);
      expect(content).toMatch(/20/);
      expect(content).toMatch(/77/);
    });

    it("sm ground-truth.md has velocity section", () => {
      const content = readFile(sidecarPath("sm-sidecar", "ground-truth.md"));
      expect(content).toMatch(/## Sprint Velocity|Velocity/i);
    });

    it("legacy velocity-data.md is removed", () => {
      expect(
        existsSync(sidecarPath("sm-sidecar", "velocity-data.md")),
        "velocity-data.md should be removed after migration"
      ).toBe(false);
    });
  });

  // AC6: PM sidecar is greenfield with stub headers
  describe("AC6: PM sidecar greenfield creation", () => {
    it("pm ground-truth.md has stub headers with metadata", () => {
      const content = readFile(sidecarPath("pm-sidecar", "ground-truth.md"));
      expect(content).toMatch(/Ground Truth|ground.truth/i);
      const hasYamlMeta = /last_refresh:/.test(content);
      const hasHtmlMeta = /<!-- last-refresh/.test(content);
      expect(hasYamlMeta || hasHtmlMeta).toBe(true);
    });

    it("pm decision-log.md has stub headers in E9-S3 format", () => {
      const content = readFile(sidecarPath("pm-sidecar", "decision-log.md"));
      expect(content).toMatch(/Decision Log|decision.log/i);
    });

    it("pm conversation-context.md has stub headers", () => {
      const content = readFile(sidecarPath("pm-sidecar", "conversation-context.md"));
      expect(content).toMatch(/Conversation Context|conversation.context/i);
    });
  });

  // AC7: Cross-sidecar consistency verification against Val reference
  describe("AC7: Cross-sidecar consistency", () => {
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

    it("all decision-log.md entries conform to E9-S3 format", () => {
      for (const sidecar of ["architect-sidecar", "validator-sidecar"]) {
        const content = readFile(sidecarPath(sidecar, "decision-log.md"));
        // Must have at least one E9-S3 formatted entry
        const entries = content.match(/### \[\d{4}-\d{2}-\d{2}\]/g) || [];
        expect(entries.length, `${sidecar}/decision-log.md has no E9-S3 entries`).toBeGreaterThan(
          0
        );
      }
    });

    it("config.yaml budgets match: architect=150K, pm=100K, sm=100K", () => {
      const config = yaml.load(readFile(CONFIG_YAML));
      expect(config.agents.architect.ground_truth_budget).toBe(150000);
      expect(config.agents.pm.ground_truth_budget).toBe(100000);
      expect(config.agents.sm.ground_truth_budget).toBe(100000);
    });
  });

  // AC8: Persona declarations verification (read-only check)
  describe("AC8: Persona memory declarations intact", () => {
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

  // Additional: Legacy file cleanup
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

  // Coverage gap: Conversation-context structure validation
  describe("Conversation-context structure", () => {
    it("all Tier 1 conversation-context.md files have YAML frontmatter", () => {
      for (const sidecar of ["architect-sidecar", "pm-sidecar", "sm-sidecar"]) {
        const content = readFile(sidecarPath(sidecar, "conversation-context.md"));
        expect(
          content,
          `${sidecar}/conversation-context.md should start with YAML frontmatter`
        ).toMatch(/^---\n/);
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

  // Coverage gap: Ground-truth YAML frontmatter field validation
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

  // Coverage gap: SM decision-log stub header
  describe("SM decision-log stub structure", () => {
    it("sm decision-log.md has proper header", () => {
      const content = readFile(sidecarPath("sm-sidecar", "decision-log.md"));
      expect(content).toMatch(/Decision Log|decision.log/i);
      expect(content).toMatch(/Nate|Scrum Master/i);
    });
  });

  // Coverage gap: Exact file count per sidecar (no extra files)
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

  // Coverage gap: Architect decision-log entry count after migration
  describe("Architect decision-log migration completeness", () => {
    it("architect decision-log has expected number of migrated entries", () => {
      const content = readFile(sidecarPath("architect-sidecar", "decision-log.md"));
      const entries = content.match(/### \[\d{4}-\d{2}-\d{2}\]/g) || [];
      // Story notes: consolidated architecture-decisions.md (2 entries) + decision-log.md (6 entries) = 8 total
      expect(entries.length, "Expected 8 migrated entries in architect decision-log").toBe(8);
    });
  });
});
