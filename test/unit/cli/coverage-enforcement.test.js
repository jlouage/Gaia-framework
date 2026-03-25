const { readFileSync, writeFileSync, rmSync } = require("fs");
const path = require("path");
const os = require("os");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const VITEST_CONFIG_PATH = path.join(PROJECT_ROOT, "vitest.config.js");
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, "package.json");
const GITIGNORE_PATH = path.join(PROJECT_ROOT, ".gitignore");
const CLI_PATH = path.join(PROJECT_ROOT, "bin", "gaia-framework.js");

/**
 * Run a function with mocked process globals, auto-restoring after.
 * Returns { exitCode, stdout, stderr } captured during execution.
 */
function withMockedGlobals(argv, fn) {
  const saved = {
    argv: process.argv,
    log: console.log,
    error: console.error,
    exit: process.exit,
    on: process.on,
  };
  let exitCode = null;
  let stdout = "";
  let stderr = "";

  process.argv = argv;
  console.log = (msg) => {
    stdout += msg;
  };
  console.error = (msg) => {
    stderr += msg;
  };
  process.exit = (code) => {
    exitCode = code;
    throw new Error("exit");
  };
  process.on = () => {};

  try {
    fn();
  } catch (e) {
    // Expected — process.exit throws
  }

  process.argv = saved.argv;
  console.log = saved.log;
  console.error = saved.error;
  process.exit = saved.exit;
  process.on = saved.on;

  return { exitCode, stdout, stderr };
}

