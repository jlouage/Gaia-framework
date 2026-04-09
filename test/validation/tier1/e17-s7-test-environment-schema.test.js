import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const EXAMPLE_PATH = join(PROJECT_ROOT, "docs", "test-artifacts", "test-environment.yaml.example");

const VALIDATOR_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "core",
  "validators",
  "test-environment-validator.js"
);

/**
 * E17-S7: test-environment.yaml Manifest Schema
 *
 * Validates that the schema is documented via a canonical example,
 * a validator module exists, and the validator enforces required/optional
 * fields correctly.
 */
describe("E17-S7: test-environment.yaml Manifest Schema", () => {
  // --- AC1: Example file exists at docs/test-artifacts/test-environment.yaml.example ---
  describe("AC1: Canonical example file", () => {
    it("example file exists at docs/test-artifacts/test-environment.yaml.example", () => {
      expect(existsSync(EXAMPLE_PATH)).toBe(true);
    });

    it("example file is non-empty and contains annotated fields", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content.length).toBeGreaterThan(100);
      // Should contain comments explaining fields
      expect(content).toContain("#");
    });
  });

  // --- AC2: Required fields: version, runners (list with name, command, tier) ---
  describe("AC2: Required fields in example", () => {
    it("example contains 'version' field", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content).toMatch(/^version:/m);
    });

    it("example contains 'runners' list", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content).toMatch(/^runners:/m);
    });

    it("runners entries contain name, command, and tier fields", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content).toMatch(/^\s+- name:/m);
      expect(content).toMatch(/^\s+command:/m);
      expect(content).toMatch(/^\s+tier:/m);
    });
  });

  // --- AC3: Optional fields ---
  describe("AC3: Optional fields in example", () => {
    it("example documents 'primary_runner' as optional", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content).toContain("primary_runner");
    });

    it("example documents 'tiers' with gate-to-tier mapping as optional", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content).toContain("tiers");
    });

    it("example documents 'env_requirements' as optional", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content).toContain("env_requirements");
    });

    it("example documents 'ci_workflow' as optional", () => {
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      expect(content).toContain("ci_workflow");
    });
  });

  // --- AC4: Validator exists and enforces schema ---
  describe("AC4: Schema validator", () => {
    it("validator module exists", () => {
      expect(existsSync(VALIDATOR_PATH)).toBe(true);
    });

    it("validator rejects missing 'version' field", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const yamlContent = `runners:
  - name: unit
    command: npm test
    tier: 1`;
      const result = validateTestEnvironment(yamlContent);
      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.toLowerCase().includes("version"))).toBe(true);
    });

    it("validator rejects missing 'runners' field", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const yamlContent = `version: 1`;
      const result = validateTestEnvironment(yamlContent);
      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.toLowerCase().includes("runners"))).toBe(true);
    });

    it("validator rejects runner entry without 'command'", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const yamlContent = `version: 1
runners:
  - name: unit
    tier: 1`;
      const result = validateTestEnvironment(yamlContent);
      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.toLowerCase().includes("command"))).toBe(true);
    });

    it("validator passes a valid manifest with required fields only", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const yamlContent = `version: 1
runners:
  - name: unit
    command: npm test
    tier: 1`;
      const result = validateTestEnvironment(yamlContent);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("validator passes a fully-populated manifest with optional fields", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const yamlContent = `version: 1
primary_runner: unit
runners:
  - name: unit
    command: npm test
    tier: 1
  - name: integration
    command: npm run test:integration
    tier: 2
tiers:
  1:
    gates: [qa-tests, test-automate, test-review]
  2:
    gates: [review-perf]
env_requirements:
  - node >= 20
ci_workflow: ci.yml`;
      const result = validateTestEnvironment(yamlContent);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("validator emits WARNING (not error) on schema violation", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const yamlContent = `runners:
  - name: unit
    tier: 1`;
      const result = validateTestEnvironment(yamlContent);
      // Should have warnings, not throw an error
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // --- AC5: Missing file is not an error ---
  describe("AC5: Graceful missing-file handling", () => {
    it("validator returns valid=true with info message when content is null (file absent)", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const result = validateTestEnvironment(null);
      expect(result.valid).toBe(true);
      expect(result.info).toBeDefined();
      expect(result.info).toMatch(/auto.discovery/i);
    });

    it("validator returns valid=true with info message when content is empty string", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const result = validateTestEnvironment("");
      expect(result.valid).toBe(true);
      expect(result.info).toBeDefined();
    });
  });

  // --- Test Scenario 5: Example file loads and validates without error ---
  describe("Test Scenario 5: Example file self-validates", () => {
    it("example file content passes the validator", async () => {
      const { validateTestEnvironment } = await import(VALIDATOR_PATH);
      const content = readFileSync(EXAMPLE_PATH, "utf8");
      const result = validateTestEnvironment(content);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
