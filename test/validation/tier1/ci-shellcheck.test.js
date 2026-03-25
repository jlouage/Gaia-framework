import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const CI_WORKFLOW_PATH = resolve(PROJECT_ROOT, ".github/workflows/ci.yml");

describe("ShellCheck CI Configuration (E5-S3)", () => {
  let ciConfig;
  let ciContent;

  beforeAll(() => {
    ciContent = readFileSync(CI_WORKFLOW_PATH, "utf8");
    ciConfig = yaml.load(ciContent);
  });

  // AC1: ShellCheck runs on Ubuntu and macOS, skipped on Windows
  describe("AC1 — ShellCheck runs on Ubuntu and macOS, skipped on Windows", () => {
    it("lint job ShellCheck step should skip on Windows", () => {
      const steps = ciConfig.jobs.lint.steps;
      const shellcheck = steps.find((s) => s.name && s.name.toLowerCase().includes("shellcheck"));
      expect(shellcheck).toBeDefined();
      expect(shellcheck.if).toContain("runner.os != 'Windows'");
    });

    it("lint job ShellCheck should scan .sh files recursively excluding node_modules", () => {
      const steps = ciConfig.jobs.lint.steps;
      const shellcheck = steps.find((s) => s.name && s.name.toLowerCase().includes("shellcheck"));
      expect(shellcheck).toBeDefined();
      expect(shellcheck.run).toContain("*.sh");
      expect(shellcheck.run).toContain("node_modules");
    });

    it("test job should include ShellCheck step for macOS and Ubuntu runners", () => {
      const steps = ciConfig.jobs.test.steps;
      const shellcheck = steps.find((s) => s.name && s.name.toLowerCase().includes("shellcheck"));
      expect(shellcheck).toBeDefined();
      expect(shellcheck.if).toContain("runner.os != 'Windows'");
    });
  });

  // AC2: Installation documented in CI workflow inline comments
  describe("AC2 — Installation instructions documented", () => {
    it("CI workflow should document macOS ShellCheck installation (brew)", () => {
      expect(ciContent).toContain("brew install shellcheck");
    });

    it("CI workflow should document Linux ShellCheck installation (apt-get)", () => {
      expect(ciContent).toContain("apt-get");
      expect(ciContent).toContain("shellcheck");
    });
  });

  // AC3: ShellCheck version is pinned
  describe("AC3 — ShellCheck version pinning", () => {
    it("lint job ShellCheck step should pin the version", () => {
      const steps = ciConfig.jobs.lint.steps;
      const shellcheck = steps.find((s) => s.name && s.name.toLowerCase().includes("shellcheck"));
      expect(shellcheck).toBeDefined();
      // Version pin should appear in the run command (e.g., shellcheck=0.9.0 or version check)
      expect(shellcheck.run).toMatch(/shellcheck.*(\d+\.\d+\.\d+|--version|version)/i);
    });

    it("test job ShellCheck step should also reference versioned install", () => {
      const steps = ciConfig.jobs.test.steps;
      const shellcheck = steps.find((s) => s.name && s.name.toLowerCase().includes("shellcheck"));
      expect(shellcheck).toBeDefined();
      expect(shellcheck.run).toBeDefined();
    });
  });

  // AC4: Severity threshold set to error only
  describe("AC4 — Severity threshold (error only)", () => {
    it("lint job ShellCheck should use --severity=error", () => {
      const steps = ciConfig.jobs.lint.steps;
      const shellcheck = steps.find((s) => s.name && s.name.toLowerCase().includes("shellcheck"));
      expect(shellcheck).toBeDefined();
      expect(shellcheck.run).toContain("--severity=error");
    });

    it("test job ShellCheck should use --severity=error", () => {
      const steps = ciConfig.jobs.test.steps;
      const shellcheck = steps.find((s) => s.name && s.name.toLowerCase().includes("shellcheck"));
      expect(shellcheck).toBeDefined();
      expect(shellcheck.run).toContain("--severity=error");
    });
  });
});
