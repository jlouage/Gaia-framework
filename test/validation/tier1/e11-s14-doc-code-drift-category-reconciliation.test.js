import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA_PATH = join(PROJECT_ROOT, "_gaia", "lifecycle", "templates", "gap-entry-schema.md");
const SCAN_PROMPT_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "templates",
  "brownfield-scan-doc-code-prompt.md"
);

/**
 * E11-S14: Reconcile doc-code-drift Category with Architecture Enum
 *
 * Validates that the canonical gap-entry-schema.md and brownfield scan prompts
 * use `doc-code-drift` (not `documentation`) as the gap category for
 * documentation-code mismatch findings.
 */
describe("E11-S14: doc-code-drift category reconciliation", () => {
  let schemaContent;
  let scanPromptContent;

  // --- AC1: gap-entry-schema category enum uses doc-code-drift ---
  it("gap-entry-schema.md category enum contains doc-code-drift", () => {
    schemaContent = schemaContent || readFileSync(SCHEMA_PATH, "utf8");
    expect(schemaContent).toContain("| `doc-code-drift`");
  });

  it("gap-entry-schema.md category enum does NOT contain standalone 'documentation' category", () => {
    schemaContent = schemaContent || readFileSync(SCHEMA_PATH, "utf8");
    // Extract application category rows from the table
    const categoryRows = schemaContent.match(/\| `[a-z-]+` \|/g) || [];
    const categories = categoryRows.map((row) => row.match(/`([^`]+)`/)[1]);
    expect(categories).not.toContain("documentation");
  });

  // --- AC2: brownfield scan prompt uses doc-code-drift ---
  it("brownfield-scan-doc-code-prompt.md references doc-code-drift category", () => {
    scanPromptContent = scanPromptContent || readFileSync(SCAN_PROMPT_PATH, "utf8");
    expect(scanPromptContent).toContain("doc-code-drift");
  });

  // --- AC5: gap-entry-schema E11-S7 maps to doc-code-drift ---
  it("gap-entry-schema.md maps E11-S7 scan agent to doc-code-drift", () => {
    schemaContent = schemaContent || readFileSync(SCHEMA_PATH, "utf8");
    const e11s7Row = schemaContent.match(/\|\s*`doc-code-drift`\s*\|\s*E11-S7\s*\|/);
    expect(e11s7Row).not.toBeNull();
  });
});
