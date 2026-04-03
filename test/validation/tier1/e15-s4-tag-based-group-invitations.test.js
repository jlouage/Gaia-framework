import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

// ─── Constants ──────────────────────────────────────────────

const STEP_FILE = join(
  PROJECT_ROOT,
  "_gaia",
  "core",
  "workflows",
  "party-mode",
  "steps",
  "step-01-agent-loading.md"
);

function readStep() {
  return readFileSync(STEP_FILE, "utf8");
}

// ─── E15-S4: Tag-Based Group Invitations ────────────────────

describe("E15-S4: Tag-Based Group Invitations", () => {
  // AC1: Option E visible in invitation options
  describe("AC1: Option E availability", () => {
    it("should contain Option E in the invitation options", () => {
      const content = readStep();
      expect(content).toMatch(/Option E/i);
    });

    it("should describe Option E as tag-based invitation", () => {
      const content = readStep();
      expect(content.toLowerCase()).toMatch(/option e.*tag|by tag/i);
    });

    it("should list Option E after Option D", () => {
      const content = readStep();
      const optionDIndex = content.search(/Option D/i);
      const optionEIndex = content.search(/Option E/i);
      expect(optionDIndex).toBeGreaterThan(-1);
      expect(optionEIndex).toBeGreaterThan(-1);
      expect(optionEIndex).toBeGreaterThan(optionDIndex);
    });
  });

  // AC2: Tag in frontmatter tags array matches stakeholder
  describe("AC2: Tag extraction from frontmatter", () => {
    it("should reference the tags field in stakeholder frontmatter parsing", () => {
      const content = readStep();
      expect(content).toMatch(/tags/);
    });

    it("should describe building a tag-to-stakeholder index", () => {
      const content = readStep();
      expect(content.toLowerCase()).toMatch(/tag.*index|index.*tag|tag.*map/);
    });
  });

  // AC3: Multi-tag stakeholder matched by any single tag
  describe("AC3: Multi-tag matching", () => {
    it("should describe matching stakeholders when any tag matches", () => {
      const content = readStep();
      // Should explain that a stakeholder with multiple tags is matched by any one
      expect(content.toLowerCase()).toMatch(/tags.*array|any.*tag|multiple.*tag/);
    });
  });

  // AC4: "invite all {tag}" syntax
  describe("AC4: invite all {tag} syntax", () => {
    it("should document the invite all {tag} pattern", () => {
      const content = readStep();
      expect(content.toLowerCase()).toMatch(/invite all/);
    });
  });

  // Edge case: case-insensitive matching
  describe("Edge: Case-insensitive tag matching", () => {
    it("should specify case-insensitive tag matching", () => {
      const content = readStep();
      expect(content.toLowerCase()).toMatch(/case.insensitive/);
    });
  });

  // Edge case: zero-match warning
  describe("Edge: Zero-match tag warning", () => {
    it("should describe warning when tag matches zero stakeholders", () => {
      const content = readStep();
      expect(content.toLowerCase()).toMatch(/zero.*stakeholder|no.*match|matches.*no|warning.*tag/);
    });
  });

  // Edge case: combined invitations
  describe("Edge: Combined tag and individual selections", () => {
    it("should describe combining tag-based with individual selections", () => {
      const content = readStep();
      expect(content.toLowerCase()).toMatch(/combin|alongside|together|plus/);
    });
  });

  // Structural: stakeholder discovery present (dependency from E15-S3)
  describe("Structural: Stakeholder discovery", () => {
    it("should reference custom/stakeholders/ glob discovery", () => {
      const content = readStep();
      expect(content).toMatch(/custom\/stakeholders/);
    });

    it("should include Option D for stakeholders only", () => {
      const content = readStep();
      expect(content).toMatch(/Option D/i);
    });
  });
});
