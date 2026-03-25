import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_DIR = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "val-refresh-ground-truth"
);

describe("E8-S9: val-refresh-ground-truth Workflow", () => {
  // AC1: Required workflow files exist
  describe("AC1: workflow.yaml, instructions.xml, checklist.md exist", () => {
    const requiredFiles = ["workflow.yaml", "instructions.xml", "checklist.md"];

    it.each(requiredFiles)("val-refresh-ground-truth/%s exists", (file) => {
      expect(
        existsSync(join(WORKFLOW_DIR, file)),
        `Missing file: val-refresh-ground-truth/${file}`
      ).toBe(true);
    });
  });

  // AC2: workflow.yaml declares agent as validator
  describe("AC2: workflow.yaml configuration", () => {
    it("workflow.yaml declares agent as validator", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/agent:\s*validator/);
    });

    it("workflow.yaml declares module as lifecycle", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/module:\s*lifecycle/);
    });
  });

  // AC3: instructions.xml contains ground truth scanning steps
  describe("AC3: instructions contain ground truth scanning logic", () => {
    it("instructions.xml contains filesystem scanning action", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      expect(existsSync(instrPath), "instructions.xml must exist").toBe(true);

      const content = readFileSync(instrPath, "utf-8").toLowerCase();
      const hasScan =
        content.includes("scan") || content.includes("discover") || content.includes("inventory");
      expect(hasScan, "Must contain filesystem scanning logic").toBe(true);
    });

    it("instructions.xml references ground-truth.md output", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      expect(content).toMatch(/ground-truth/i);
    });
  });

  // AC4: Manifest entry
  describe("AC4: workflow-manifest.csv contains val-refresh-ground-truth", () => {
    it("val-refresh-ground-truth is listed in workflow-manifest.csv", () => {
      const manifestPath = join(PROJECT_ROOT, "_gaia", "_config", "workflow-manifest.csv");
      expect(existsSync(manifestPath), "workflow-manifest.csv must exist").toBe(true);

      const content = readFileSync(manifestPath, "utf-8");
      expect(content).toContain("val-refresh-ground-truth");
    });
  });
});
