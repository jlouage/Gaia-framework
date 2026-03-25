import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const CI_WORKFLOW_PATH = resolve(
  PROJECT_ROOT,
  ".github/workflows/ci.yml",
);
const AUDIT_ALLOWLIST_PATH = resolve(PROJECT_ROOT, "audit-allowlist.json");
const WINDOWS_VALIDATE_PATH = resolve(
  PROJECT_ROOT,
  "test/shell/windows-validate.sh",
);

describe("CI Workflow Validation (E4-S1)", () => {
  let ciConfig;

  beforeAll(() => {
    const content = readFileSync(CI_WORKFLOW_PATH, "utf8");
    ciConfig = yaml.load(content);
  });

  // AC1: Workflow triggers
  describe("AC1 — Workflow triggers and structure", () => {
    it("ci.yml file should exist", () => {
      expect(existsSync(CI_WORKFLOW_PATH)).toBe(true);
    });

    it("should trigger on pull_request with correct event types", () => {
      const pr = ciConfig.on.pull_request;
      expect(pr).toBeDefined();
      expect(pr.types).toEqual(
        expect.arrayContaining([
          "opened",
          "synchronize",
          "reopened",
          "ready_for_review",
        ]),
      );
    });

    it("should trigger on push to main", () => {
      const push = ciConfig.on.push;
      expect(push).toBeDefined();
      expect(push.branches).toContain("main");
    });

    it("should declare explicit permissions", () => {
      expect(ciConfig.permissions).toBeDefined();
      expect(ciConfig.permissions.contents).toBe("read");
      expect(ciConfig.permissions.checks).toBe("write");
    });

    it("should have exactly 4 jobs: lint, test, security, package", () => {
      const jobNames = Object.keys(ciConfig.jobs).sort();
      expect(jobNames).toEqual(["lint", "package", "security", "test"]);
    });
  });

  // AC2: Lint job
  describe("AC2 — Lint job configuration", () => {
    it("lint job should run on ubuntu-latest", () => {
      expect(ciConfig.jobs.lint["runs-on"]).toBe("ubuntu-latest");
    });

    it("lint job should use setup-node@v4 with node 20 and npm cache", () => {
      const steps = ciConfig.jobs.lint.steps;
      const setupNode = steps.find(
        (s) => s.uses && s.uses.startsWith("actions/setup-node@v4"),
      );
      expect(setupNode).toBeDefined();
      expect(setupNode.with["node-version"]).toBe(20);
      expect(setupNode.with.cache).toBe("npm");
    });

    it("lint job should include npm ci step", () => {
      const steps = ciConfig.jobs.lint.steps;
      const npmCi = steps.find((s) => s.run && s.run.includes("npm ci"));
      expect(npmCi).toBeDefined();
    });

    it("lint job should include ESLint step", () => {
      const steps = ciConfig.jobs.lint.steps;
      const eslint = steps.find(
        (s) => s.name && s.name.toLowerCase().includes("eslint"),
      );
      expect(eslint).toBeDefined();
    });

    it("lint job should include Prettier --check step", () => {
      const steps = ciConfig.jobs.lint.steps;
      const prettier = steps.find(
        (s) => s.run && s.run.includes("prettier") && s.run.includes("--check"),
      );
      expect(prettier).toBeDefined();
    });

    it("lint job should include ShellCheck step with Windows skip", () => {
      const steps = ciConfig.jobs.lint.steps;
      const shellcheck = steps.find(
        (s) => s.name && s.name.toLowerCase().includes("shellcheck"),
      );
      expect(shellcheck).toBeDefined();
      expect(shellcheck.if).toContain("runner.os != 'Windows'");
    });
  });

  // AC3: Test job with matrix
  describe("AC3 — Test job matrix configuration", () => {
    it("test job should depend on lint", () => {
      expect(ciConfig.jobs.test.needs).toContain("lint");
    });

    it("test job should use OS matrix with 3 platforms", () => {
      const matrix = ciConfig.jobs.test.strategy.matrix;
      expect(matrix.os).toEqual(
        expect.arrayContaining([
          "ubuntu-latest",
          "macos-latest",
          "windows-latest",
        ]),
      );
    });

    it("test job should set fail-fast to false", () => {
      expect(ciConfig.jobs.test.strategy["fail-fast"]).toBe(false);
    });

    it("test job should set continue-on-error for Windows", () => {
      const continueOnError = ciConfig.jobs.test["continue-on-error"];
      expect(continueOnError).toBeDefined();
      // Should reference matrix.os == 'windows-latest'
      expect(String(continueOnError)).toContain("windows-latest");
    });

    it("test job should include Vitest step", () => {
      const steps = ciConfig.jobs.test.steps;
      const vitest = steps.find(
        (s) => s.run && s.run.includes("npm test"),
      );
      expect(vitest).toBeDefined();
    });

    it("test job should include BATS setup with Windows skip", () => {
      const steps = ciConfig.jobs.test.steps;
      const batsSetup = steps.find(
        (s) => s.name && s.name.toLowerCase().includes("bats") && s.name.toLowerCase().includes("setup"),
      );
      expect(batsSetup).toBeDefined();
      expect(batsSetup.if).toContain("runner.os != 'Windows'");
    });

    it("test job should include BATS run with Windows skip", () => {
      const steps = ciConfig.jobs.test.steps;
      const batsRun = steps.find(
        (s) =>
          s.run &&
          s.run.includes("test:shell") &&
          s.if &&
          s.if.includes("runner.os != 'Windows'"),
      );
      expect(batsRun).toBeDefined();
    });

    it("test job should include Windows validation step", () => {
      const steps = ciConfig.jobs.test.steps;
      const winValidate = steps.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes("windows") &&
          s.if &&
          s.if.includes("runner.os == 'Windows'"),
      );
      expect(winValidate).toBeDefined();
    });
  });

  // AC4: Security job
  describe("AC4 — Security job configuration", () => {
    it("security job should run on ubuntu-latest", () => {
      expect(ciConfig.jobs.security["runs-on"]).toBe("ubuntu-latest");
    });

    it("security job should NOT depend on lint or test (runs in parallel)", () => {
      const needs = ciConfig.jobs.security.needs;
      expect(needs).toBeUndefined();
    });

    it("security job should include hard gate npm audit step (production deps)", () => {
      const steps = ciConfig.jobs.security.steps;
      const hardAudit = steps.find(
        (s) =>
          s.run &&
          s.run.includes("npm audit") &&
          s.run.includes("--omit=dev") &&
          s.run.includes("--audit-level=moderate"),
      );
      expect(hardAudit).toBeDefined();
    });

    it("security job should include informational dev audit step", () => {
      const steps = ciConfig.jobs.security.steps;
      const softAudit = steps.find(
        (s) =>
          s.run &&
          s.run.includes("npm audit") &&
          s.run.includes("--audit-level=high") &&
          s.run.includes("|| true"),
      );
      expect(softAudit).toBeDefined();
    });
  });

  // AC5: Package job
  describe("AC5 — Package validation job", () => {
    it("package job should run on ubuntu-latest", () => {
      expect(ciConfig.jobs.package["runs-on"]).toBe("ubuntu-latest");
    });

    it("package job should depend on test", () => {
      expect(ciConfig.jobs.package.needs).toContain("test");
    });

    it("package job should include npm pack --dry-run step", () => {
      const steps = ciConfig.jobs.package.steps;
      const packStep = steps.find(
        (s) => s.run && s.run.includes("npm pack --dry-run"),
      );
      expect(packStep).toBeDefined();
    });

    it("package job should check for excluded paths (test/, .github/)", () => {
      const steps = ciConfig.jobs.package.steps;
      const packStepRuns = steps.map((s) => s.run || "").join("\n");
      expect(packStepRuns).toContain("test/");
      expect(packStepRuns).toContain(".github/");
    });

    it("package job should include dep count check with warning annotation", () => {
      const steps = ciConfig.jobs.package.steps;
      const depCheck = steps.find(
        (s) => s.run && s.run.includes("::warning::"),
      );
      expect(depCheck).toBeDefined();
    });
  });

  // AC6: Coverage upload
  describe("AC6 — Coverage upload", () => {
    it("test job should upload coverage artifact only on ubuntu", () => {
      const steps = ciConfig.jobs.test.steps;
      const coverageUpload = steps.find(
        (s) =>
          s.uses &&
          s.uses.startsWith("actions/upload-artifact@v4"),
      );
      expect(coverageUpload).toBeDefined();
      expect(coverageUpload.if).toContain("ubuntu-latest");
    });

    it("coverage artifact should be named coverage-report", () => {
      const steps = ciConfig.jobs.test.steps;
      const coverageUpload = steps.find(
        (s) =>
          s.uses &&
          s.uses.startsWith("actions/upload-artifact@v4"),
      );
      expect(coverageUpload.with.name).toBe("coverage-report");
    });
  });

  // Security constraints
  describe("Security constraints", () => {
    it("should NOT contain NPM_TOKEN", () => {
      const content = readFileSync(CI_WORKFLOW_PATH, "utf8");
      expect(content).not.toContain("NPM_TOKEN");
    });

    it("should NOT use pull_request_target trigger", () => {
      expect(ciConfig.on.pull_request_target).toBeUndefined();
    });
  });
});

describe("Audit Allowlist Validation (E4-S1)", () => {
  it("audit-allowlist.json should exist", () => {
    expect(existsSync(AUDIT_ALLOWLIST_PATH)).toBe(true);
  });

  it("audit-allowlist.json should be valid JSON", () => {
    const content = readFileSync(AUDIT_ALLOWLIST_PATH, "utf8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("audit-allowlist.json should have allowlist array", () => {
    const content = JSON.parse(
      readFileSync(AUDIT_ALLOWLIST_PATH, "utf8"),
    );
    expect(Array.isArray(content.allowlist)).toBe(true);
  });
});

describe("Windows Validate Script (E4-S1)", () => {
  it("windows-validate.sh should exist", () => {
    expect(existsSync(WINDOWS_VALIDATE_PATH)).toBe(true);
  });

  it("windows-validate.sh should have a shebang line", () => {
    const content = readFileSync(WINDOWS_VALIDATE_PATH, "utf8");
    expect(content.startsWith("#!/")).toBe(true);
  });
});
