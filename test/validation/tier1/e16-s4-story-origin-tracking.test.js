import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

// ─── File Paths ─────────────────────────────────────────────

const FRAMEWORK_TEMPLATE = join(PROJECT_ROOT, "_gaia/lifecycle/templates/story-template.md");

const CREATE_STORY_INSTRUCTIONS = join(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/create-story/instructions.xml"
);

const VALIDATE_STORY_INSTRUCTIONS = join(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/validate-story/instructions.xml"
);

// ─── Helpers ────────────────────────────────────────────────

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : "";
}

// ─── AC1: Template Origin Fields ────────────────────────────

describe("AC1: Story template contains origin and origin_ref fields", () => {
  const frameworkContent = readFileSync(FRAMEWORK_TEMPLATE, "utf8");
  const frameworkFrontmatter = extractFrontmatter(frameworkContent);

  it("should have 'origin' field in framework default template frontmatter", () => {
    expect(frameworkFrontmatter).toMatch(/^origin:\s/m);
  });

  it("should have 'origin_ref' field in framework default template frontmatter", () => {
    expect(frameworkFrontmatter).toMatch(/^origin_ref:\s/m);
  });

  it("should default origin to null in framework template", () => {
    expect(frameworkFrontmatter).toMatch(/^origin:\s+null$/m);
  });

  it("should default origin_ref to null in framework template", () => {
    expect(frameworkFrontmatter).toMatch(/^origin_ref:\s+null$/m);
  });
});

// ─── AC2: Create-Story Populates Origin Fields ──────────────

describe("AC2: Create-story instructions populate origin fields", () => {
  const content = readFileSync(CREATE_STORY_INSTRUCTIONS, "utf8");

  it("should reference 'origin' in the frontmatter population action", () => {
    // The populate action should mention origin as a field to set
    expect(content).toMatch(/origin/i);
  });

  it("should reference 'origin_ref' in the frontmatter population action", () => {
    expect(content).toMatch(/origin_ref/i);
  });

  it("should mention problem-solving as an origin value", () => {
    expect(content).toMatch(/problem-solving/);
  });

  it("should include origin in the YAML frontmatter field list alongside other fields", () => {
    // The action that populates frontmatter fields should list origin
    // Look for a section that lists multiple frontmatter fields AND includes origin
    const populateSection = content.match(/Populate ALL YAML frontmatter[\s\S]*?<\/action>/i);
    expect(populateSection).not.toBeNull();
    expect(populateSection[0]).toContain("origin");
  });

  it("should detect problem-solving invocation context for setting origin", () => {
    // There should be logic to detect when invoked from problem-solving routing
    expect(content).toMatch(/problem.solving.*origin|origin.*problem.solving/is);
  });
});

// ─── AC3: Backward Compatibility — Missing Fields Accepted ──

describe("AC3: Validate-story treats missing origin fields as acceptable", () => {
  const content = readFileSync(VALIDATE_STORY_INSTRUCTIONS, "utf8");

  it("should NOT list origin in required YAML frontmatter fields", () => {
    // The required field count should remain at 14 (not 16)
    // origin and origin_ref are optional
    const requiredFieldsMatch = content.match(/(?:required fields|verify all \d+ required)/i);
    if (requiredFieldsMatch) {
      // If a count is mentioned, it should be 14 (not include origin/origin_ref)
      expect(requiredFieldsMatch[0]).not.toMatch(/16/);
    }
    // origin should NOT appear in the required fields enumeration
    // Look for the YAML frontmatter validation section
    const yamlSection = content.match(
      /YAML Frontmatter.*?verify all \d+ required fields[\s\S]*?FAIL if any required field/i
    );
    if (yamlSection) {
      // The required field list should not contain origin or origin_ref
      const fieldList = yamlSection[0];
      expect(fieldList).not.toMatch(/\borigin\b(?!_ref)/);
      expect(fieldList).not.toMatch(/\borigin_ref\b/);
    }
  });

  it("should explicitly state that missing origin fields do not cause errors", () => {
    // There should be language about origin fields being optional
    // or about backward compatibility for missing origin/origin_ref
    expect(content).toMatch(
      /origin.*optional|backward.compat.*origin|origin.*not.required|missing.*origin.*accept/is
    );
  });
});

// ─── AC4: Origin Field Validation Rules ─────────────────────

describe("AC4: Validate-story validates origin enum and cross-field rules", () => {
  const content = readFileSync(VALIDATE_STORY_INSTRUCTIONS, "utf8");

  it("should validate origin against allowed enum values", () => {
    // Should mention the allowed values for origin
    expect(content).toMatch(/manual/);
    expect(content).toMatch(/problem-solving/);
    expect(content).toMatch(/triage/);
    expect(content).toMatch(/add-feature/);
    expect(content).toMatch(/sprint-planning/);
  });

  it("should classify invalid origin enum as CRITICAL", () => {
    expect(content).toMatch(/CRITICAL.*origin|origin.*CRITICAL/is);
  });

  it("should validate origin_ref is non-empty when origin is non-null", () => {
    // Cross-field validation: origin non-null requires origin_ref
    expect(content).toMatch(/origin.*non.null.*origin_ref|origin_ref.*non.empty.*origin/is);
  });

  it("should classify missing origin_ref with non-null origin as WARNING", () => {
    expect(content).toMatch(/WARNING.*origin_ref|origin_ref.*WARNING/is);
  });
});
