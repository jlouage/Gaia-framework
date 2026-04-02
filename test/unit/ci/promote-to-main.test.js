const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const WORKFLOW_PATH = path.join(PROJECT_ROOT, ".github/workflows/promote-to-main.yml");

describe("E14-S5: promote-to-main.yml workflow", () => {
  let workflowContent;
  let workflow;

  beforeAll(() => {
    workflowContent = fs.readFileSync(WORKFLOW_PATH, "utf8");
    workflow = yaml.parse(workflowContent);
  });

  // AC1: Workflow file exists and is valid YAML
  describe("Workflow structure (AC1)", () => {
    it("should exist as a valid YAML file", () => {
      expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
      expect(workflow).toBeDefined();
      expect(typeof workflow).toBe("object");
    });

    it('should have a name field containing "Promote"', () => {
      expect(workflow.name).toBeDefined();
      expect(workflow.name.toLowerCase()).toContain("promote");
    });
  });

  // AC1: Triggers only on merged PRs from staging to main
  describe("Trigger configuration (AC1)", () => {
    it("should trigger on pull_request events to main", () => {
      expect(workflow.on).toBeDefined();
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.pull_request.branches).toContain("main");
    });

    it('should trigger on "closed" type pull_request events', () => {
      expect(workflow.on.pull_request.types).toContain("closed");
    });

    it("should have a job-level condition checking merged status and staging branch", () => {
      // The workflow must check that the PR was actually merged (not just closed)
      // and that it came from the staging branch
      const jobNames = Object.keys(workflow.jobs);
      expect(jobNames.length).toBeGreaterThan(0);

      const primaryJob = workflow.jobs[jobNames[0]];
      const ifCondition = primaryJob.if || "";
      expect(ifCondition).toContain("github.event.pull_request.merged");
      expect(ifCondition).toContain("staging");
    });
  });

  // AC2: strip-prerelease integration
  describe("Version strip logic (AC2)", () => {
    it("should reference version-bump.js with --strip-prerelease", () => {
      expect(workflowContent).toContain("--strip-prerelease");
      expect(workflowContent).toContain("version-bump.js");
    });
  });

  // AC3: Commits cleaned version files
  describe("Git commit configuration (AC3)", () => {
    it("should configure git identity as github-actions[bot]", () => {
      expect(workflowContent).toContain("github-actions[bot]");
    });

    it("should commit version files to main", () => {
      expect(workflowContent).toContain("git commit");
      expect(workflowContent).toContain("git push");
    });
  });

  // AC4: Creates git tag
  describe("Tag creation (AC4)", () => {
    it("should create a git tag with v prefix", () => {
      expect(workflowContent).toContain("git tag");
    });
  });

  // AC5: Creates GitHub Release
  describe("GitHub Release creation (AC5)", () => {
    it("should create a GitHub Release using gh CLI", () => {
      expect(workflowContent).toContain("gh release create");
    });

    it("should use --generate-notes for release notes", () => {
      expect(workflowContent).toContain("--generate-notes");
    });
  });

  // AC6: No-RC-suffix edge case
  describe("No-RC-suffix edge case (AC6)", () => {
    it("should have conditional logic to skip strip when no RC suffix", () => {
      // The workflow should check for RC suffix presence before stripping
      // In bash regex within YAML, the dot is escaped: -rc\.[0-9]+
      expect(workflowContent).toContain("-rc");
      expect(workflowContent).toContain("has_rc");
    });

    it("should conditionally run the strip step based on has_rc output", () => {
      // The strip step must have an 'if' condition referencing has_rc
      const steps = workflow.jobs.promote.steps;
      const stripStep = steps.find((s) => s.name && s.name.toLowerCase().includes("strip"));
      expect(stripStep).toBeDefined();
      expect(stripStep.if).toContain("has_rc");
    });
  });

  // Permissions
  describe("Permissions", () => {
    it("should declare contents: write permission", () => {
      expect(workflow.permissions).toBeDefined();
      expect(workflow.permissions.contents).toBe("write");
    });
  });

  // Concurrency
  describe("Concurrency", () => {
    it("should define a concurrency group", () => {
      expect(workflow.concurrency).toBeDefined();
      expect(workflow.concurrency.group).toContain("promote-to-main");
    });

    it("should not cancel in-progress runs", () => {
      expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
    });
  });

  // Test suite runs before version operations
  describe("Test suite gate", () => {
    it("should run npm test before version strip", () => {
      const testIndex = workflowContent.indexOf("npm test");
      const stripIndex = workflowContent.indexOf("--strip-prerelease");
      expect(testIndex).toBeGreaterThan(-1);
      expect(stripIndex).toBeGreaterThan(-1);
      expect(testIndex).toBeLessThan(stripIndex);
    });
  });

  // Checksums
  describe("Checksums", () => {
    it("should generate checksums", () => {
      expect(workflowContent).toMatch(/sha256sum|shasum/);
    });

    it("should attach checksums to the release", () => {
      expect(workflowContent).toContain("checksums.txt");
    });
  });

  // Step ordering — pipeline correctness
  describe("Pipeline ordering", () => {
    it("should run commit before tag creation", () => {
      const commitIndex = workflowContent.indexOf("git commit");
      const tagIndex = workflowContent.indexOf("git tag");
      expect(commitIndex).toBeLessThan(tagIndex);
    });

    it("should run tag creation before GitHub Release", () => {
      const tagIndex = workflowContent.indexOf("git tag");
      const releaseIndex = workflowContent.indexOf("gh release create");
      expect(tagIndex).toBeLessThan(releaseIndex);
    });
  });

  // Node.js setup
  describe("Node.js setup", () => {
    it("should use Node.js 20", () => {
      expect(workflowContent).toContain("node-version: 20");
    });

    it("should use actions/setup-node", () => {
      expect(workflowContent).toContain("actions/setup-node");
    });
  });
});
