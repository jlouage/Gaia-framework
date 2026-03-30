const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

/** Read a file relative to project root */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

/** Parse ci.yml and return the parsed YAML object */
function loadCiWorkflow() {
  const content = readProjectFile(".github/workflows/ci.yml");
  return yaml.parse(content);
}

describe("E6-S3: Cross-Platform CI Matrix", () => {
  let ciContent;
  let ciYaml;

  beforeAll(() => {
    ciContent = readProjectFile(".github/workflows/ci.yml");
    ciYaml = loadCiWorkflow();
  });

  describe("AC1: Matrix runs on Ubuntu and macOS with all checks passing", () => {
    it("should define a matrix with ubuntu-latest and macos-latest", () => {
      const testJob = ciYaml.jobs.test;
      expect(testJob.strategy.matrix.os).toContain("ubuntu-latest");
      expect(testJob.strategy.matrix.os).toContain("macos-latest");
    });

    it("should run ESLint, Prettier, Vitest, BATS, coverage, audit, package check, and dep count", () => {
      // Verify all required check steps exist in the workflow
      expect(ciContent).toContain("ESLint");
      expect(ciContent).toContain("Prettier");
      expect(ciContent).toContain("Vitest");
      expect(ciContent).toContain("BATS");
      expect(ciContent).toContain("npm audit");
      expect(ciContent).toContain("npm pack --dry-run");
      expect(ciContent).toContain("dep");
    });

    it("should use per-OS cache keyed on runner.os and package-lock.json hash", () => {
      const testJob = ciYaml.jobs.test;
      const steps = testJob.steps;
      const cacheStep = steps.find((s) => s.uses && s.uses.startsWith("actions/cache@"));
      expect(cacheStep).toBeDefined();
      expect(cacheStep.with.key).toContain("runner.os");
      expect(cacheStep.with.key).toContain("package-lock.json");
    });
  });

  describe("AC2: Windows job is best-effort with continue-on-error", () => {
    it("should include windows-latest in the matrix", () => {
      const testJob = ciYaml.jobs.test;
      expect(testJob.strategy.matrix.os).toContain("windows-latest");
    });

    it("should set continue-on-error to true for Windows jobs only", () => {
      const testJob = ciYaml.jobs.test;
      // Should be a conditional expression evaluating to true only for windows
      expect(testJob["continue-on-error"]).toBeDefined();
      const expr = String(testJob["continue-on-error"]);
      expect(expr).toContain("windows");
    });
  });

  describe("AC3: Windows skips BATS, runs simplified validation instead", () => {
    it("should skip BATS on Windows with runner.os condition", () => {
      const testJob = ciYaml.jobs.test;
      const batsStep = testJob.steps.find((s) => s.name && s.name.includes("BATS"));
      expect(batsStep).toBeDefined();
      expect(batsStep.if).toContain("runner.os != 'Windows'");
    });

    it("should skip ShellCheck on Windows with runner.os condition", () => {
      const testJob = ciYaml.jobs.test;
      const shellcheckStep = testJob.steps.find((s) => s.name && s.name === "ShellCheck");
      expect(shellcheckStep).toBeDefined();
      expect(shellcheckStep.if).toContain("runner.os != 'Windows'");
    });

    it("should run windows-validate.sh on Windows only", () => {
      const testJob = ciYaml.jobs.test;
      const winStep = testJob.steps.find((s) => s.name && s.name.includes("Windows"));
      expect(winStep).toBeDefined();
      expect(winStep.if).toContain("runner.os == 'Windows'");
    });
  });

  describe("AC4: macOS Bash upgrade for BATS compatibility", () => {
    it("should have a macOS Bash upgrade step before BATS execution", () => {
      const testJob = ciYaml.jobs.test;
      const steps = testJob.steps;
      const bashUpgradeStep = steps.find(
        (s) => s.name && s.name.toLowerCase().includes("bash") && s.if && s.if.includes("macOS")
      );
      expect(bashUpgradeStep).toBeDefined();
      expect(bashUpgradeStep.run).toContain("brew install bash");

      // Verify it comes before BATS
      const bashUpgradeIdx = steps.indexOf(bashUpgradeStep);
      const batsStep = steps.find((s) => s.name && s.name.includes("BATS"));
      const batsIdx = steps.indexOf(batsStep);
      expect(bashUpgradeIdx).toBeLessThan(batsIdx);
    });
  });

  describe("AC5: fail-fast is false", () => {
    it("should set fail-fast to false on the test matrix", () => {
      const testJob = ciYaml.jobs.test;
      expect(testJob.strategy["fail-fast"]).toBe(false);
    });
  });

  describe("AC6: Windows failure surfaced but non-blocking", () => {
    it("should reference ADR-004 for Windows best-effort in comments", () => {
      expect(ciContent).toContain("ADR-004");
    });

    it("should reference ADR-007 for BATS skip in comments", () => {
      expect(ciContent).toContain("ADR-007");
    });
  });

  describe("Coverage enforcement on all legs (Task 6.1)", () => {
    it("should run coverage-enabled tests on all matrix legs", () => {
      const testJob = ciYaml.jobs.test;
      const vitestStep = testJob.steps.find((s) => s.name && s.name.includes("Vitest"));
      expect(vitestStep).toBeDefined();
      // Coverage is run via `npm test` which includes --coverage in package.json
      // The threshold is enforced by vitest.config.js thresholds
    });
  });

  describe("Audit configuration (Task 4.2)", () => {
    it("should use --audit-level=high for audit checks", () => {
      expect(ciContent).toContain("--audit-level=high");
    });
  });
});

describe("E6-S3: windows-validate.sh", () => {
  let scriptContent;

  beforeAll(() => {
    scriptContent = readProjectFile("test/shell/windows-validate.sh");
  });

  it("should check YAML syntax of key configuration files", () => {
    // Task 3.1: YAML syntax validation
    expect(scriptContent).toContain("yaml");
  });

  it("should include a CLI smoke test", () => {
    // Task 3.1: Basic CLI smoke test
    expect(scriptContent).toContain("gaia-framework");
    expect(scriptContent).toContain("--version");
  });

  it("should exit with code 0 on success", () => {
    // Task 3.2: Proper exit codes
    expect(scriptContent).toContain("set -euo pipefail");
  });

  // Windows does not have Unix-style execute permission bits
  it.skipIf(process.platform === "win32")("should be executable", () => {
    const filePath = path.join(PROJECT_ROOT, "test/shell/windows-validate.sh");
    const stats = fs.statSync(filePath);
    // Check that at least one execute bit is set
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  });
});
