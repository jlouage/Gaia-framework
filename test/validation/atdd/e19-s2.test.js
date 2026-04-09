import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_YAML = join(
  PROJECT_ROOT,
  "_gaia",
  "testing",
  "workflows",
  "test-gap-analysis",
  "workflow.yaml"
);
const INSTRUCTIONS_XML = join(
  PROJECT_ROOT,
  "_gaia",
  "testing",
  "workflows",
  "test-gap-analysis",
  "instructions.xml"
);
const WORKFLOW_MANIFEST = join(PROJECT_ROOT, "_gaia", "_config", "workflow-manifest.csv");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E19-S2: Gap Analysis Workflow — Verification Mode", () => {
  // AC1: /gaia-test-gap-analysis --mode verification invokes the workflow in verification mode (FR-222)
  describe("AC1: Verification mode invoked via --mode verification flag", () => {
    it("workflow.yaml declares verification as a valid mode", () => {
      const content = loadFile(WORKFLOW_YAML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/verification/i);
      expect(content).toMatch(/mode.*verification|verification.*mode|modes:/i);
    });

    it("instructions.xml handles --mode verification branching", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must contain verification-specific steps — not just a placeholder comment
      expect(content).toMatch(/verification/i);
      // Must have actual verification logic, not just "E19-S2 scope — not implemented yet"
      expect(content).not.toMatch(/not implemented yet/i);
      // Must contain steps that execute in verification mode
      expect(content).toMatch(/verification.*mode|mode.*verification/i);
    });

    it("workflow-manifest.csv registers test-gap-analysis with mode flag documentation", () => {
      const content = loadFile(WORKFLOW_MANIFEST);
      expect(content).not.toBeNull();
      expect(content).toMatch(/test-gap-analysis/);
    });
  });

  // AC2: Reads execution results (JUnit XML, LCOV, E17 evidence JSON) and cross-references docs/test-artifacts/
  describe("AC2: Reads execution results and cross-references test-artifacts", () => {
    it("instructions.xml specifies reading JUnit XML as an execution result source", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/junit.*xml|JUnit.*XML/i);
    });

    it("instructions.xml specifies reading LCOV as an execution result source", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/lcov/i);
    });

    it("instructions.xml specifies reading E17 evidence JSON as an execution result source", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/evidence.*json|E17.*json/i);
    });

    it("instructions.xml references cross-referencing against docs/test-artifacts/", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/test.artifacts/i);
      expect(content).toMatch(/cross.referenc/i);
    });
  });

  // AC3: Output includes generated-vs-executed count per story and in aggregate (FR-226)
  describe("AC3: Output includes generated-vs-executed counts per story and in aggregate", () => {
    it("workflow output template includes per-story generated-vs-executed count section", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/per.story|per story/i);
      expect(content).toMatch(/generated.*executed|executed.*generated/i);
    });

    it("output schema includes aggregate (total) generated-vs-executed count", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/aggregate|total.*count|overall/i);
      expect(content).toMatch(/generated.*executed|executed.*generated/i);
    });
  });

  // AC4: Stories with zero executed tests flagged as HIGH priority gaps
  describe("AC4: Stories with zero executed tests flagged as HIGH priority gaps", () => {
    it("instructions.xml defines logic to flag zero-executed stories as HIGH priority", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/zero.*executed|no.*executed/i);
      expect(content).toMatch(/HIGH/);
    });

    it("output schema has a severity or priority field that accepts HIGH value", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/priority.*HIGH|severity.*HIGH|flag.*HIGH/i);
    });
  });

  // AC5: Workflow completes in under 60 seconds (NFR-040)
  describe("AC5: Workflow completes in under 60 seconds (NFR-040)", () => {
    it("NFR-040 is referenced in workflow.yaml or instructions", () => {
      const workflowContent = loadFile(WORKFLOW_YAML);
      const instructionsContent = loadFile(INSTRUCTIONS_XML);
      const combined = (workflowContent ?? "") + (instructionsContent ?? "");
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/NFR-040/);
    });

    it("workflow.yaml declares NFR-040 in its traces or performance constraints", () => {
      const content = loadFile(WORKFLOW_YAML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/NFR-040/);
      expect(content).toMatch(/60/);
    });
  });

  // AC6: Graceful degradation when no execution results available
  describe("AC6: Graceful degradation when no execution results available", () => {
    it("instructions.xml defines graceful degradation behavior for missing execution results", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/graceful|degrad|fallback|no.*result/i);
    });

    it("instructions.xml defines fallback to coverage mode when results unavailable", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/fall\s*back.*coverage|coverage.*fall\s*back|degrade.*coverage/i);
    });

    it("instructions.xml requires a warning log when falling back from verification to coverage", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/warn|log.*warning|warning.*log/i);
      expect(content).toMatch(/fall\s*back|degrad/i);
    });
  });
});
