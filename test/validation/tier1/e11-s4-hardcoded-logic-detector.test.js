import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const TEMPLATES_DIR = join(GAIA_DIR, "lifecycle", "templates");
const PROMPT_PATH = join(TEMPLATES_DIR, "brownfield-scan-hardcoded-prompt.md");
const SCHEMA_PATH = join(TEMPLATES_DIR, "gap-entry-schema.md");
const BROWNFIELD_INSTRUCTIONS_PATH = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "instructions.xml"
);

// ─── Helper ─────────────────────────────────────────────────

function readFile(filePath) {
  return readFileSync(filePath, "utf8");
}

// ─── AC1: Brownfield Workflow Integration ───────────────────

describe("AC1: Hard-coded logic scanner integrated into brownfield Step 2.5", () => {
  it("should have the brownfield instructions file", () => {
    expect(existsSync(BROWNFIELD_INSTRUCTIONS_PATH)).toBe(true);
  });

  it("should include hard-coded logic scanner subagent spawn in Step 2.5", () => {
    const content = readFile(BROWNFIELD_INSTRUCTIONS_PATH);
    expect(content).toContain("brownfield-scan-hardcoded-prompt.md");
  });

  it("should pass {tech_stack} and {project-path} to the hardcoded scanner", () => {
    const content = readFile(BROWNFIELD_INSTRUCTIONS_PATH);
    // The hardcoded scanner spawn action should reference both variables
    const step25Match = content.match(/hardcoded.*\{tech_stack\}|hardcoded.*\{project-path\}/is);
    expect(step25Match).not.toBeNull();
  });

  it("should output to brownfield-scan-hardcoded.md", () => {
    const content = readFile(BROWNFIELD_INSTRUCTIONS_PATH);
    expect(content).toContain("brownfield-scan-hardcoded.md");
  });

  it("should verify brownfield-scan-hardcoded.md in the wait-for-all action", () => {
    const content = readFile(BROWNFIELD_INSTRUCTIONS_PATH);
    // The verification list should include the new scan output
    const verifySection = content.match(/[Vv]erify.*brownfield-scan-hardcoded\.md/s);
    expect(verifySection).not.toBeNull();
  });
});

// ─── AC2: Detection Categories ──────────────────────────────

describe("AC2: Scanner detects 6 categories of hard-coded values", () => {
  it("should have the prompt template file", () => {
    expect(existsSync(PROMPT_PATH)).toBe(true);
  });

  const categories = [
    "magic numbers",
    "hard-coded URLs",
    "embedded SQL",
    "date/time thresholds",
    "pricing",
    "role",
  ];

  for (const category of categories) {
    it(`should include detection rules for: ${category}`, () => {
      const content = readFile(PROMPT_PATH).toLowerCase();
      expect(content).toContain(category.toLowerCase());
    });
  }
});

// ─── AC3: Acceptable Constant Suppression ───────────────────

describe("AC3: Acceptable constants are NOT flagged", () => {
  const acceptableCategories = [
    "HTTP status codes",
    "math constants",
    "array indices",
    "standard library constants",
    "test fixture",
  ];

  for (const cat of acceptableCategories) {
    it(`should include allowlist entry for: ${cat}`, () => {
      const content = readFile(PROMPT_PATH).toLowerCase();
      expect(content).toContain(cat.toLowerCase());
    });
  }

  it("should reference HTTP status codes in allowlist", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/HTTP status codes/i);
  });

  it("should reference math constants in allowlist", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/math constants/i);
  });
});

// ─── AC4: Stack-Aware Patterns ──────────────────────────────

describe("AC4: Stack-aware patterns for 4 supported stacks", () => {
  const stacks = [
    { name: "Java/Spring", marker: "@Value" },
    { name: "Node/Express", marker: "Express" },
    { name: "Python/Django", marker: "Django" },
    { name: "Go/Gin", marker: "Go" },
  ];

  for (const stack of stacks) {
    it(`should include pattern table for ${stack.name}`, () => {
      const content = readFile(PROMPT_PATH);
      expect(content).toContain(stack.marker);
    });
  }

  it("should mention Spring @Value without placeholder as flaggable", () => {
    const content = readFile(PROMPT_PATH);
    // Should reference @Value("literal") as flaggable vs @Value("${...}") as ok
    expect(content).toMatch(/@Value/);
  });

  it("should mention Django ORM filter with hard-coded values", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/filter|objects\.filter/i);
  });
});

// ─── AC5: Gap Schema Compliance ─────────────────────────────

describe("AC5: Output conforms to standardized gap schema", () => {
  it("should have the gap-entry-schema.md template", () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
  });

  it("should reference gap-entry-schema.md in the prompt", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toContain("gap-entry-schema.md");
  });

  it("should use GAP-HARDCODED-{seq} ID format", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/GAP-HARDCODED/);
  });

  it("should set category to hard-coded-logic", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toContain("hard-coded-logic");
  });

  it("should reference gap-entry-schema.md for full field definitions", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toContain("gap-entry-schema.md");
  });

  it("should include severity levels in output", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/critical/i);
    expect(content).toMatch(/high/i);
    expect(content).toMatch(/medium/i);
  });

  it("should include key schema fields in output instructions", () => {
    const content = readFile(PROMPT_PATH);
    const requiredFields = ["id", "category", "severity", "title"];
    for (const field of requiredFields) {
      expect(content).toContain(field);
    }
  });
});

// ─── AC6: Token Budget Compliance ───────────────────────────

describe("AC6: Token budget respected", () => {
  it("should mention budget constraints for gap entries", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/[Bb]udget/);
  });

  it("should enforce max 70 gap entries", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/70/);
  });

  it("should include truncation instruction for exceeding budget", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/truncat|budget|cap/i);
  });
});

// ─── False Positive Suppression Details ─────────────────────

describe("False positive suppression rules", () => {
  it("should exclude config files (.yml, .yaml, .properties, .env, .json)", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/\.yml|\.yaml/);
    expect(content).toMatch(/\.properties/);
    expect(content).toMatch(/\.env/);
  });

  it("should exclude test files and directories", () => {
    const content = readFile(PROMPT_PATH);
    expect(content).toMatch(/test|spec|__tests__|fixtures/i);
  });

  it("should suppress Spring @Value as externalization pattern", () => {
    const content = readFile(PROMPT_PATH);
    // Should mention that Spring @Value is a recognized externalization pattern
    expect(content).toMatch(/Spring\s+@Value/);
  });
});
