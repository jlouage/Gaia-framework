/**
 * E19-S16 ATDD — Auto-Generate test-environment.yaml from Detected Infrastructure
 *
 * Verifies that the brownfield onboarding workflow (instructions.xml +
 * workflow.yaml) references the test-environment.yaml auto-generation
 * step, its six required fields, merge/skip/overwrite conflict handling,
 * the YOLO-mode safe default, E17-S7 schema validation, and the
 * conditional NFR quality gate.
 *
 * Traces to: FR-235, AC1-AC6
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const BROWNFIELD_INSTRUCTIONS = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "instructions.xml"
);
const BROWNFIELD_WORKFLOW = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "workflow.yaml"
);

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E19-S16: Auto-Generate test-environment.yaml from Detected Infrastructure", () => {
  describe("AC1: auto-generate test-environment.yaml after detection steps (FR-235)", () => {
    it("instructions.xml contains a step that auto-generates test-environment.yaml", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/test-environment\.yaml/);
    });
    it("auto-generate step references FR-235 as the source requirement", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/FR-235/);
    });
  });

  describe("AC2: generated YAML schema has all 6 required fields", () => {
    it("instructions.xml specifies test_runner field in the generated YAML", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/test_runner/);
    });
    it("instructions.xml specifies ci_provider field in the generated YAML", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/ci_provider/);
    });
    it("instructions.xml specifies docker_test_config field in the generated YAML", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/docker_test_config/);
    });
    it("instructions.xml specifies browser_matrix field in the generated YAML", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/browser_matrix/);
    });
    it("instructions.xml specifies generated_by: brownfield in the generated YAML", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/generated_by.*brownfield|brownfield.*generated_by/);
    });
    it("instructions.xml specifies generated_date field in the generated YAML", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/generated_date/);
    });
  });

  describe("AC3: existing file triggers merge/skip/overwrite prompt", () => {
    it("instructions.xml checks whether test-environment.yaml already exists before writing", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/exists|already exist/i);
      expect(content).toMatch(/merge|skip|overwrite/i);
    });
    it("instructions.xml includes all three options: [m]erge, [s]kip, [o]verwrite", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/merge/i);
      expect(content).toMatch(/skip/i);
      expect(content).toMatch(/overwrite/i);
    });
  });

  describe("AC4: YOLO mode uses merge as safe default", () => {
    it("instructions.xml specifies merge as the YOLO-mode default when file exists", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/yolo.*merge|merge.*yolo|yolo.*safe.*default|safe.*default.*merge/i);
    });
  });

  describe("AC5: generated file passes E17-S7 schema validation", () => {
    it("instructions.xml references E17 schema validation or E17-S7 compatibility", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/E17|schema.*validat|validat.*schema/i);
    });
  });

  describe("AC6: NFR quality gate requires test-environment.yaml when infrastructure detected", () => {
    it("workflow.yaml or instructions.xml declares an NFR quality gate for test-environment.yaml", () => {
      const workflowContent = loadFile(BROWNFIELD_WORKFLOW);
      const instructionsContent = loadFile(BROWNFIELD_INSTRUCTIONS);
      const combined = (workflowContent || "") + (instructionsContent || "");
      expect(combined).toMatch(/quality.gate|gate.*test-environment|nfr.*onboard/i);
    });
    it("quality gate is conditional — only required when test infrastructure is detected", () => {
      const content = loadFile(BROWNFIELD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(
        /if.*detect|detect.*if|when.*detect|detected.*infra|infra.*detected/i
      );
    });
  });
});
