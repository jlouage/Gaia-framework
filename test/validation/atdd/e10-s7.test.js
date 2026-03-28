import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");

const STORY_TEMPLATE = join(GAIA_DIR, "lifecycle", "templates", "story-template.md");
const CREATE_STORY_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "4-implementation",
  "create-story",
  "instructions.xml"
);
const CREATE_STORY_CHECKLIST = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "4-implementation",
  "create-story",
  "checklist.md"
);
const ADD_FEATURE_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "4-implementation",
  "add-feature",
  "instructions.xml"
);
const SPRINT_PLANNING_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "4-implementation",
  "sprint-planning",
  "instructions.xml"
);

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E10-S7: Sprint priority_flag Integration", () => {
  // AC1: priority_flag field in story frontmatter (null or "next-sprint")
  describe("AC1: priority_flag field in story frontmatter schema", () => {
    it("test_ac1_template_has_priority_flag — story-template.md frontmatter contains priority_flag: null", () => {
      const content = loadFile(STORY_TEMPLATE);
      expect(content).not.toBeNull();
      // Extract YAML frontmatter (between --- delimiters)
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(fmMatch).not.toBeNull();
      const frontmatter = fmMatch[1];
      // Must contain priority_flag field with null default
      expect(frontmatter).toMatch(/^priority_flag:\s*null$/m);
    });

    it("test_ac1_create_story_validates_priority_flag — create-story instructions list priority_flag as required field", () => {
      const content = loadFile(CREATE_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // The mandate listing required fields must include priority_flag
      expect(content).toContain("priority_flag");
    });

    it("test_ac1_checklist_field_count — create-story checklist references 15 required fields including priority_flag", () => {
      const content = loadFile(CREATE_STORY_CHECKLIST);
      expect(content).not.toBeNull();
      // Must reference 15 required fields (up from 14)
      expect(content).toContain("15 required fields");
      // Must include priority_flag in the field list
      expect(content).toContain("priority_flag");
    });

    it("test_ac1_valid_values — create-story instructions specify valid values (null or next-sprint)", () => {
      const content = loadFile(CREATE_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must specify the valid values for priority_flag
      expect(content).toMatch(/priority_flag/);
      expect(content).toMatch(/next-sprint/);
    });
  });

  // AC2: add-feature sets priority_flag for high-urgency features
  describe("AC2: add-feature sets priority_flag for high-urgency stories", () => {
    it("test_ac2_add_feature_references_priority_flag — add-feature instructions mention priority_flag", () => {
      const content = loadFile(ADD_FEATURE_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must reference priority_flag setting
      expect(content).toContain("priority_flag");
    });

    it('test_ac2_add_feature_sets_next_sprint — add-feature instructions set flag to "next-sprint"', () => {
      const content = loadFile(ADD_FEATURE_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must contain logic to set priority_flag to "next-sprint"
      expect(content).toContain("next-sprint");
    });
  });

  // AC3: sprint planning detects flagged stories
  describe("AC3: sprint planning detects flagged stories", () => {
    it("test_ac3_sprint_planning_scans_for_flag — sprint-planning instructions scan for priority_flag", () => {
      const content = loadFile(SPRINT_PLANNING_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must contain a scan/detection step for priority_flag
      expect(content).toContain("priority_flag");
    });

    it("test_ac3_sprint_planning_highlights_flagged — sprint-planning instructions highlight flagged stories", () => {
      const content = loadFile(SPRINT_PLANNING_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must contain logic to display/highlight flagged stories
      expect(content).toMatch(/priority_flag.*next-sprint|next-sprint.*priority_flag/s);
    });
  });

  // AC4: auto-include flagged stories if capacity allows
  describe("AC4: auto-include flagged stories in sprint", () => {
    it("test_ac4_auto_include_logic — sprint-planning instructions contain auto-include logic for flagged stories", () => {
      const content = loadFile(SPRINT_PLANNING_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must contain auto-include logic
      expect(content).toMatch(/auto.?include/i);
      expect(content).toContain("priority_flag");
    });

    it("test_ac4_capacity_check — sprint-planning instructions check capacity before auto-including", () => {
      const content = loadFile(SPRINT_PLANNING_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must reference capacity check for flagged stories
      expect(content).toMatch(/capacity/i);
    });
  });

  // AC5: flag cleared on sprint assignment
  describe("AC5: flag cleared on sprint assignment", () => {
    it("test_ac5_flag_cleared — sprint-planning instructions clear priority_flag after assignment", () => {
      const content = loadFile(SPRINT_PLANNING_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must contain logic to clear/reset priority_flag to null
      expect(content).toMatch(/priority_flag.*null|clear.*priority_flag|reset.*priority_flag/is);
    });
  });

  // Test Scenario 7: Invalid flag value rejected
  describe("Validation: invalid flag values rejected", () => {
    it("test_invalid_flag_value — create-story instructions specify only null and next-sprint as valid", () => {
      const content = loadFile(CREATE_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      // Must explicitly define the two valid values
      expect(content).toMatch(/null/);
      expect(content).toMatch(/next-sprint/);
    });
  });
});
