import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const BROWNFIELD_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "instructions.xml"
);
const GAP_SCHEMA_TEMPLATE = join(GAIA_DIR, "lifecycle", "templates", "gap-entry-schema.md");

/**
 * Extract content for a specific step from the instructions XML.
 * Handles both integer and decimal step numbers (e.g., "3" or "3.5").
 */
function extractStep(xmlContent, stepNumber) {
  const escaped = stepNumber.replace(".", "\\.");
  const regex = new RegExp(`<step\\s+n="${escaped}"[^>]*>([\\s\\S]*?)</step>`, "i");
  const match = xmlContent.match(regex);
  return match ? match[1] : "";
}

describe("E11-S10: Gap Consolidation & Deduplication", () => {
  // Load files once for all tests
  const instructions = readFileSync(BROWNFIELD_INSTRUCTIONS, "utf-8");
  const step35 = extractStep(instructions, "3.5");
  const step35Lower = step35.toLowerCase();

  // AC1: Step 3.5 exists in brownfield workflow
  describe("AC1: Consolidation step insertion", () => {
    it("brownfield instructions.xml contains Step 3.5", () => {
      expect(instructions).toContain('n="3.5"');
    });

    it("Step 3.5 has title containing consolidation", () => {
      const stepMatch = instructions.match(/<step\s+n="3\.5"\s+title="([^"]+)"/);
      expect(stepMatch).not.toBeNull();
      expect(stepMatch[1].toLowerCase()).toContain("consolidat");
    });

    it("Step 3.5 appears between Step 3 and Step 4", () => {
      const step3Pos = instructions.indexOf('n="3"');
      const step35Pos = instructions.indexOf('n="3.5"');
      const step4Pos = instructions.indexOf('n="4"');
      expect(step3Pos).toBeGreaterThan(-1);
      expect(step35Pos).toBeGreaterThan(step3Pos);
      expect(step35Pos).toBeLessThan(step4Pos);
    });
  });

  // AC2: Loads all scan outputs
  describe("AC2: Scan output loading", () => {
    it("Step 3.5 references all 7 deep analysis scan types", () => {
      const scanTypes = [
        "config-contradiction",
        "dead-code",
        "hardcoded",
        "security",
        "runtime-behavior",
        "doc-code",
        "integration-seam",
      ];
      for (const scanType of scanTypes) {
        expect(step35).toContain(scanType);
      }
    });

    it("Step 3.5 references Step 2 documentation subagent outputs", () => {
      expect(step35Lower).toContain("api");
      expect(step35Lower).toContain("event");
      expect(step35Lower).toContain("frontend");
      expect(step35Lower).toContain("dependency");
    });

    it("Step 3.5 references Step 3 test execution results", () => {
      expect(step35Lower).toContain("test");
    });
  });

  // AC3: Deduplication algorithm
  describe("AC3: Deduplication", () => {
    it("Step 3.5 specifies dedup by evidence_file + evidence_line", () => {
      expect(step35).toContain("evidence_file");
      expect(step35).toContain("evidence_line");
    });

    it("Step 3.5 specifies highest severity retention", () => {
      expect(step35Lower).toContain("highest severity");
    });

    it("Step 3.5 specifies merged_from field", () => {
      expect(step35).toContain("merged_from");
    });

    it("Step 3.5 specifies recommendation merging", () => {
      expect(step35Lower).toMatch(/merg.*recommendation|recommendation.*merg/);
    });
  });

  // AC4: Ranking
  describe("AC4: Ranking", () => {
    it("Step 3.5 specifies severity-based ranking", () => {
      expect(step35Lower).toContain("severity");
      expect(step35Lower).toMatch(/rank|sort/);
    });

    it("Step 3.5 specifies confidence as secondary sort", () => {
      expect(step35Lower).toContain("confidence");
    });

    it("Step 3.5 specifies category alphabetical sort", () => {
      expect(step35Lower).toMatch(/category.*alpha|alpha.*category/);
    });
  });

  // AC5: Output to consolidated-gaps.md
  describe("AC5: Consolidated output", () => {
    it("Step 3.5 outputs to consolidated-gaps.md", () => {
      expect(step35).toContain("consolidated-gaps.md");
    });

    it("Step 3.5 references the gap schema template", () => {
      expect(step35).toContain("gap-entry-schema.md");
    });
  });

  // AC6: Summary statistics
  describe("AC6: Summary statistics", () => {
    it("Step 3.5 specifies summary statistics generation", () => {
      expect(step35Lower).toContain("summary");
      expect(step35Lower).toMatch(/total.*gap|gap.*total|raw.*count|pre-dedup/);
      expect(step35Lower).toMatch(/duplicat.*removed|removed.*duplicat|dedup/);
    });
  });

  // AC7: Empty/missing file handling
  describe("AC7: Empty/missing file handling", () => {
    it("Step 3.5 handles empty or missing scan files gracefully", () => {
      expect(step35Lower).toMatch(/empty|missing/);
      expect(step35Lower).toMatch(/warn|log/);
    });
  });

  // AC8: Malformed entry handling
  describe("AC8: Malformed entry handling", () => {
    it("Step 3.5 validates gap entries against schema", () => {
      expect(step35Lower).toMatch(/malform|invalid|missing.*field|required.*field/);
      expect(step35Lower).toMatch(/skip|warn/);
    });
  });

  // AC9: Token budget enforcement
  describe("AC9: Token budget", () => {
    it("Step 3.5 enforces 40K token budget", () => {
      expect(step35).toMatch(/40K|40,?000|40k/i);
      expect(step35Lower).toMatch(/token.*budget|budget.*token/);
    });

    it("Step 3.5 truncates low-severity entries when over budget", () => {
      expect(step35Lower).toMatch(/truncat|omit/);
      expect(step35Lower).toMatch(/low.*sever|info/);
    });
  });

  // Schema template existence and content
  describe("Gap entry schema template", () => {
    it("gap-entry-schema.md exists in lifecycle templates", () => {
      expect(existsSync(GAP_SCHEMA_TEMPLATE)).toBe(true);
    });

    it("gap-entry-schema.md contains required fields", () => {
      const schema = readFileSync(GAP_SCHEMA_TEMPLATE, "utf-8");
      const requiredFields = [
        "id",
        "category",
        "severity",
        "title",
        "description",
        "evidence",
        "recommendation",
        "verified_by",
        "confidence",
      ];
      for (const field of requiredFields) {
        expect(schema).toContain(field);
      }
    });

    it("gap-entry-schema.md includes severity levels", () => {
      const schema = readFileSync(GAP_SCHEMA_TEMPLATE, "utf-8");
      for (const level of ["critical", "high", "medium", "low"]) {
        expect(schema).toContain(level);
      }
    });

    it("gap-entry-schema.md includes infrastructure categories", () => {
      const schema = readFileSync(GAP_SCHEMA_TEMPLATE, "utf-8");
      const infraCategories = [
        "resource-drift",
        "config-sprawl",
        "secret-exposure",
        "missing-policy",
        "environment-skew",
      ];
      for (const cat of infraCategories) {
        expect(schema).toContain(cat);
      }
    });
  });

  // Step 4 integration
  describe("Step 4 integration", () => {
    it("Step 4 references consolidated-gaps.md as input", () => {
      const step4 = extractStep(instructions, "4");
      expect(step4).toContain("consolidated-gaps.md");
    });
  });
});
