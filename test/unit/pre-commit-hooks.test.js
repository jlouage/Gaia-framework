import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const PROJECT_ROOT = join(import.meta.dirname, "../..");
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, "package.json");
const LINT_STAGED_CONFIG_PATH = join(PROJECT_ROOT, ".lintstagedrc.json");
const HUSKY_DIR = join(PROJECT_ROOT, ".husky");
const PRE_COMMIT_PATH = join(HUSKY_DIR, "pre-commit");

/** Read and parse package.json */
function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
}

/** Read and parse .lintstagedrc.json */
function readLintStagedConfig() {
  return JSON.parse(readFileSync(LINT_STAGED_CONFIG_PATH, "utf-8"));
}

/** Normalize a lint-staged entry to an array of commands */
function toCommandArray(entry) {
  return Array.isArray(entry) ? entry : [entry];
}

describe("Pre-Commit Hooks (E5-S4)", () => {
  describe("AC1: Husky and lint-staged installed as devDependencies", () => {
    it("should have husky in devDependencies", () => {
      expect(readPackageJson().devDependencies).toHaveProperty("husky");
    });

    it("should have lint-staged in devDependencies", () => {
      expect(readPackageJson().devDependencies).toHaveProperty("lint-staged");
    });

    it("should NOT have husky in regular dependencies", () => {
      const deps = readPackageJson().dependencies || {};
      expect(deps).not.toHaveProperty("husky");
    });

    it("should NOT have lint-staged in regular dependencies", () => {
      const deps = readPackageJson().dependencies || {};
      expect(deps).not.toHaveProperty("lint-staged");
    });
  });

  describe("AC2: lint-staged config for .sh files (ShellCheck)", () => {
    it("should have .lintstagedrc.json at project root", () => {
      expect(existsSync(LINT_STAGED_CONFIG_PATH)).toBe(true);
    });

    it("should configure ShellCheck for *.sh files", () => {
      expect(readLintStagedConfig()).toHaveProperty("*.sh");
    });
  });

  describe("AC3: Prepare script disabled (phased rollout)", () => {
    it("should have a prepare script in package.json", () => {
      expect(readPackageJson().scripts).toHaveProperty("prepare");
    });

    it("should NOT run husky in the prepare script", () => {
      const prepare = readPackageJson().scripts.prepare || "";
      expect(prepare).not.toContain("husky install");
      expect(prepare).not.toContain("husky");
    });
  });

  describe("AC5: Pre-commit hook script", () => {
    it("should have .husky directory", () => {
      expect(existsSync(HUSKY_DIR)).toBe(true);
    });

    it("should have .husky/pre-commit file", () => {
      expect(existsSync(PRE_COMMIT_PATH)).toBe(true);
    });

    it("should run npx lint-staged in pre-commit hook", () => {
      const content = readFileSync(PRE_COMMIT_PATH, "utf-8");
      expect(content).toContain("npx lint-staged");
    });

    // Windows does not have Unix-style execute permission bits
    it.skipIf(process.platform === "win32")("should have pre-commit hook be executable", () => {
      const stats = statSync(PRE_COMMIT_PATH);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });
  });

  describe("AC7: ShellCheck missing error handling", () => {
    it("should reference shellcheck-wrapper script for *.sh files", () => {
      const config = readLintStagedConfig();
      const shCommands = toCommandArray(config["*.sh"]);
      const hasWrapper = shCommands.some(
        (cmd) => cmd.includes("shellcheck-wrapper") || cmd.includes("scripts/")
      );
      expect(hasWrapper).toBe(true);
    });
  });

  describe("AC8: Auto-setup on npm install", () => {
    it("should have husky version 9 or higher", () => {
      const huskyVersion = readPackageJson().devDependencies.husky;
      const majorMatch = huskyVersion.match(/(\d+)/);
      expect(majorMatch).not.toBeNull();
      expect(parseInt(majorMatch[1], 10)).toBeGreaterThanOrEqual(9);
    });
  });

  describe("AC9: lint-staged runs only on staged files", () => {
    it("should configure ESLint for *.js files", () => {
      expect(readLintStagedConfig()).toHaveProperty("*.js");
    });

    it("should run ESLint on *.js files", () => {
      const jsCommands = toCommandArray(readLintStagedConfig()["*.js"]);
      expect(jsCommands.some((cmd) => cmd.includes("eslint"))).toBe(true);
    });

    it("should run Prettier on *.js files", () => {
      const jsCommands = toCommandArray(readLintStagedConfig()["*.js"]);
      expect(jsCommands.some((cmd) => cmd.includes("prettier"))).toBe(true);
    });
  });

  describe("Package exclusion", () => {
    it("should NOT include .husky/ in package.json files whitelist", () => {
      const filesField = readPackageJson().files || [];
      expect(filesField.some((e) => e.includes(".husky"))).toBe(false);
    });

    it("should NOT include .lintstagedrc.json in package.json files whitelist", () => {
      const filesField = readPackageJson().files || [];
      expect(filesField.some((e) => e.includes(".lintstagedrc"))).toBe(false);
    });
  });

  describe("CI environment handling (AC8/Task 5)", () => {
    it("should not unconditionally run husky in prepare script", () => {
      const prepare = readPackageJson().scripts.prepare || "";
      expect(prepare).not.toMatch(/^husky$/);
      expect(prepare).not.toMatch(/^husky install$/);
    });
  });

  describe("Dependency budget (ADR-003)", () => {
    it("should keep transitive dependency count within ~400 budget", () => {
      let output;
      try {
        output = execSync("npm ls --all --parseable 2>/dev/null", {
          cwd: PROJECT_ROOT,
          encoding: "utf-8",
          timeout: 30000,
        });
      } catch (err) {
        // npm ls returns non-zero with peer dep warnings but still lists deps
        output = err.stdout || "";
      }
      if (output.trim()) {
        const depCount = output.trim().split("\n").length;
        expect(depCount).toBeLessThanOrEqual(450);
      }
    });
  });
});
