import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const CI_WORKFLOW_PATH = resolve(PROJECT_ROOT, ".github/workflows/ci.yml");
const DEP_BUDGET_SCRIPT_PATH = resolve(PROJECT_ROOT, "scripts/check-dep-budget.sh");

describe("Supply Chain Management (E4-S4)", () => {
  let ciConfig;
  let ciRaw;

  beforeAll(() => {
    ciRaw = readFileSync(CI_WORKFLOW_PATH, "utf8");
    ciConfig = yaml.load(ciRaw);
  });

  // AC1: package-lock.json tracked in git
  describe("AC1 — Lock file tracking", () => {
    it("package-lock.json should exist", () => {
      const lockPath = resolve(PROJECT_ROOT, "package-lock.json");
      expect(existsSync(lockPath)).toBe(true);
    });

    it("package-lock.json should NOT be in .gitignore", () => {
      const gitignorePath = resolve(PROJECT_ROOT, ".gitignore");
      if (existsSync(gitignorePath)) {
        const gitignore = readFileSync(gitignorePath, "utf8");
        expect(gitignore).not.toMatch(/^package-lock\.json$/m);
      }
    });

    it("CI should detect lock-file-only changes (PR annotation step)", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const lockCheck = securitySteps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("lock") &&
          (s.run || "").includes("package-lock.json")
      );
      expect(lockCheck).toBeDefined();
    });
  });

  // AC2: npm ci with deterministic builds
  describe("AC2 — Deterministic npm ci", () => {
    it("all jobs should use npm ci (not npm install)", () => {
      for (const [jobName, job] of Object.entries(ciConfig.jobs)) {
        const steps = job.steps || [];
        const installStep = steps.find((s) => s.run && /npm (ci|install)/.test(s.run));
        if (installStep) {
          expect(installStep.run, `Job '${jobName}' should use npm ci`).toContain("npm ci");
          expect(installStep.run, `Job '${jobName}' should not use npm install`).not.toMatch(
            /npm install(?!\s*#)/
          );
        }
      }
    });

    it("setup-node should use npm cache", () => {
      for (const [, job] of Object.entries(ciConfig.jobs)) {
        const setupNode = (job.steps || []).find(
          (s) => s.uses && s.uses.startsWith("actions/setup-node")
        );
        if (setupNode) {
          expect(setupNode.with.cache).toBe("npm");
        }
      }
    });
  });

  // AC3: Production audit hard gate
  describe("AC3 — Production audit hard gate", () => {
    it("should run npm audit --omit=dev without --audit-level (any finding fails)", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const prodAudit = securitySteps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("production") &&
          s.run &&
          s.run.includes("--omit=dev")
      );
      expect(prodAudit).toBeDefined();
      // Should NOT have --audit-level flag — any finding must fail
      expect(prodAudit.run).not.toContain("--audit-level");
    });

    it("production audit step should have a timeout", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const prodAudit = securitySteps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("production") &&
          s.run &&
          s.run.includes("--omit=dev")
      );
      expect(prodAudit).toBeDefined();
      expect(prodAudit["timeout-minutes"]).toBeDefined();
      expect(prodAudit["timeout-minutes"]).toBeGreaterThan(0);
    });

    it("production audit should NOT use || true (hard gate)", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const prodAudit = securitySteps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("production") &&
          s.run &&
          s.run.includes("--omit=dev")
      );
      expect(prodAudit).toBeDefined();
      expect(prodAudit.run).not.toContain("|| true");
    });
  });

  // AC4: Dev audit soft gate with CRITICAL annotation
  describe("AC4 — Dev audit soft gate with CRITICAL annotation", () => {
    it("dev audit step should use continue-on-error: true", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const devAudit = securitySteps.find(
        (s) =>
          s.name && s.name.toLowerCase().includes("dev") && s.name.toLowerCase().includes("audit")
      );
      expect(devAudit).toBeDefined();
      expect(devAudit["continue-on-error"]).toBe(true);
    });

    it("dev audit step should capture output and check for CRITICAL severity", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const devAudit = securitySteps.find(
        (s) =>
          s.name && s.name.toLowerCase().includes("dev") && s.name.toLowerCase().includes("audit")
      );
      expect(devAudit).toBeDefined();
      // Must parse for CRITICAL/critical severity and create annotation
      expect(devAudit.run).toMatch(/critical/i);
      expect(devAudit.run).toContain("::warning::");
    });
  });

  // AC5: Transitive dependency budget check
  describe("AC5 — Dependency budget check", () => {
    it("scripts/check-dep-budget.sh should exist", () => {
      expect(existsSync(DEP_BUDGET_SCRIPT_PATH)).toBe(true);
    });

    it("check-dep-budget.sh should have a shebang line", () => {
      const content = readFileSync(DEP_BUDGET_SCRIPT_PATH, "utf8");
      expect(content.startsWith("#!/")).toBe(true);
    });

    it("check-dep-budget.sh should use npm ls --all --parseable for counting", () => {
      const content = readFileSync(DEP_BUDGET_SCRIPT_PATH, "utf8");
      expect(content).toContain("npm ls --all --parseable");
    });

    it("check-dep-budget.sh should define three tiers: pass (<=400), warn (401-420), fail (>420)", () => {
      const content = readFileSync(DEP_BUDGET_SCRIPT_PATH, "utf8");
      expect(content).toContain("400");
      expect(content).toContain("420");
    });

    it("check-dep-budget.sh should output GitHub Actions annotations", () => {
      const content = readFileSync(DEP_BUDGET_SCRIPT_PATH, "utf8");
      expect(content).toContain("::warning::");
      expect(content).toContain("::error::");
    });

    it("CI should have a dependency budget step in security job", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const budgetStep = securitySteps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("budget") &&
          s.run &&
          s.run.includes("check-dep-budget")
      );
      expect(budgetStep).toBeDefined();
    });

    it("dependency budget step should use continue-on-error: true (soft gate)", () => {
      const securitySteps = ciConfig.jobs.security.steps;
      const budgetStep = securitySteps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("budget") &&
          s.run &&
          s.run.includes("check-dep-budget")
      );
      expect(budgetStep).toBeDefined();
      expect(budgetStep["continue-on-error"]).toBe(true);
    });
  });
});
