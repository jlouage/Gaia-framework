import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const SCHEMA_RUNNING = join(
  PROJECT_ROOT,
  "..",
  "_gaia",
  "lifecycle",
  "templates",
  "gap-entry-schema.md"
);
const SCHEMA_PRODUCT = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "templates",
  "gap-entry-schema.md"
);

/**
 * E11-S18: Add Optional Protocol Field to Gap Entry Schema
 *
 * Validates that both copies of gap-entry-schema.md include:
 * - Optional `protocol` sub-field in Evidence Object
 * - Updated sub-field table with protocol row
 * - Updated Required vs Optional section
 * - Optional Field Validation subsection
 * - Schema examples with protocol field
 * - Schema version bumped to 1.2.0
 * - Both copies are identical
 */
describe("E11-S18: Gap Entry Schema — Protocol Field", () => {
  // --- AC1: Evidence Object includes optional protocol field ---
  describe("AC1: Evidence Object includes protocol field", () => {
    it("product source schema has protocol in Evidence Object YAML block", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      // The Evidence Object YAML example should contain a protocol field
      expect(content).toMatch(/evidence:\s*\n\s+file:.*\n\s+line:.*\n\s+protocol:/m);
    });

    it("product source schema has protocol row in Evidence sub-field table", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      // The sub-field table should have a protocol row with Required: no
      expect(content).toMatch(/\|\s*`?protocol`?\s*\|.*\|\s*no\s*\|/);
    });

    it("product source schema documents protocol allowed values", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      // Should mention canonical values
      expect(content).toContain("`rest`");
      expect(content).toContain("`graphql`");
      expect(content).toContain("`grpc`");
      expect(content).toContain("`websocket`");
    });

    it("Field Reference mentions optional protocol sub-field in evidence description", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      // The evidence row in Field Reference should mention protocol
      // Match the evidence row in the Field Reference table
      const fieldRefSection = content.split("## Field Reference")[1]?.split("##")[0] || "";
      expect(fieldRefSection).toMatch(/evidence.*protocol/is);
    });
  });

  // --- AC2: Backward compatibility — entries without protocol remain valid ---
  describe("AC2: Backward compatibility", () => {
    it("Required vs Optional section clarifies protocol is optional sub-field", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      const reqOptSection =
        content.split("### Required vs Optional")[1]?.split("###")[0] || "";
      // Should mention protocol as optional sub-field
      expect(reqOptSection).toMatch(/protocol/i);
      expect(reqOptSection).toMatch(/optional/i);
    });

    it("Optional Field Validation subsection exists under Validation Rules", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      expect(content).toContain("### Optional Field Validation");
    });

    it("Optional Field Validation documents non-empty string when present", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      const optValSection =
        content.split("### Optional Field Validation")[1]?.split("###")[0] || "";
      expect(optValSection).toMatch(/non-empty/i);
    });
  });

  // --- AC3: Protocol-specific entries conform to schema ---
  describe("AC3: Protocol-specific evidence examples", () => {
    it("schema includes at least one example with protocol field", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      // Look for protocol: in a YAML code block within Examples section
      const examplesSection = content.split("## Examples")[1] || "";
      expect(examplesSection).toMatch(/protocol:\s*"/);
    });

    it("security-endpoint example includes protocol: rest", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      // The existing security-endpoint example should be updated with protocol
      const examplesSection = content.split("## Examples")[1] || "";
      // Should have a security-endpoint example that includes protocol
      expect(examplesSection).toMatch(/security-endpoint.*protocol.*rest/s);
    });
  });

  // --- Schema version bump ---
  describe("Schema version", () => {
    it("schema version is 1.2.0", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      expect(content).toMatch(/\*?\*?Version:\*?\*?\s*1\.2\.0/);
    });

    it("E11-S18 is listed in Story field", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      expect(content).toMatch(/Story:.*E11-S18/);
    });
  });

  // --- Format Validation for protocol ---
  describe("Format Validation", () => {
    it("format validation includes evidence.protocol rule", () => {
      const content = readFileSync(SCHEMA_PRODUCT, "utf8");
      const formatSection =
        content.split("### Format Validation")[1]?.split("###")[0] || "";
      expect(formatSection).toMatch(/evidence\.protocol/);
    });
  });

  // --- Both copies identical ---
  describe("Both copies identical", () => {
    it("running framework and product source schemas are identical", () => {
      const running = readFileSync(SCHEMA_RUNNING, "utf8");
      const product = readFileSync(SCHEMA_PRODUCT, "utf8");
      expect(running).toBe(product);
    });
  });
});
