import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const SCHEMA_PATH = join(PROJECT_ROOT, "_gaia", "lifecycle", "templates", "gap-entry-schema.md");

/**
 * E12-S5: Extend Gap Schema with Infrastructure Categories
 *
 * Validates that gap-entry-schema.md includes 5 new infra-specific
 * categories with descriptions, example entries, and PRD section mappings.
 */
describe("E12-S5: Gap Entry Schema — Infrastructure Categories", () => {
  let content;

  const loadContent = () => {
    if (!content) {
      content = readFileSync(SCHEMA_PATH, "utf8");
    }
    return content;
  };

  // --- AC1: 5 new infra-specific category enum values ---

  it("includes resource-drift category in the category enum", () => {
    const c = loadContent();
    expect(c).toContain("resource-drift");
  });

  it("includes config-sprawl category in the category enum", () => {
    const c = loadContent();
    expect(c).toContain("config-sprawl");
  });

  it("includes secret-exposure category in the category enum", () => {
    const c = loadContent();
    expect(c).toContain("secret-exposure");
  });

  it("includes missing-policy category in the category enum", () => {
    const c = loadContent();
    expect(c).toContain("missing-policy");
  });

  it("includes environment-skew category in the category enum", () => {
    const c = loadContent();
    expect(c).toContain("environment-skew");
  });

  // --- AC2: Total category enum contains 12 values (7 original + 5 new) ---

  it("contains exactly 12 total categories (7 original + 5 new)", () => {
    const c = loadContent();
    const allCategories = [
      "config-contradiction",
      "dead-code",
      "hard-coded-logic",
      "security-endpoint",
      "runtime-behavior",
      "doc-code-drift",
      "integration-seam",
      "resource-drift",
      "config-sprawl",
      "secret-exposure",
      "missing-policy",
      "environment-skew",
    ];
    for (const cat of allCategories) {
      expect(c).toContain(cat);
    }
    // Verify the category enum section mentions 12 categories
    expect(c).toMatch(/12\s*categor/i);
  });

  // --- AC2: ID format regex includes infra categories ---

  it("ID format regex includes all 5 infra categories", () => {
    const c = loadContent();
    const infraCategories = [
      "resource-drift",
      "config-sprawl",
      "secret-exposure",
      "missing-policy",
      "environment-skew",
    ];
    // The regex in the ID Format section should include infra categories
    const regexMatch = c.match(/\^GAP-\(([^)]+)\)-\\d\{3\}\$/);
    expect(regexMatch).not.toBeNull();
    const regexContent = regexMatch[1];
    for (const cat of infraCategories) {
      expect(regexContent).toContain(cat);
    }
  });

  // --- AC2: Enum validation section includes infra categories ---

  it("enum validation section lists all 12 category values", () => {
    const c = loadContent();
    // Find the enum validation line for category
    const enumLine = c.match(/`category`\s*must be exactly one of:([^\n]+)/);
    expect(enumLine).not.toBeNull();
    const enumText = enumLine[1];
    const infraCategories = [
      "resource-drift",
      "config-sprawl",
      "secret-exposure",
      "missing-policy",
      "environment-skew",
    ];
    for (const cat of infraCategories) {
      expect(enumText).toContain(cat);
    }
  });

  // --- AC3: Each new category has a description ---

  it("provides descriptions for all 5 infra categories", () => {
    const c = loadContent();
    // Each category should appear in a table row with a description
    expect(c).toMatch(/resource-drift[^|]*\|[^|]*\|[^\n]+/);
    expect(c).toMatch(/config-sprawl[^|]*\|[^|]*\|[^\n]+/);
    expect(c).toMatch(/secret-exposure[^|]*\|[^|]*\|[^\n]+/);
    expect(c).toMatch(/missing-policy[^|]*\|[^|]*\|[^\n]+/);
    expect(c).toMatch(/environment-skew[^|]*\|[^|]*\|[^\n]+/);
  });

  // --- AC3: Each new category has an example gap entry ---

  it("includes example gap entries for each of the 5 infra categories", () => {
    const c = loadContent();
    expect(c).toContain("GAP-resource-drift-001");
    expect(c).toContain("GAP-config-sprawl-001");
    expect(c).toContain("GAP-secret-exposure-001");
    expect(c).toContain("GAP-missing-policy-001");
    expect(c).toContain("GAP-environment-skew-001");
  });

  // --- AC3: PRD section mapping for each infra category ---

  it("maps resource-drift to Resource Specifications", () => {
    const c = loadContent();
    // The mapping should appear in a table or section
    expect(c).toMatch(/resource-drift[^|]*\|[^|]*Resource Specifications/i);
  });

  it("maps config-sprawl to Environment Strategy & DX", () => {
    const c = loadContent();
    expect(c).toMatch(/config-sprawl[^|]*\|[^|]*Environment Strategy/i);
  });

  it("maps secret-exposure to Security Posture", () => {
    const c = loadContent();
    expect(c).toMatch(/secret-exposure[^|]*\|[^|]*Security Posture/i);
  });

  it("maps missing-policy to Verification Strategy", () => {
    const c = loadContent();
    expect(c).toMatch(/missing-policy[^|]*\|[^|]*Verification Strategy/i);
  });

  it("maps environment-skew to Environment Strategy & DX", () => {
    const c = loadContent();
    expect(c).toMatch(/environment-skew[^|]*\|[^|]*Environment Strategy/i);
  });
});
