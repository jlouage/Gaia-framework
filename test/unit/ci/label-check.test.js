const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

/** Read a file relative to project root */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

/** Parse label-check.yml and return the parsed YAML object */
function loadLabelCheckWorkflow() {
  const content = readProjectFile(".github/workflows/label-check.yml");
  return yaml.parse(content);
}

// --- Part 1: Workflow Structure Tests ---

describe("E14-S6: PR Label Enforcement Status Check — Workflow Structure", () => {
  let workflowYaml;

  beforeAll(() => {
    workflowYaml = loadLabelCheckWorkflow();
  });

  // AC1: Workflow file exists and triggers on PR targeting staging
  describe("AC1: Workflow triggers on PRs targeting staging", () => {
    it("should have a pull_request trigger", () => {
      expect(workflowYaml.on).toBeDefined();
      expect(workflowYaml.on.pull_request).toBeDefined();
    });

    it("should target the staging branch", () => {
      const pr = workflowYaml.on.pull_request;
      expect(pr.branches).toContain("staging");
    });
  });

  // AC5: Trigger events include opened, labeled, unlabeled, synchronize
  describe("AC5: Re-evaluates on label and PR events", () => {
    it("should trigger on opened events", () => {
      const types = workflowYaml.on.pull_request.types;
      expect(types).toContain("opened");
    });

    it("should trigger on labeled events", () => {
      const types = workflowYaml.on.pull_request.types;
      expect(types).toContain("labeled");
    });

    it("should trigger on unlabeled events", () => {
      const types = workflowYaml.on.pull_request.types;
      expect(types).toContain("unlabeled");
    });

    it("should trigger on synchronize events", () => {
      const types = workflowYaml.on.pull_request.types;
      expect(types).toContain("synchronize");
    });
  });

  // AC4: Does NOT enforce on PRs targeting main (branch filter restricts to staging only)
  describe("AC4: Does not trigger for PRs targeting main", () => {
    it("should only list staging in branches filter (not main)", () => {
      const branches = workflowYaml.on.pull_request.branches;
      expect(branches).not.toContain("main");
      expect(branches).toEqual(["staging"]);
    });
  });

  // Workflow has a descriptive name
  it("should have a descriptive workflow name", () => {
    expect(workflowYaml.name).toBeDefined();
    expect(typeof workflowYaml.name).toBe("string");
    expect(workflowYaml.name.length).toBeGreaterThan(0);
  });
});

// --- Part 2: Label Validation Logic Tests ---

describe("E14-S6: PR Label Enforcement Status Check — Label Validation Logic", () => {
  let validateBumpLabels;

  beforeAll(() => {
    // Load the validation function from the helper module
    validateBumpLabels = require(path.join(PROJECT_ROOT, "bin/helpers/validate-bump-labels.js"));
  });

  const VALID_LABELS = ["bump:major", "bump:minor", "bump:patch", "bump:none"];

  // AC2: Exactly one valid bump label passes
  describe("AC2: Passes with exactly one bump label", () => {
    it.each(VALID_LABELS)("should pass when '%s' is the only bump label", (label) => {
      const result = validateBumpLabels([label]);
      expect(result.pass).toBe(true);
    });

    it("should pass with bump:patch and non-bump labels", () => {
      const result = validateBumpLabels(["bump:patch", "documentation", "enhancement"]);
      expect(result.pass).toBe(true);
    });

    it("should pass with bump:none and non-bump labels", () => {
      const result = validateBumpLabels(["bump:none", "bug"]);
      expect(result.pass).toBe(true);
    });
  });

  // AC3: Zero or multiple bump labels fail with clear error
  describe("AC3: Fails with zero or multiple bump labels", () => {
    it("should fail when no labels are present", () => {
      const result = validateBumpLabels([]);
      expect(result.pass).toBe(false);
      expect(result.message).toContain("No bump label found");
      // Should list valid options
      for (const label of VALID_LABELS) {
        expect(result.message).toContain(label);
      }
    });

    it("should fail when only non-bump labels are present", () => {
      const result = validateBumpLabels(["documentation", "enhancement"]);
      expect(result.pass).toBe(false);
      expect(result.message).toContain("No bump label found");
    });

    it("should fail when multiple bump labels are present", () => {
      const result = validateBumpLabels(["bump:patch", "bump:minor"]);
      expect(result.pass).toBe(false);
      expect(result.message).toContain("Multiple bump labels found");
      expect(result.message).toContain("bump:patch");
      expect(result.message).toContain("bump:minor");
    });

    it("should fail when all four bump labels are present", () => {
      const result = validateBumpLabels([...VALID_LABELS]);
      expect(result.pass).toBe(false);
      expect(result.message).toContain("Multiple bump labels found");
    });

    it("should fail when multiple bump labels plus non-bump labels are present", () => {
      const result = validateBumpLabels(["bump:major", "bump:none", "documentation"]);
      expect(result.pass).toBe(false);
      expect(result.message).toContain("Multiple bump labels found");
    });
  });

  // Edge case: non-bump labels are ignored
  describe("Non-bump labels are ignored", () => {
    it("should not count labels that do not start with bump:", () => {
      const result = validateBumpLabels(["feature", "priority:high", "bump:patch"]);
      expect(result.pass).toBe(true);
    });

    it("should not count labels with similar but different prefixes", () => {
      const result = validateBumpLabels(["bumping:patch", "bump:minor"]);
      expect(result.pass).toBe(true);
    });
  });
});
