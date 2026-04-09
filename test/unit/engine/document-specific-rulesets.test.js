import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

const RULESETS_SKILL_PATH = `${PROJECT_ROOT}/_gaia/lifecycle/skills/document-rulesets.md`;
const SKILL_MANIFEST_PATH = `${PROJECT_ROOT}/_gaia/_config/skill-manifest.csv`;
const VAL_INSTRUCTIONS_PATH = `${PROJECT_ROOT}/_gaia/lifecycle/workflows/4-implementation/val-validate-artifact/instructions.xml`;
const VAL_WORKFLOW_PATH = `${PROJECT_ROOT}/_gaia/lifecycle/workflows/4-implementation/val-validate-artifact/workflow.yaml`;

/** Extract content between section markers */
function extractSection(content, sectionName) {
  const startMarker = `<!-- SECTION: ${sectionName} -->`;
  const endMarker = `<!-- END SECTION -->`;
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return "";
  const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) return "";
  return content.slice(startIdx + startMarker.length, endIdx);
}

describe("E10-S2: Document-Specific Validation Rulesets", () => {
  // ── AC1: Artifact type detection from file path ──
  describe("AC1: Artifact type detection from file path", () => {
    it("document-rulesets skill file exists", () => {
      expect(
        existsSync(RULESETS_SKILL_PATH),
        `Skill file not found at ${RULESETS_SKILL_PATH}`
      ).toBe(true);
    });

    it("has a type-detection section with path-to-ruleset mapping", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section, "Missing type-detection section").not.toBe("");
      // Must map file paths to ruleset identifiers
      expect(section).toContain("prd-rules");
      expect(section).toContain("arch-rules");
      expect(section).toContain("ux-rules");
      expect(section).toContain("test-plan-rules");
      expect(section).toContain("epics-rules");
    });

    it("maps prd.md to prd-rules", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section).toMatch(/prd\.md.*prd-rules|prd-rules.*prd\.md/s);
    });

    it("maps architecture.md to arch-rules", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section).toMatch(/architecture\.md.*arch-rules|arch-rules.*architecture\.md/s);
    });

    it("maps ux-design.md to ux-rules", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section).toMatch(/ux-design\.md.*ux-rules|ux-rules.*ux-design\.md/s);
    });

    it("maps test-plan.md to test-plan-rules", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section).toMatch(/test-plan\.md.*test-plan-rules|test-plan-rules.*test-plan\.md/s);
    });

    it("maps epics-and-stories.md to epics-rules", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section).toMatch(
        /epics-and-stories\.md.*epics-rules|epics-rules.*epics-and-stories\.md/s
      );
    });

    it("handles edge cases — nested directories and custom paths", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      // Must describe handling of edge cases
      expect(section).toMatch(/edge.?case|nested|custom.?path|fallback/i);
    });
  });

  // ── AC2: prd-rules validates all PRD quality checks ──
  describe("AC2: prd-rules completeness (absorbs validate-prd)", () => {
    it("has a prd-rules section", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      expect(section, "Missing prd-rules section").not.toBe("");
    });

    it("checks section completeness", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      expect(section).toMatch(/section.*completeness|completeness.*check/i);
      // Must list required sections
      expect(section).toMatch(/overview|persona|functional.*req|non.?functional/i);
    });

    it("validates FR/NFR sequential numbering", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      expect(section).toMatch(/sequential.*number|FR-\d|NFR-\d|numbering/i);
    });

    it("checks acceptance criteria quality", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      expect(section).toMatch(/acceptance.*criteria|AC.*quality/i);
    });

    it("validates priority consistency", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      expect(section).toMatch(/priority.*consist|P0|P1|P2|P3/i);
    });

    it("checks persona cross-references", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      expect(section).toMatch(/persona.*cross.?ref|persona.*match/i);
    });

    it("absorbs all existing validate-prd checks", () => {
      // Verify prd-rules covers the same checks as validate-prd instructions.xml
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      // validate-prd checks: completeness, structural (numbering, AC, priorities, personas), quality, consistency
      expect(section).toMatch(/completeness/i);
      expect(section).toMatch(/numbering|sequential/i);
      expect(section).toMatch(/acceptance.*criteria/i);
      expect(section).toMatch(/priority/i);
      expect(section).toMatch(/persona/i);
      expect(section).toMatch(/consistency|contradict/i);
      expect(section).toMatch(/quality|testable|unambiguous|measurable/i);
    });
  });

  // ── AC3: arch-rules validates architecture documents ──
  describe("AC3: arch-rules for architecture documents", () => {
    it("has an arch-rules section", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "arch-rules");
      expect(section, "Missing arch-rules section").not.toBe("");
    });

    it("verifies component coverage", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "arch-rules");
      expect(section).toMatch(/component.*coverage/i);
    });

    it("checks ADR consistency", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "arch-rules");
      expect(section).toMatch(/ADR.*consist/i);
    });

    it("validates API completeness", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "arch-rules");
      expect(section).toMatch(/API.*complete/i);
    });
  });

  // ── AC4: ux-rules, test-plan-rules, epics-rules ──
  describe("AC4: Additional artifact-type rulesets", () => {
    it("has a ux-rules section with structural checks", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "ux-rules");
      expect(section, "Missing ux-rules section").not.toBe("");
      expect(section).toMatch(/structural|structure|section/i);
    });

    it("has a test-plan-rules section with structural checks", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "test-plan-rules");
      expect(section, "Missing test-plan-rules section").not.toBe("");
      expect(section).toMatch(/structural|structure|section/i);
    });

    it("has an epics-rules section with structural checks", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "epics-rules");
      expect(section, "Missing epics-rules section").not.toBe("");
      expect(section).toMatch(/structural|structure|section/i);
    });
  });

  // ── AC5: Two-pass validation logic ──
  describe("AC5: Two-pass validation in val-validate-artifact", () => {
    it("val-validate-artifact instructions contain artifact type detection step", () => {
      const content = readFileSync(VAL_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/artifact.?type|type.?detect|detect.*type/i);
    });

    it("val-validate-artifact instructions describe two-pass validation", () => {
      const content = readFileSync(VAL_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/two.?pass|first.*pass|second.*pass|pass.*1|pass.*2/i);
    });

    it("document-specific rules run before factual claim verification", () => {
      const content = readFileSync(VAL_INSTRUCTIONS_PATH, "utf8");
      // The type detection / document rules step must come before the existing claim extraction step
      const typeDetectionIdx = content.search(/artifact.?type|type.?detect|document.?specific/i);
      const claimExtractionIdx = content.search(/Extract Claims|claim.?extraction/i);
      expect(typeDetectionIdx, "Type detection not found in instructions").toBeGreaterThan(-1);
      expect(claimExtractionIdx, "Claim extraction not found in instructions").toBeGreaterThan(-1);
      expect(typeDetectionIdx, "Type detection must come before claim extraction").toBeLessThan(
        claimExtractionIdx
      );
    });

    it("findings from both passes are merged", () => {
      const content = readFileSync(VAL_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/merge.*finding|combine.*finding|both.*pass/i);
    });
  });

  // ── AC6: Unknown type fallback ──
  describe("AC6: Unknown artifact type fallback", () => {
    it("type-detection section describes unknown type fallback", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section).toMatch(/unknown|fallback|no.*match|unrecognized/i);
    });

    it("unknown types skip document-specific rules, run factual claims only", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "type-detection");
      expect(section).toMatch(/skip.*document|factual.*only|claim.*verification.*only/i);
    });

    it("val-validate-artifact instructions handle unknown type gracefully", () => {
      const content = readFileSync(VAL_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/unknown.*type|no.*ruleset|skip.*structural/i);
    });
  });

  // ── Test Scenarios from story ──
  describe("Test Scenario 7: Two-pass order verification", () => {
    it("instructions explicitly state structural findings come before factual", () => {
      const content = readFileSync(VAL_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(
        /structural.*first|document.?specific.*first|first.*pass.*structural/i
      );
    });
  });

  describe("Test Scenario 8: PRD absorbs validate-prd", () => {
    it("prd-rules references validate-prd absorption", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const section = extractSection(content, "prd-rules");
      expect(section).toMatch(/absorb|replac|superced|validate.?prd/i);
    });
  });

  // ── Structural tests ──
  describe("Skill file structure", () => {
    it("has valid YAML frontmatter", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      expect(frontmatterMatch, "No YAML frontmatter found").toBeTruthy();
      const frontmatter = frontmatterMatch[1];
      expect(frontmatter).toMatch(/name:\s*document-rulesets/);
      expect(frontmatter).toMatch(/applicable_agents:.*validator/);
      expect(frontmatter).toMatch(/sections:/);
    });

    it("lists all 7 sections in frontmatter", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      expect(frontmatterMatch, "No YAML frontmatter found").toBeTruthy();
      const frontmatter = frontmatterMatch[1];
      const expectedSections = [
        "type-detection",
        "prd-rules",
        "arch-rules",
        "ux-rules",
        "test-plan-rules",
        "epics-rules",
        "two-pass-logic",
      ];
      for (const section of expectedSections) {
        expect(frontmatter, `Frontmatter missing section: ${section}`).toContain(section);
      }
    });

    it("has matching section start and end markers", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const sectionStarts = (content.match(/<!-- SECTION: [\w-]+ -->/g) || []).length;
      const sectionEnds = (content.match(/<!-- END SECTION -->/g) || []).length;
      expect(sectionStarts).toBe(10);
      expect(sectionEnds).toBe(10);
    });

    it("is within the 500-line skill limit", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const lineCount = content.split("\n").length;
      expect(
        lineCount,
        `Skill file is ${lineCount} lines — exceeds 500-line limit`
      ).toBeLessThanOrEqual(500);
    });

    it("each section is within 65-line limit", () => {
      const content = readFileSync(RULESETS_SKILL_PATH, "utf8");
      const expectedSections = [
        "type-detection",
        "prd-rules",
        "arch-rules",
        "ux-rules",
        "test-plan-rules",
        "epics-rules",
        "two-pass-logic",
      ];
      for (const section of expectedSections) {
        const sectionContent = extractSection(content, section);
        const sectionLines = sectionContent.trim().split("\n").length;
        expect(
          sectionLines,
          `Section ${section} is ${sectionLines} lines — exceeds 65-line max`
        ).toBeLessThanOrEqual(65);
      }
    });
  });

  // ── Manifest integration ──
  describe("Skill manifest integration", () => {
    it("skill-manifest.csv has a document-rulesets entry", () => {
      const manifest = readFileSync(SKILL_MANIFEST_PATH, "utf8");
      expect(manifest, "skill-manifest.csv missing document-rulesets entry").toContain(
        "document-rulesets"
      );
    });

    it("manifest entry references correct path", () => {
      const manifest = readFileSync(SKILL_MANIFEST_PATH, "utf8");
      const lines = manifest.split("\n");
      const entry = lines.find((l) => l.includes("document-rulesets"));
      expect(entry, "No manifest entry found").toBeTruthy();
      expect(entry).toContain("_gaia/lifecycle/skills/document-rulesets.md");
    });

    it("manifest entry lists validator as applicable agent", () => {
      const manifest = readFileSync(SKILL_MANIFEST_PATH, "utf8");
      const lines = manifest.split("\n");
      const entry = lines.find((l) => l.includes("document-rulesets"));
      expect(entry, "No manifest entry found").toBeTruthy();
      expect(entry).toContain("validator");
    });
  });

  // ── Workflow integration ──
  describe("Workflow integration", () => {
    it("val-validate-artifact workflow.yaml references document-rulesets skill", () => {
      const content = readFileSync(VAL_WORKFLOW_PATH, "utf8");
      expect(content).toContain("document-rulesets");
    });
  });
});
