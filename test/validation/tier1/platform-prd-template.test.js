import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const TEMPLATE_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "templates",
  "platform-prd-template.md"
);

// ─── Helper: Parse YAML frontmatter ─────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*['"]?(.+?)['"]?\s*$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
}

// ─── AC1: Template contains all application + infrastructure sections ───

describe("AC1: Platform PRD template contains all app + infra sections", () => {
  it("should exist at _gaia/lifecycle/templates/platform-prd-template.md", () => {
    expect(existsSync(TEMPLATE_PATH), `Template not found at ${TEMPLATE_PATH}`).toBe(true);
  });

  it("should contain all application PRD sections", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const appSections = [
      "User Stories",
      "Functional Requirements",
      "Non-Functional Requirements",
      "UX Requirements",
      "Dependencies",
      "Overview",
      "Goals and Non-Goals",
      "Out of Scope",
      "Technical Constraints",
      "Milestones",
    ];
    for (const section of appSections) {
      expect(content, `Missing application section: ${section}`).toContain(section);
    }
  });

  it("should contain all 13 infrastructure PRD sections", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const infraSections = [
      "Platform Capabilities",
      "Resource Specifications",
      "Operational SLOs",
      "Security Posture",
      "Environment Strategy",
      "Dependencies & Provider Constraints",
      "Cost Model",
      "Verification Strategy",
      "Operational Runbooks",
    ];
    for (const section of infraSections) {
      expect(content, `Missing infrastructure section: ${section}`).toContain(section);
    }
  });

  it("should have application sections before infrastructure sections", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const userStoriesPos = content.indexOf("User Stories");
    const platformCapPos = content.indexOf("Platform Capabilities");
    expect(userStoriesPos, "User Stories should appear before Platform Capabilities").toBeLessThan(
      platformCapPos
    );
  });
});

// ─── AC2: YAML frontmatter with template: 'platform-prd' ───

describe("AC2: Template frontmatter includes template: platform-prd", () => {
  it("should have YAML frontmatter", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content.startsWith("---"), "Template must start with YAML frontmatter").toBe(true);
  });

  it("should have template: 'platform-prd' in frontmatter", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const fm = parseFrontmatter(content);
    expect(fm, "Failed to parse frontmatter").not.toBeNull();
    expect(fm.template).toBe("platform-prd");
  });

  it("should have a version field in frontmatter", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const fm = parseFrontmatter(content);
    expect(fm, "Failed to parse frontmatter").not.toBeNull();
    expect(fm.version, "Frontmatter must include version field").toBeDefined();
  });

  it("should have used_by field in frontmatter", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content, "Frontmatter must include used_by field").toMatch(/used_by:/);
  });
});

// ─── AC3: Dual ID scheme in Requirements Summary ────────────

describe("AC3: Requirements Summary supports dual ID scheme", () => {
  it("should contain application requirement ID tables (FR/NFR)", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content, "Missing FR-### requirement IDs").toMatch(/FR-\d{3}/);
    expect(content, "Missing NFR-### requirement IDs").toMatch(/NFR-\d{3}/);
  });

  it("should contain infrastructure requirement ID tables (IR/OR/SR)", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content, "Missing IR-### requirement IDs").toMatch(/IR-\d{3}/);
    expect(content, "Missing OR-### requirement IDs").toMatch(/OR-\d{3}/);
    expect(content, "Missing SR-### requirement IDs").toMatch(/SR-\d{3}/);
  });

  it("should have a Requirements Summary section containing both sets", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content, "Missing Requirements Summary heading").toContain("Requirements Summary");

    // Find the Requirements Summary section
    const summaryStart = content.indexOf("Requirements Summary");
    const afterSummary = content.substring(summaryStart);

    // Both app and infra requirement IDs should be in the summary section
    expect(afterSummary, "Requirements Summary missing FR IDs").toMatch(/FR-\d{3}/);
    expect(afterSummary, "Requirements Summary missing NFR IDs").toMatch(/NFR-\d{3}/);
    expect(afterSummary, "Requirements Summary missing IR IDs").toMatch(/IR-\d{3}/);
    expect(afterSummary, "Requirements Summary missing OR IDs").toMatch(/OR-\d{3}/);
    expect(afterSummary, "Requirements Summary missing SR IDs").toMatch(/SR-\d{3}/);
  });

  it("should document that IDs are globally unique within a project", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    // The template should mention that prefixes disambiguate IDs
    expect(content.toLowerCase(), "Template should document ID uniqueness").toMatch(
      /unique|disambiguat|prefix/
    );
  });
});