describe("E3-S6: Code Coverage Enforcement", () => {
  describe("AC1: Coverage threshold configuration", () => {
    it("should have thresholds.lines set to 80 in vitest.config.js", () => {
      const configSource = readFileSync(VITEST_CONFIG_PATH, "utf8");
      // Match lines: 80 (not lines: 0)
      expect(configSource).toMatch(/lines:\s*80/);
    });

    it("should keep branches, functions, statements thresholds at 0", () => {
      const configSource = readFileSync(VITEST_CONFIG_PATH, "utf8");
      expect(configSource).toMatch(/branches:\s*0/);
      expect(configSource).toMatch(/functions:\s*0/);
      expect(configSource).toMatch(/statements:\s*0/);
    });

    it("should use v8 coverage provider", () => {
      const configSource = readFileSync(VITEST_CONFIG_PATH, "utf8");
      expect(configSource).toMatch(/provider:\s*['"]v8['"]/);
    });

    it("should scope coverage to bin/**/*.js", () => {
      const configSource = readFileSync(VITEST_CONFIG_PATH, "utf8");
      expect(configSource).toContain("bin/**/*.js");
    });
  });

  describe("AC2: npm test includes coverage", () => {
    it("should have test script that includes --coverage flag", () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
      expect(pkg.scripts.test).toContain("--coverage");
    });

    it("should have @vitest/coverage-v8 in devDependencies", () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
      expect(pkg.devDependencies).toHaveProperty("@vitest/coverage-v8");
    });
  });

  describe("AC2: Coverage reporters", () => {
    it("should have text, lcov, and json-summary reporters", () => {
      const configSource = readFileSync(VITEST_CONFIG_PATH, "utf8");
      expect(configSource).toContain("text");
      expect(configSource).toContain("lcov");
      expect(configSource).toContain("json-summary");
    });
  });

  describe("AC5: gitignore coverage directory", () => {
    it("should exclude coverage/ from version control", () => {
      const gitignore = readFileSync(GITIGNORE_PATH, "utf8");
      expect(gitignore).toMatch(/^coverage\/$/m);
    });
  });

  describe("Testability: module.exports for V8 coverage", () => {
    it("should export functions via module.exports for testability", () => {
      const source = readFileSync(CLI_PATH, "utf8");
      expect(source).toContain("module.exports");
    });

    it("should guard main() with require.main check", () => {
      const source = readFileSync(CLI_PATH, "utf8");
      expect(source).toMatch(/require\.main\s*===\s*module/);
    });

    it("should be requireable without auto-executing main()", () => {
      // Clear require cache to get fresh module
      delete require.cache[require.resolve(CLI_PATH)];
      const mod = require(CLI_PATH);
      expect(mod).toHaveProperty("findBash");
      expect(mod).toHaveProperty("ensureGit");
      expect(mod).toHaveProperty("cleanup");
      expect(mod).toHaveProperty("showUsage");
      expect(mod).toHaveProperty("fail");
      expect(mod).toHaveProperty("info");
      expect(mod).toHaveProperty("readPackageVersion");
      expect(typeof mod.findBash).toBe("function");
    });
  });

  describe("V8 coverage: exercising exported functions via require()", () => {
    let mod;

    beforeAll(() => {
      delete require.cache[require.resolve(CLI_PATH)];
      mod = require(CLI_PATH);
    });

    it("findBash returns 'bash' on non-Windows", () => {
      // On macOS/Linux, findBash() returns "bash" immediately
      expect(mod.findBash()).toBe("bash");
    });

    it("ensureGit does not throw when git is available", () => {
      expect(() => mod.ensureGit()).not.toThrow();
    });

    it("showUsage outputs usage text", () => {
      const originalLog = console.log;
      let output = "";
      console.log = (msg) => {
        output += msg;
      };
      mod.showUsage();
      console.log = originalLog;
      expect(output).toContain("gaia-framework");
      expect(output).toContain("init");
      expect(output).toContain("update");
    });

    it("info outputs formatted info message", () => {
      const originalLog = console.log;
      let output = "";
      console.log = (msg) => {
        output += msg;
      };
      mod.info("test message");
      console.log = originalLog;
      expect(output).toContain("test message");
    });

    it("cleanup does not throw when no temp dir exists", () => {
      expect(() => mod.cleanup()).not.toThrow();
    });

    it("readPackageVersion returns a valid version", () => {
      const version = mod.readPackageVersion(PACKAGE_JSON_PATH);
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it("readPackageVersion throws for nonexistent file", () => {
      expect(() => mod.readPackageVersion("/nonexistent/package.json")).toThrow();
    });

    it("fail outputs error message and calls process.exit(1)", () => {
      const { exitCode, stderr } = withMockedGlobals(["node", "x"], () => mod.fail("test error"));
      expect(stderr).toContain("test error");
      expect(exitCode).toBe(1);
    });

    it("main shows usage and exits 0 when no args", () => {
      const { exitCode, stdout } = withMockedGlobals(["node", "gaia-framework.js"], () =>
        mod.main()
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("gaia-framework");
    });

    it("main shows usage when --help flag is passed", () => {
      const { exitCode } = withMockedGlobals(["node", "gaia-framework.js", "--help"], () =>
        mod.main()
      );
      expect(exitCode).toBe(0);
    });

    it("main shows version when --version flag is passed", () => {
      const { exitCode, stdout } = withMockedGlobals(
        ["node", "gaia-framework.js", "--version"],
        () => mod.main()
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("gaia-framework v");
    });

    it("main rejects unknown commands", () => {
      const { exitCode, stderr } = withMockedGlobals(
        ["node", "gaia-framework.js", "badcommand"],
        () => mod.main()
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown command");
    });

    it("main with -v flag shows version and exits", () => {
      const { exitCode, stdout } = withMockedGlobals(["node", "gaia-framework.js", "-v"], () =>
        mod.main()
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("gaia-framework v");
    });

    it("main with -h flag shows usage and exits", () => {
      const { exitCode } = withMockedGlobals(["node", "gaia-framework.js", "-h"], () => mod.main());
      expect(exitCode).toBe(0);
    });

    it("cleanup is a no-op when tempDir is null", () => {
      // cleanup() checks the module-level tempDir variable, which is null
      expect(() => mod.cleanup()).not.toThrow();
    });

    it("readPackageVersion throws for file without version field", () => {
      const tmpFile = path.join(os.tmpdir(), "gaia-test-no-version.json");
      writeFileSync(tmpFile, '{"name": "test"}');
      try {
        expect(() => mod.readPackageVersion(tmpFile)).toThrow("No version field");
      } finally {
        rmSync(tmpFile);
      }
    });
  });

  describe("V8 coverage: exercising main() body with injected deps", () => {
    const mockDeps = (overrides = {}) => ({
      execSync: () => {},
      execFileSync: () => {},
      mkdtempSync: () => "/tmp/gaia-framework-mock",
      existsSync: () => true,
      join: path.join,
      tmpdir: () => "/tmp",
      ...overrides,
    });

    let mod;
    beforeAll(() => {
      delete require.cache[require.resolve(CLI_PATH)];
      mod = require(CLI_PATH);
    });

    it("init exercises clone-through-exec flow", () => {
      // Exercises the full main() body: ensureGit, mkdtempSync, process.on, info, execSync, existsSync, passthrough, findBash, execFileSync
      const { exitCode } = withMockedGlobals(
        ["node", "gaia-framework.js", "init", "/tmp/target"],
        () => mod.main(mockDeps())
      );
      expect(exitCode).toBe(null); // No exit on success
    });

    it("init handles clone failure with stderr", () => {
      const { exitCode, stderr } = withMockedGlobals(
        ["node", "gaia-framework.js", "init", "/tmp/target"],
        () =>
          mod.main(
            mockDeps({
              execSync: () => {
                const err = new Error("clone failed");
                err.stderr = Buffer.from("fatal: repo not found");
                throw err;
              },
            })
          )
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Failed to clone");
    });

    it("init handles clone failure without stderr", () => {
      const { stderr } = withMockedGlobals(["node", "gaia-framework.js", "init", "."], () =>
        mod.main(
          mockDeps({
            execSync: () => {
              throw new Error("network error");
            },
          })
        )
      );
      expect(stderr).toContain("Check your network connection");
    });

    it("init handles missing installer script", () => {
      const { exitCode, stderr } = withMockedGlobals(
        ["node", "gaia-framework.js", "init", "/tmp/target"],
        () => mod.main(mockDeps({ existsSync: () => false }))
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Installer script not found");
    });

    it("init handles execFileSync failure with status code", () => {
      const { exitCode } = withMockedGlobals(
        ["node", "gaia-framework.js", "init", "/tmp/target"],
        () =>
          mod.main(
            mockDeps({
              execFileSync: () => {
                const err = new Error("failed");
                err.status = 42;
                throw err;
              },
            })
          )
      );
      expect(exitCode).toBe(42);
    });

    it("update command exercises full flow", () => {
      const { exitCode } = withMockedGlobals(["node", "gaia-framework.js", "update", "."], () =>
        mod.main(mockDeps())
      );
      // No exit called on success
      expect(exitCode).toBe(null);
    });
  });
});
