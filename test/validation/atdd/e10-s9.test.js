import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const CONFIG_DIR = join(GAIA_DIR, "_config");

const ADVERSARIAL_TRIGGERS_PATH = join(CONFIG_DIR, "adversarial-triggers.yaml");
const CREATE_PRD_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "2-planning",
  "create-prd",
  "instructions.xml"
);
const CREATE_ARCH_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "3-solutioning",
  "create-architecture",
  "instructions.xml"
);
const EDIT_PRD_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "2-planning",
  "edit-prd",
  "instructions.xml"
);
const EDIT_ARCH_INSTRUCTIONS = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "3-solutioning",
  "edit-architecture",
  "instructions.xml"
);
const FILES_MANIFEST = join(CONFIG_DIR, "files-manifest.csv");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function loadTriggerConfig() {
  const content = loadFile(ADVERSARIAL_TRIGGERS_PATH);
  if (!content) return null;
  return parseYaml(content);
}

/**
 * Evaluate trigger rules from the config for a given change_type and artifact.
 * Returns true if adversarial review should be triggered.
 */
function shouldTriggerAdversarial(config, changeType, artifact, magnitude) {
  if (!config || !config.trigger_rules) return false;
  const rules = config.trigger_rules;
  const rule = rules.find((r) => r.change_type === changeType && r.artifact === artifact);
  if (!rule) return false;
  if (!rule.adversarial) return false;
  // If there's a magnitude_threshold, check it
  if (rule.magnitude_threshold) {
    const magnitudeOrder = ["NONE", "MINOR", "SIGNIFICANT", "BREAKING"];
    const thresholdIdx = magnitudeOrder.indexOf(rule.magnitude_threshold);
    const actualIdx = magnitudeOrder.indexOf(magnitude || "NONE");
    return actualIdx >= thresholdIdx;
  }
  return true;
}

describe("E10-S9: Adversarial Review Trigger Rules", () => {
  describe("Config file structure", () => {
    it("adversarial-triggers.yaml exists", () => {
      expect(existsSync(ADVERSARIAL_TRIGGERS_PATH)).toBe(true);
    });

    it("config contains trigger_rules array", () => {
      const config = loadTriggerConfig();
      expect(config).not.toBeNull();
      expect(config.trigger_rules).toBeDefined();
      expect(Array.isArray(config.trigger_rules)).toBe(true);
      expect(config.trigger_rules.length).toBeGreaterThan(0);
    });

    it("config contains high_risk_enhancement_criteria", () => {
      const config = loadTriggerConfig();
      expect(config).not.toBeNull();
      expect(config.high_risk_enhancement_criteria).toBeDefined();
    });

    it("each rule has required fields: change_type, artifact, adversarial", () => {
      const config = loadTriggerConfig();
      expect(config).not.toBeNull();
      for (const rule of config.trigger_rules) {
        expect(rule).toHaveProperty("change_type");
        expect(rule).toHaveProperty("artifact");
        expect(rule).toHaveProperty("adversarial");
      }
    });

    it("config is registered in files-manifest.csv", () => {
      const manifest = loadFile(FILES_MANIFEST);
      expect(manifest).not.toBeNull();
      expect(manifest).toContain("adversarial-triggers.yaml");
    });
  });

  // AC1: Feature PRD triggers adversarial
  describe("AC1: Feature and high-risk enhancement PRD triggers", () => {
    it("Scenario 1: feature PRD triggers adversarial review", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "feature", "prd", null)).toBe(true);
    });

    it("Scenario 2: high-risk enhancement PRD triggers adversarial review", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "high-risk-enhancement", "prd", null)).toBe(true);
    });
  });

  // AC2: Feature + SIGNIFICANT architecture triggers
  describe("AC2: Architecture adversarial with magnitude threshold", () => {
    it("Scenario 5: feature + SIGNIFICANT architecture triggers adversarial", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "feature", "architecture", "SIGNIFICANT")).toBe(true);
    });

    it("Scenario 5b: feature + BREAKING architecture triggers adversarial", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "feature", "architecture", "BREAKING")).toBe(true);
    });

    it("Scenario 6: feature + MINOR architecture does NOT trigger adversarial", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "feature", "architecture", "MINOR")).toBe(false);
    });

    it("high-risk enhancement + SIGNIFICANT architecture triggers adversarial", () => {
      const config = loadTriggerConfig();
      expect(
        shouldTriggerAdversarial(config, "high-risk-enhancement", "architecture", "SIGNIFICANT")
      ).toBe(true);
    });
  });

  // AC3: Non-triggering change types
  describe("AC3: Non-triggering change types skip adversarial", () => {
    it("Scenario 3: low-risk enhancement PRD does NOT trigger adversarial", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "low-risk-enhancement", "prd", null)).toBe(false);
    });

    it("Scenario 4: bug fix PRD does NOT trigger adversarial", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "bug-fix", "prd", null)).toBe(false);
    });

    it("documentation PRD does NOT trigger adversarial", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "documentation", "prd", null)).toBe(false);
    });

    it("patch PRD does NOT trigger adversarial", () => {
      const config = loadTriggerConfig();
      expect(shouldTriggerAdversarial(config, "patch", "prd", null)).toBe(false);
    });

    it("Scenario 7: UX artifact never triggers adversarial for any change type", () => {
      const config = loadTriggerConfig();
      const changeTypes = [
        "feature",
        "high-risk-enhancement",
        "low-risk-enhancement",
        "bug-fix",
        "documentation",
        "patch",
      ];
      for (const ct of changeTypes) {
        expect(shouldTriggerAdversarial(config, ct, "ux-design", null)).toBe(false);
      }
    });

    it("test-plan artifact never triggers adversarial for any change type", () => {
      const config = loadTriggerConfig();
      const changeTypes = ["feature", "high-risk-enhancement", "low-risk-enhancement", "bug-fix"];
      for (const ct of changeTypes) {
        expect(shouldTriggerAdversarial(config, ct, "test-plan", null)).toBe(false);
      }
    });
  });

  // Workflow instruction integration
  describe("Workflow instructions reference adversarial-triggers.yaml", () => {
    it("create-prd instructions reference adversarial-triggers.yaml", () => {
      const content = loadFile(CREATE_PRD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toContain("adversarial-triggers.yaml");
    });

    it("create-architecture instructions reference adversarial-triggers.yaml", () => {
      const content = loadFile(CREATE_ARCH_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toContain("adversarial-triggers.yaml");
    });

    it("edit-prd instructions reference adversarial-triggers.yaml", () => {
      const content = loadFile(EDIT_PRD_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toContain("adversarial-triggers.yaml");
    });

    it("edit-architecture instructions reference adversarial-triggers.yaml", () => {
      const content = loadFile(EDIT_ARCH_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toContain("adversarial-triggers.yaml");
    });
  });
});
