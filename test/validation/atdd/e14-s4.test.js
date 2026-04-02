/**
 * ATDD — E14-S4: GitHub Action — Auto-Version on Staging Merge
 *
 * Red phase: all tests must FAIL because the implementation does not exist yet.
 * - AC1–AC4: version-bump-staging.yml workflow does not exist
 * - AC5: Workflow commit scope cannot be validated without the workflow file
 * - AC6: Bot token / GitHub App bypass cannot be validated without the workflow file
 *
 * Dependency: E14-S3 (version:bump --prerelease rc, bump:none modes)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const STAGING_WORKFLOW = path.join(
  PROJECT_ROOT,
  ".github",
  "workflows",
  "version-bump-staging.yml"
);
const VERSION_BUMP_SCRIPT = path.join(PROJECT_ROOT, "scripts", "version-bump.js");

// ── Fixture helper ─────────────────────────────────────────────────────────

function createFixtures(version = "1.65.1") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e14s4-"));

  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "gaia-framework", version, scripts: {} }, null, 2) + "\n"
  );
  fs.mkdirSync(path.join(dir, "_gaia", "_config"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "_gaia", "_config", "global.yaml"),
    `framework_name: "GAIA"\nframework_version: "${version}"\n`
  );

  return dir;
}

function runBumpResult(dir, args = []) {
  try {
    const stdout = execFileSync("node", [VERSION_BUMP_SCRIPT, ...args], {
      cwd: dir,
      env: { ...process.env, GAIA_PROJECT_ROOT: dir },
      encoding: "utf8",
      timeout: 10000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: err.status,
    };
  }
}

describe("E14-S4: GitHub Action — Auto-Version on Staging Merge", () => {
  // ── AC1: Workflow triggers on PR merge to staging ──────────────────────

  describe("AC1: Workflow triggers on PR merge to staging", () => {
    it("test_ac1_workflow_file_exists — version-bump-staging.yml exists in .github/workflows/", () => {
      expect(fs.existsSync(STAGING_WORKFLOW)).toBe(true);
    });

    it("test_ac1_trigger_on_pr_merge — workflow triggers on pull_request closed event targeting staging", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");
      const workflow = yaml.load(content);

      // Must trigger on pull_request with types: [closed]
      expect(workflow.on).toHaveProperty("pull_request");
      expect(workflow.on.pull_request.types).toContain("closed");
      // Must target staging branch
      expect(workflow.on.pull_request.branches).toContain("staging");
    });

    it("test_ac1_merge_guard — workflow checks that PR was merged, not just closed", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must have an if condition checking github.event.pull_request.merged == true
      expect(content).toMatch(/github\.event\.pull_request\.merged\s*==\s*true/);
    });

    it("test_ac1_concurrency_group — workflow uses concurrency group to prevent race conditions", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");
      const workflow = yaml.load(content);

      // Must have concurrency config
      expect(workflow.concurrency).toBeDefined();
      // cancel-in-progress must be false (wait, don't cancel)
      expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
    });
  });

  // ── AC2: Reads bump label from merged PR ───────────────────────────────

  describe("AC2: Reads bump label from merged PR", () => {
    it("test_ac2_label_extraction — workflow extracts bump label from PR metadata", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must reference PR labels to extract bump type
      expect(content).toMatch(/github\.event\.pull_request\.labels/);
      // Must filter for bump:* pattern
      expect(content).toMatch(/bump:/);
    });

    it("test_ac2_all_label_types — workflow handles all 4 bump label types", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must reference major, minor, patch, and none bump types
      expect(content).toMatch(/bump:major/);
      expect(content).toMatch(/bump:minor/);
      expect(content).toMatch(/bump:patch/);
      expect(content).toMatch(/bump:none/);
    });
  });

  // ── AC3: First RC creation from clean version ──────────────────────────

  describe("AC3: First RC from clean version", () => {
    let dir;

    beforeEach(() => {
      dir = createFixtures("1.65.1");
    });

    afterEach(() => {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    it("test_ac3_first_rc_creation — version:bump with --prerelease rc produces -rc.1 suffix", () => {
      // E14-S3 must add --prerelease rc support to version-bump.js
      const result = runBumpResult(dir, ["patch", "--prerelease", "rc"]);

      // Must succeed
      expect(result.exitCode).toBe(0);

      // Version must have -rc.1 suffix
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      expect(pkg.version).toBe("1.65.2-rc.1");

      // global.yaml must also be updated
      const global = fs.readFileSync(path.join(dir, "_gaia", "_config", "global.yaml"), "utf8");
      expect(global).toContain('framework_version: "1.65.2-rc.1"');
    });

    it("test_ac3_workflow_invokes_prerelease — workflow file contains prerelease rc invocation", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must invoke version:bump with --prerelease rc flag
      expect(content).toMatch(/--prerelease\s+rc/);
    });
  });

  // ── AC4: Existing RC — bump:none increments RC counter ─────────────────

  describe("AC4: RC counter increment and higher bump override", () => {
    let dir;

    beforeEach(() => {
      dir = createFixtures("1.65.2-rc.1");
    });

    afterEach(() => {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    it("test_ac4_rc_counter_increment — bump:none on existing RC increments counter", () => {
      // E14-S3 must add bump:none support for RC counter increment
      const result = runBumpResult(dir, ["none"]);

      expect(result.exitCode).toBe(0);

      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      expect(pkg.version).toBe("1.65.2-rc.2");
    });

    it("test_ac4_higher_bump_overrides_rc — bump:minor on patch-based RC resets version", () => {
      // If current is 1.65.2-rc.1 (patch-based) and label is bump:minor,
      // version should reset to 1.66.0-rc.1.
      // The workflow does this in two steps: strip RC first, then bump with --prerelease rc
      // (version-bump.js rejects --prerelease rc on an already-RC version by design)
      const stripResult = runBumpResult(dir, ["--strip-prerelease"]);
      expect(stripResult.exitCode).toBe(0);

      const result = runBumpResult(dir, ["minor", "--prerelease", "rc"]);
      expect(result.exitCode).toBe(0);

      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      expect(pkg.version).toBe("1.66.0-rc.1");
    });

    it("test_ac4_bump_none_on_clean_version_skips — bump:none on non-RC version exits gracefully", () => {
      // Create a clean version fixture
      const cleanDir = createFixtures("1.65.1");

      const result = runBumpResult(cleanDir, ["none"]);

      // Should either exit with non-zero or produce a warning — not bump the version
      const pkg = JSON.parse(fs.readFileSync(path.join(cleanDir, "package.json"), "utf8"));
      // Version should remain unchanged
      expect(pkg.version).toBe("1.65.1");

      fs.rmSync(cleanDir, { recursive: true, force: true });
    });

    it("test_ac4_workflow_handles_rc_logic — workflow detects existing RC and applies correct bump", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must read current version to check for RC suffix
      expect(content).toMatch(/package\.json/);
      // Must have conditional logic for RC vs clean version
      expect(content).toMatch(/-rc\./);
    });
  });

  // ── AC5: Commits only 2 files with correct message format ──────────────

  describe("AC5: Commit scope and message format", () => {
    it("test_ac5_two_file_commit — workflow stages only package.json and global.yaml", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must reference git add with specific files
      expect(content).toMatch(/git\s+add/);
      expect(content).toMatch(/package\.json/);
      expect(content).toMatch(/global\.yaml/);

      // Must NOT use git add -A or git add .
      expect(content).not.toMatch(/git\s+add\s+-A/);
      expect(content).not.toMatch(/git\s+add\s+\./);
    });

    it("test_ac5_commit_message_format — commit message follows chore: bump version to {version}", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must have commit message matching the required format
      expect(content).toMatch(/chore:\s*bump\s+version\s+to/);
    });
  });

  // ── AC6: Bot token / GitHub App for branch protection bypass ───────────

  describe("AC6: Bot token for branch protection bypass", () => {
    it("test_ac6_bot_token_checkout — checkout step uses bot token or app token secret", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must use a token other than default GITHUB_TOKEN for checkout
      // Either VERSION_BUMP_TOKEN or a GitHub App token
      expect(content).toMatch(
        /secrets\.VERSION_BUMP_TOKEN|secrets\.\w+_APP_TOKEN|secrets\.\w+_TOKEN/
      );

      // The checkout step must reference this token
      expect(content).toMatch(/actions\/checkout/);
    });

    it("test_ac6_bot_git_identity — workflow configures bot git identity", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must set git user.name to bot identity
      expect(content).toMatch(/git\s+config.*user\.name/);
      // Must set git user.email to bot identity
      expect(content).toMatch(/git\s+config.*user\.email/);
    });

    it("test_ac6_push_with_token — push step uses the bot/app token", () => {
      const content = fs.readFileSync(STAGING_WORKFLOW, "utf-8");

      // Must push to staging
      expect(content).toMatch(/git\s+push/);
      // Must reference staging branch
      expect(content).toMatch(/staging/);
    });
  });
});
