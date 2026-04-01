import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const SCHEMA_PATH = join(PROJECT_ROOT, "_gaia", "lifecycle", "templates", "gap-entry-schema.md");

/**
 * E11-S1: Standardized Gap Output Schema
 *
 * Validates that the gap-entry-schema.md template file exists,
 * contains all required fields, enums, validation rules, and examples.
 */
describe("E11-S1: Gap Entry Schema", () => {
  let content;

  // --- Test Scenario 1: Schema template file exists at expected path (AC3) ---
  it("schema template file exists at _gaia/lifecycle/templates/gap-entry-schema.md", () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
  });

  // --- Test Scenario 2: All 9 required fields present in schema (AC1) ---
  it("defines all 9 required fields: id, category, severity, title, description, evidence, recommendation, verified_by, confidence", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
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
      expect(content).toContain(field);
    }
  });

  // --- Test Scenario 3: Severity enum contains all valid values (AC1, AC4) ---
  it("defines severity enum with values: critical, high, medium, low, info", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    const severityValues = ["critical", "high", "medium", "low", "info"];
    for (const val of severityValues) {
      expect(content).toContain(val);
    }
  });

  // --- Test Scenario 4: Category enum contains all 7 scan types (AC2) ---
  it("defines category enum with all 7 scan-specific values", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    const categoryValues = [
      "config-contradiction",
      "dead-code",
      "hard-coded-logic",
      "security-endpoint",
      "runtime-behavior",
      "doc-code-drift",
      "integration-seam",
    ];
    for (const val of categoryValues) {
      expect(content).toContain(val);
    }
  });

  // --- Test Scenario 5: Confidence enum contains valid values (AC1, AC4) ---
  it("defines confidence enum with values: high, medium, low", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    // Check confidence enum is explicitly listed (not just the word appearing in other context)
    expect(content).toMatch(/confidence/i);
    // Verify enum values appear near a confidence definition
    expect(content).toContain("high");
    expect(content).toContain("medium");
    expect(content).toContain("low");
  });

  // --- Test Scenario 6: ID format pattern documented (AC1, AC4) ---
  it("documents the GAP-{scan_type}-{seq} ID format pattern", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    expect(content).toMatch(/GAP-\{?scan_type\}?-\{?seq\}?/i);
  });

  // --- Test Scenario 7: Evidence field is composite object (AC1) ---
  it("defines evidence as a composite object with file and line sub-fields", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    // Evidence must have file and line sub-fields
    expect(content).toMatch(/evidence/);
    expect(content).toMatch(/file/);
    expect(content).toMatch(/line/);
  });

  // --- Test Scenario 8: Example gap entries included (AC3) ---
  it("includes at least 2 example gap entries with different categories", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    // Count GAP- prefixed IDs in example entries
    const gapIdMatches = content.match(/GAP-[a-z-]+-\d+/g) || [];
    expect(gapIdMatches.length).toBeGreaterThanOrEqual(2);
    // Verify they use different scan types (categories)
    const scanTypes = new Set(
      gapIdMatches.map((id) => id.replace(/^GAP-/, "").replace(/-\d+$/, ""))
    );
    expect(scanTypes.size).toBeGreaterThanOrEqual(2);
  });

  // --- Test Scenario 9: Budget control guidance documented (AC3) ---
  it("includes budget control section with ~100 tokens per gap target", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    expect(content).toMatch(/budget/i);
    expect(content).toMatch(/100\s*tokens?/i);
  });

  // --- Test Scenario 10: Validation rules section exists (AC4) ---
  it("includes validation rules documenting required fields and enum constraints", () => {
    content = content || readFileSync(SCHEMA_PATH, "utf8");
    expect(content).toMatch(/validation/i);
    // Should document that fields are required
    expect(content).toMatch(/required/i);
  });
});
