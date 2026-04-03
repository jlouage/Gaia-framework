/**
 * Unit tests — version-bump-staging.yml workflow structure
 *
 * E14-S4: Validates the GitHub Action workflow YAML for auto-versioning on staging merges.
 * Tests parse the workflow YAML and verify structural correctness of trigger config,
 * merge guards, concurrency, label extraction, version bump logic, commit scope, and bot identity.
 *
 * Pattern: mirrors cross-platform-matrix.test.js — reads YAML, asserts structure.
 */
const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const WORKFLOW_PATH = path.join(PROJECT_ROOT, ".github", "workflows", "version-bump-staging.yml");

/** Read workflow file and parse as YAML */
function loadWorkflow() {
  const content = fs.readFileSync(WORKFLOW_PATH, "utf8");
  return { content, parsed: yaml.parse(content) };
}

describe("E14-S4: version-bump-staging.yml workflow", () => {
  let content;
  let parsed;

  beforeAll(() => {
    const wf = loadWorkflow();
    content = wf.content;
    parsed = wf.parsed;
  });

  describe("Trigger configuration (AC1)", () => {
    it("triggers on pull_request closed event", () => {
      expect(parsed.on).toHaveProperty("pull_request");
      expect(parsed.on.pull_request.types).toContain("closed");
    });

    it("targets the staging branch", () => {
      expect(parsed.on.pull_request.branches).toContain("staging");
    });

    it("has merge guard condition checking merged == true", () => {
      expect(content).toMatch(/github\.event\.pull_request\.merged\s*==\s*true/);
    });
  });

  describe("Concurrency control (AC1)", () => {
    it("defines a concurrency group", () => {
      expect(parsed.concurrency).toBeDefined();
      expect(parsed.concurrency.group).toBeDefined();
    });

    it("does not cancel in-progress runs (serializes instead)", () => {
      expect(parsed.concurrency["cancel-in-progress"]).toBe(false);
    });
  });

  describe("Label extraction (AC2)", () => {
    it("references PR labels for bump type extraction", () => {
      expect(content).toMatch(/github\.event\.pull_request\.labels/);
    });

    it("handles all 4 bump label types", () => {
      expect(content).toMatch(/bump:major/);
      expect(content).toMatch(/bump:minor/);
      expect(content).toMatch(/bump:patch/);
      expect(content).toMatch(/bump:none/);
    });
  });

  describe("Version bump logic (AC3, AC4)", () => {
    it("invokes version:bump with --prerelease rc for first RC", () => {
      expect(content).toMatch(/--prerelease\s+rc/);
    });

    it("reads current version from package.json to detect RC suffix", () => {
      expect(content).toMatch(/package\.json/);
    });

    it("detects existing RC suffix with -rc. pattern", () => {
      expect(content).toMatch(/-rc\./);
    });

    it("handles bump:none for RC counter increment", () => {
      // Workflow must have logic path for bump:none
      expect(content).toMatch(/bump:none/);
      expect(content).toMatch(
        /version-bump\.js\s+none|version:bump\s+(?:--\s+)?none|npm run version:bump\s+(?:--\s+)?none/
      );
    });

    it("handles bump:none on clean version as skip/warning", () => {
      // Must have some conditional to handle bump:none on non-RC version
      expect(content).toMatch(/skip|warning|no.*version.*change|already.*clean/i);
    });
  });

  describe("Commit scope (AC5)", () => {
    it("stages only package.json and global.yaml (not git add -A or git add .)", () => {
      expect(content).toMatch(/git\s+add/);
      expect(content).toMatch(/package\.json/);
      expect(content).toMatch(/global\.yaml/);
      expect(content).not.toMatch(/git\s+add\s+-A/);
      expect(content).not.toMatch(/git\s+add\s+\.\s/);
    });

    it("commit message follows chore: bump version to {version} format", () => {
      expect(content).toMatch(/chore:\s*bump\s+version\s+to/);
    });
  });

  describe("Bot identity and token (AC6)", () => {
    it("uses a bot token secret for checkout (not default GITHUB_TOKEN)", () => {
      expect(content).toMatch(/secrets\.VERSION_BUMP_TOKEN/);
    });

    it("configures git user.name as bot identity", () => {
      expect(content).toMatch(/git\s+config.*user\.name/);
    });

    it("configures git user.email as bot identity", () => {
      expect(content).toMatch(/git\s+config.*user\.email/);
    });

    it("pushes to staging branch", () => {
      expect(content).toMatch(/git\s+push/);
      expect(content).toMatch(/staging/);
    });
  });

  describe("Permissions and security", () => {
    it("declares minimal permissions", () => {
      expect(parsed.permissions).toBeDefined();
      expect(parsed.permissions.contents).toBe("write");
    });

    it("does not hardcode any secrets or tokens in workflow file", () => {
      // No literal PAT tokens, only ${{ secrets.* }} references
      expect(content).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
      expect(content).not.toMatch(/github_pat_[A-Za-z0-9_]+/);
    });
  });
});
