import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const SCAN_PROMPT_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "knowledge",
  "brownfield",
  "config-contradiction-scan.md"
);

const BROWNFIELD_INSTRUCTIONS_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "instructions.xml"
);

const CHECKLIST_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "checklist.md"
);

describe("E11-S2: Config Contradiction Scanner", () => {
  describe("Subagent Prompt Template", () => {
    it("prompt template file exists at expected path (AC1)", () => {
      expect(existsSync(SCAN_PROMPT_PATH)).toBe(true);
    });

    it("references gap schema for output formatting (AC5)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/gap.*schema|gap-entry-schema/i);
    });

    it("specifies category as config-contradiction (AC5)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toContain("config-contradiction");
    });

    it("specifies verified_by as machine-detected (AC5)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toContain("machine-detected");
    });

    it("specifies GAP-CONFIG sequential ID format (AC5)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/GAP-CONFIG/);
    });
  });

  describe("Config File Discovery (AC2)", () => {
    it("includes discovery patterns for all 8 config file types", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      const types = [".yaml", ".yml", ".json", ".env", ".toml", ".ini", ".properties", ".xml"];
      for (const ext of types) {
        expect(content).toContain(ext);
      }
    });

    it("excludes non-config directories (node_modules, vendor, dist, .git)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/node_modules/);
      expect(content).toMatch(/vendor/);
      expect(content).toMatch(/dist/);
      expect(content).toMatch(/\.git/);
    });
  });

  describe("Stack-Aware Patterns (AC4)", () => {
    it("includes Spring profile patterns", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/application\.yml/);
      expect(content).toMatch(/application\.properties/);
      expect(content).toMatch(/bootstrap\.yml/);
    });

    it("includes Node/Express config patterns", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/\.env\.production|\.env\.development/);
    });

    it("includes Python/Django settings patterns", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/settings\.py/);
    });

    it("includes Go config patterns", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/config\.yaml/);
      expect(content).toMatch(/go\.mod|mapstructure/);
    });
  });

  describe("Contradiction Detection Logic (AC3)", () => {
    it("describes cross-referencing key-value maps across files", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/cross.?referenc|compare.*key|key.*map/i);
    });

    it("detects port/host/URL mismatches between services", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/port.*host.*url.*mismatch/i);
    });
  });

  describe("Budget Control (AC6)", () => {
    it("specifies max ~70 gap entries", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/70/);
    });

    it("includes selective scanning strategy", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/selective|prioritize|budget/i);
    });

    it("includes truncation with count summary for overflow", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/truncat|omit|summary/i);
    });
  });

  describe("Edge Cases (AC7, AC8)", () => {
    it("truncates low-severity entries when budget exceeded (AC7)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/truncate.*low.severity/i);
    });

    it("excludes lock files and test fixtures (AC7)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/package-lock\.json/);
      expect(content).toMatch(/test fixture/i);
    });

    it("detects environment-specific override conflicts (AC8)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/environment.specific.*override/i);
      expect(content).toMatch(/conflict|contradict/i);
    });
  });

  describe("Brownfield Workflow Integration (AC1)", () => {
    it("brownfield instructions.xml contains Step 2.5 for deep analysis", () => {
      const content = readFileSync(BROWNFIELD_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/step.*n=["']?2\.5|2\.5.*[Dd]eep [Aa]nalysis/i);
    });

    it("Step 2.5 references config-contradiction scan subagent", () => {
      const content = readFileSync(BROWNFIELD_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/config.contradiction/i);
    });

    it("output targets brownfield-scan-config-contradiction.md", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/brownfield-scan-config-contradiction\.md/);
    });

    it("checklist.md includes Step 2.5 validation items", () => {
      const content = readFileSync(CHECKLIST_PATH, "utf8");
      expect(content).toMatch(/step 2\.5|deep analysis/i);
    });
  });
});
