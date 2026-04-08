/**
 * Tier 1 Validation: Publish Workflow (E4-S2)
 *
 * Validates the structure and configuration of .github/workflows/publish.yml.
 * Covers: AC1 (trigger/structure), AC2 (provenance),
 *         AC4a/AC4b (verification/checksums), AC5 (permissions)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const PUBLISH_WORKFLOW_PATH = resolve(PROJECT_ROOT, ".github/workflows/publish.yml");

describe("Publish Workflow Validation (E4-S2)", () => {
  let publishConfig;
  let rawContent;

  beforeAll(() => {
    rawContent = readFileSync(PUBLISH_WORKFLOW_PATH, "utf8");
    publishConfig = yaml.load(rawContent);
  });

  // AC1: Trigger and structure
  describe("AC1 — Release trigger and draft guard", () => {
    it("publish.yml file should exist", () => {
      expect(existsSync(PUBLISH_WORKFLOW_PATH)).toBe(true);
    });

    it("should trigger on release created event only", () => {
      const release = publishConfig.on.release;
      expect(release).toBeDefined();
      expect(release.types).toEqual(["created"]);
    });

    it("should NOT have a tags trigger (ADR-009)", () => {
      expect(publishConfig.on.push).toBeUndefined();
    });

    it("should have a draft release guard", () => {
      // The publish job should have an if condition checking draft == false
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      expect(publishJob).toBeDefined();
      const jobIf = publishJob.if || "";
      expect(jobIf).toContain("draft");
      expect(jobIf).toContain("false");
    });

    it("should run full test suite before publish", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const testStep = steps.find((s) => s.run && s.run.includes("npm test"));
      expect(testStep).toBeDefined();
    });

    it("should pin node-version to 20 (exact, not lts/*)", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const setupNode = steps.find((s) => s.uses && s.uses.startsWith("actions/setup-node@v4"));
      expect(setupNode).toBeDefined();
      expect(setupNode.with["node-version"]).toBe(20);
    });

    it("should use npm ci (not npm install)", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const npmCi = steps.find((s) => s.run && s.run.trim() === "npm ci");
      expect(npmCi).toBeDefined();
    });
  });

  // AC2: npm publish with provenance
  describe("AC2 — npm publish with provenance", () => {
    it("should run npm publish --provenance", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const publishStep = steps.find((s) => s.run && s.run.includes("npm publish --provenance"));
      expect(publishStep).toBeDefined();
    });

    it("should set NODE_AUTH_TOKEN from secrets", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const publishStep = steps.find((s) => s.run && s.run.includes("npm publish"));
      expect(publishStep).toBeDefined();
      expect(publishStep.env).toBeDefined();
      expect(publishStep.env.NODE_AUTH_TOKEN).toContain("NPM_TOKEN");
    });

    it("should configure setup-node with registry-url", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const setupNode = steps.find((s) => s.uses && s.uses.startsWith("actions/setup-node@v4"));
      expect(setupNode.with["registry-url"]).toBe("https://registry.npmjs.org");
    });
  });

  // AC4a: Post-publish verification
  describe("AC4a — Post-publish verification", () => {
    it("should verify published version with npm view and retry", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const verifyStep = steps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("verify") &&
          s.name.toLowerCase().includes("publish") &&
          s.run &&
          s.run.includes("npm view gaia-framework version")
      );
      expect(verifyStep).toBeDefined();
    });

    it("should implement retry logic for CDN propagation delay", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const steps = publishJob.steps;
      const verifyStep = steps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("verify") &&
          s.name.toLowerCase().includes("publish") &&
          s.run &&
          s.run.includes("npm view gaia-framework version")
      );
      expect(verifyStep).toBeDefined();
      // Should have retry/loop logic (sleep or retry keyword)
      expect(verifyStep.run).toMatch(/retry|attempt|sleep|for\s/i);
    });
  });

  // AC4b: Checksums
  describe("AC4b — Checksum generation and release attachment", () => {
    it("should generate checksums with sha256sum", () => {
      const jobs = publishConfig.jobs;
      const allSteps = [];
      for (const job of Object.values(jobs)) {
        if (job.steps) allSteps.push(...job.steps);
      }
      const checksumStep = allSteps.find((s) => s.run && s.run.includes("sha256sum"));
      expect(checksumStep).toBeDefined();
    });

    it("should run npm pack to produce .tgz for checksumming", () => {
      const jobs = publishConfig.jobs;
      const allSteps = [];
      for (const job of Object.values(jobs)) {
        if (job.steps) allSteps.push(...job.steps);
      }
      // Find step that packs and checksums
      const packStep = allSteps.find(
        (s) => s.run && s.run.includes("npm pack") && !s.run.includes("--dry-run")
      );
      expect(packStep).toBeDefined();
    });

    it("should upload checksums.txt to GitHub Release", () => {
      const jobs = publishConfig.jobs;
      const allSteps = [];
      for (const job of Object.values(jobs)) {
        if (job.steps) allSteps.push(...job.steps);
      }
      const uploadStep = allSteps.find((s) => s.run && s.run.includes("gh release upload"));
      expect(uploadStep).toBeDefined();
    });

    it("checksum upload failure should be treated as warning not error", () => {
      const jobs = publishConfig.jobs;
      const allSteps = [];
      for (const job of Object.values(jobs)) {
        if (job.steps) allSteps.push(...job.steps);
      }
      const uploadStep = allSteps.find((s) => s.run && s.run.includes("gh release upload"));
      expect(uploadStep).toBeDefined();
      // Should have continue-on-error or || true or warning handling
      const hasWarningHandling =
        uploadStep["continue-on-error"] === true ||
        uploadStep.run.includes("|| true") ||
        uploadStep.run.includes("::warning::");
      expect(hasWarningHandling).toBe(true);
    });
  });

  // AC5: Permissions scoping
  describe("AC5 — Least-privilege permissions", () => {
    it("publish job should declare id-token: write for provenance", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const perms = publishJob.permissions;
      expect(perms).toBeDefined();
      expect(perms["id-token"]).toBe("write");
    });

    it("publish job should declare contents: write (required for version-sync commit)", () => {
      const jobs = publishConfig.jobs;
      const publishJob = jobs.publish || jobs["publish-and-verify"];
      const perms = publishJob.permissions;
      expect(perms).toBeDefined();
      expect(perms.contents).toBe("write");
    });

    it("release asset upload should have contents: write permission", () => {
      // Either a separate job or the upload step needs contents: write
      const jobs = publishConfig.jobs;
      const releaseAssetsJob = jobs["release-assets"];
      if (releaseAssetsJob) {
        // Separate job for release assets
        expect(releaseAssetsJob.permissions.contents).toBe("write");
      } else {
        // Same job — broader permission acceptable per story notes
        const publishJob = jobs.publish || jobs["publish-and-verify"];
        const perms = publishJob.permissions;
        expect(perms.contents).toMatch(/read|write/);
      }
    });
  });

  // Version verification
  describe("Version verification (Task 2)", () => {
    it("should extract tag from release event", () => {
      expect(rawContent).toContain("github.event.release.tag_name");
    });

    it("should compare tag version against package.json version", () => {
      const jobs = publishConfig.jobs;
      const allSteps = [];
      for (const job of Object.values(jobs)) {
        if (job.steps) allSteps.push(...job.steps);
      }
      const versionCheck = allSteps.find(
        (s) => s.run && s.run.includes("package.json") && s.run.includes("version")
      );
      expect(versionCheck).toBeDefined();
    });
  });

  // Security constraints
  describe("Security constraints", () => {
    it("should NOT expose NPM_TOKEN directly (use secrets reference)", () => {
      // Token should only appear as secrets.NPM_TOKEN, never as a literal value
      expect(rawContent).not.toMatch(/NPM_TOKEN=['"][^$]/);
    });

    it("should NOT use workflow-level id-token: write (job-level only)", () => {
      const topLevelPerms = publishConfig.permissions || {};
      expect(topLevelPerms["id-token"]).toBeUndefined();
    });
  });
});
