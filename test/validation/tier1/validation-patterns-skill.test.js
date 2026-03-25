import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

const SKILL_PATH = `${PROJECT_ROOT}/_gaia/lifecycle/skills/validation-patterns.md`;
const MANIFEST_PATH = `${PROJECT_ROOT}/_gaia/_config/skill-manifest.csv`;

const EXPECTED_SECTIONS = [
  "claim-extraction",
  "filesystem-verification",
  "cross-reference",
  "severity-classification",
  "findings-formatting",
];

describe("E8-S10: Validation Patterns Skill", () => {
  // AC1: Skill file exists at correct path
  describe("AC1: Skill file structure", () => {
    it("should exist at _gaia/lifecycle/skills/validation-patterns.md", () => {
      expect(existsSync(SKILL_PATH), `Skill file not found at ${SKILL_PATH}`).toBe(true);
    });

    it("should have all 5 section markers", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      for (const section of EXPECTED_SECTIONS) {
        expect(content, `Missing section marker: <!-- SECTION: ${section} -->`).toContain(
          `<!-- SECTION: ${section} -->`
        );
      }
    });

    it("should have matching end markers for each section", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const sectionStarts = (content.match(/<!-- SECTION: [\w-]+ -->/g) || []).length;
      const sectionEnds = (content.match(/<!-- END SECTION -->/g) || []).length;
      expect(sectionStarts).toBe(5);
      expect(sectionEnds).toBe(5);
    });

    it("should have sections in correct order", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      let lastIndex = -1;
      for (const section of EXPECTED_SECTIONS) {
        const idx = content.indexOf(`<!-- SECTION: ${section} -->`);
        expect(idx, `Section ${section} not found`).toBeGreaterThan(-1);
        expect(idx, `Section ${section} is out of order`).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }
    });
  });

  // AC2: Each section is self-contained
  describe("AC2: Section independence", () => {
    it("each section should not reference other section names internally", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      for (const section of EXPECTED_SECTIONS) {
        const startMarker = `<!-- SECTION: ${section} -->`;
        const endMarker = `<!-- END SECTION -->`;
        const startIdx = content.indexOf(startMarker);
        const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);
        const sectionContent = content.slice(startIdx + startMarker.length, endIdx);

        // Check that this section doesn't reference other section markers
        const otherSections = EXPECTED_SECTIONS.filter((s) => s !== section);
        for (const other of otherSections) {
          expect(
            sectionContent,
            `Section ${section} references section ${other} — sections must be self-contained`
          ).not.toContain(`<!-- SECTION: ${other} -->`);
        }
      }
    });
  });

  // AC3: Line count within limits
  describe("AC3: Size constraints", () => {
    it("should be within the 500-line skill limit", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const lineCount = content.split("\n").length;
      expect(
        lineCount,
        `Skill file is ${lineCount} lines — exceeds 500-line limit`
      ).toBeLessThanOrEqual(500);
    });

    it("each section should be approximately 50-60 lines (max 65)", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      for (const section of EXPECTED_SECTIONS) {
        const startMarker = `<!-- SECTION: ${section} -->`;
        const endMarker = `<!-- END SECTION -->`;
        const startIdx = content.indexOf(startMarker);
        const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);
        const sectionContent = content.slice(startIdx + startMarker.length, endIdx);
        const sectionLines = sectionContent.trim().split("\n").length;
        expect(
          sectionLines,
          `Section ${section} is ${sectionLines} lines — exceeds 65-line max`
        ).toBeLessThanOrEqual(65);
      }
    });
  });

  // AC4: Skill manifest entry
  describe("AC4: Skill manifest", () => {
    it("should have a validation-patterns entry in skill-manifest.csv", () => {
      const manifest = readFileSync(MANIFEST_PATH, "utf8");
      expect(manifest, "skill-manifest.csv missing validation-patterns entry").toContain(
        "validation-patterns"
      );
    });

    it("manifest entry should reference lifecycle module path", () => {
      const manifest = readFileSync(MANIFEST_PATH, "utf8");
      const lines = manifest.split("\n");
      const entry = lines.find((l) => l.includes("validation-patterns"));
      expect(entry, "No manifest entry found").toBeTruthy();
      expect(entry, "Manifest entry should reference lifecycle skills path").toContain(
        "_gaia/lifecycle/skills/validation-patterns.md"
      );
    });

    it("manifest entry should list validator as applicable agent", () => {
      const manifest = readFileSync(MANIFEST_PATH, "utf8");
      const lines = manifest.split("\n");
      const entry = lines.find((l) => l.includes("validation-patterns"));
      expect(entry, "No manifest entry found").toBeTruthy();
      expect(entry, "Manifest entry should include validator agent").toContain("validator");
    });
  });

  // Test scenario 8: claim-extraction content
  describe("Content: claim-extraction section", () => {
    it("should define factual claim types (inclusion list)", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "claim-extraction");
      // Should mention file references, versions, paths, counts
      expect(section).toMatch(/file.?ref/i);
      expect(section).toMatch(/version/i);
      expect(section).toMatch(/path/i);
      expect(section).toMatch(/count/i);
    });

    it("should define non-factual exclusions", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "claim-extraction");
      // Should mention opinions, goals, aspirational
      expect(section).toMatch(/opinion/i);
      expect(section).toMatch(/goal|aspirational/i);
    });
  });

  // Test scenario 9/10/11: filesystem-verification content
  describe("Content: filesystem-verification section", () => {
    it("should handle symlinks", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "filesystem-verification");
      expect(section).toMatch(/symlink/i);
    });

    it("should handle binary files", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "filesystem-verification");
      expect(section).toMatch(/binary/i);
    });

    it("should handle out-of-boundary files", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "filesystem-verification");
      expect(section).toMatch(/boundary|outside.*project.?root/i);
    });
  });

  // Test scenario 12: severity-classification determinism
  describe("Content: severity-classification section", () => {
    it("should have a deterministic decision tree or rubric", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "severity-classification");
      expect(section).toMatch(/decision.?tree|rubric|flowchart|if.*then/i);
    });

    it("should define all three severity levels", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "severity-classification");
      expect(section).toMatch(/### CRITICAL/);
      expect(section).toMatch(/### WARNING/);
      expect(section).toMatch(/### INFO/);
    });
  });

  // Coverage gap: cross-reference section has no content tests
  describe("Content: cross-reference section", () => {
    it("should define ground truth cross-referencing", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "cross-reference");
      expect(section).toMatch(/ground.?truth/i);
    });

    it("should define inter-artifact cross-referencing", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "cross-reference");
      expect(section).toMatch(/inter.?artifact|between.*artifacts/i);
    });

    it("should handle missing ground truth entries as WARNING", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "cross-reference");
      expect(section).toMatch(/WARNING/);
      expect(section).toMatch(/missing|not.*found|cannot.*be.*found/i);
    });
  });

  // Coverage gap: findings-formatting section has no content tests
  describe("Content: findings-formatting section", () => {
    it("should define per-finding output format with severity tag", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "findings-formatting");
      expect(section).toMatch(/\[CRITICAL\]|\[WARNING\]|\[INFO\]/);
    });

    it("should define report structure with severity grouping", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "findings-formatting");
      expect(section).toMatch(/Critical.*Findings/i);
      expect(section).toMatch(/Warning/i);
      expect(section).toMatch(/Info/i);
    });

    it("should require consistency across validation workflows", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "findings-formatting");
      expect(section).toMatch(/val.?validate.?artifact|val.?validate.?plan/i);
    });
  });

  // Coverage gap: frontmatter validation
  describe("Frontmatter", () => {
    it("should have valid YAML frontmatter with required fields", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch, "No YAML frontmatter found").toBeTruthy();
      const frontmatter = frontmatterMatch[1];
      expect(frontmatter).toMatch(/name:\s*validation-patterns/);
      expect(frontmatter).toMatch(/version:/);
      expect(frontmatter).toMatch(/applicable_agents:.*validator/);
      expect(frontmatter).toMatch(/sections:/);
    });

    it("should list all 5 sections in frontmatter", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch, "No YAML frontmatter found").toBeTruthy();
      const frontmatter = frontmatterMatch[1];
      for (const section of EXPECTED_SECTIONS) {
        expect(frontmatter, `Frontmatter missing section: ${section}`).toContain(section);
      }
    });
  });

  // Coverage gap: claim-extraction output format
  describe("Content: claim-extraction output format", () => {
    it("should define structured output fields", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "claim-extraction");
      expect(section).toMatch(/claim_text/);
      expect(section).toMatch(/source/);
      expect(section).toMatch(/type/);
      expect(section).toMatch(/verifiable/);
    });

    it("should list all claim types", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "claim-extraction");
      const expectedTypes = [
        "file-reference",
        "version",
        "config-value",
        "component-name",
        "count",
        "path",
        "dependency",
      ];
      for (const type of expectedTypes) {
        expect(section, `Missing claim type: ${type}`).toContain(type);
      }
    });
  });

  // Coverage gap: filesystem-verification strategy table
  describe("Content: filesystem-verification verification strategies", () => {
    it("should define verification methods for key claim types", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "filesystem-verification");
      expect(section).toMatch(/file-reference/);
      expect(section).toMatch(/config-value/);
      expect(section).toMatch(/component-name/);
    });

    it("should define output format with status field", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "filesystem-verification");
      expect(section).toMatch(/verified.*unverified.*not-applicable/s);
    });

    it("should describe path variable resolution", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const section = extractSection(content, "filesystem-verification");
      expect(section).toMatch(/\{project-root\}/);
      expect(section).toMatch(/\{project-path\}/);
    });
  });
});

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
