const path = require("path");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const cliPath = path.resolve(__dirname, "../../../bin/gaia-framework.js");

/**
 * Helper: build a mock deps object for main() that captures the git clone command
 * and the args passed to execFileSync (the installer invocation).
 */
function buildMockDeps(processArgs) {
  const calls = { exec: [], execFile: [] };
  return {
    deps: {
      execSync: (cmd, _opts) => {
        calls.exec.push(cmd);
        // git --version check
        if (cmd === "git --version") return;
        // git clone
        if (cmd.startsWith("git clone")) return;
        throw new Error(`Unexpected execSync call: ${cmd}`);
      },
      execFileSync: (bin, args, _opts) => {
        calls.execFile.push({ bin, args });
      },
      existsSync: (p) => {
        // Installer script always "exists" in our mock
        if (p.endsWith("gaia-install.sh")) return true;
        return false;
      },
      join: path.join,
      mkdtempSync: () => "/tmp/gaia-framework-mock",
      tmpdir: () => "/tmp",
      isWindows: false,
      findBash: () => "bash",
    },
    calls,
    setProcessArgs: () => {
      process.argv = ["node", "gaia-framework.js", ...processArgs];
    },
  };
}

describe("CLI --branch flag (E14-S1)", () => {
  let cli;

  beforeEach(() => {
    // Fresh require to avoid module caching issues
    delete require.cache[require.resolve(cliPath)];
    cli = require(cliPath);
  });

  // AC1: --branch staging passes correct flag to installer
  it("should pass --branch <name> to the installer script (AC1)", () => {
    const { deps, calls, setProcessArgs } = buildMockDeps(["init", "--branch", "staging"]);
    setProcessArgs();
    cli.main(deps);

    // The installer should receive --branch staging in its args
    expect(calls.execFile.length).toBe(1);
    const installerArgs = calls.execFile[0].args;
    // Find the position of --branch in the installer args (after the script path)
    const scriptArgs = installerArgs.slice(1); // skip the script path
    const branchIdx = scriptArgs.indexOf("--branch");
    expect(branchIdx).toBeGreaterThanOrEqual(0);
    expect(scriptArgs[branchIdx + 1]).toBe("staging");
  });

  // AC2: --staging is resolved to --branch staging
  it("should resolve --staging to --branch staging (AC2)", () => {
    const { deps, calls, setProcessArgs } = buildMockDeps(["init", "--staging"]);
    setProcessArgs();
    cli.main(deps);

    expect(calls.execFile.length).toBe(1);
    const scriptArgs = calls.execFile[0].args.slice(1);
    const branchIdx = scriptArgs.indexOf("--branch");
    expect(branchIdx).toBeGreaterThanOrEqual(0);
    expect(scriptArgs[branchIdx + 1]).toBe("staging");
    // --staging itself should NOT appear in passthrough (converted to --branch staging)
    expect(scriptArgs).not.toContain("--staging");
  });

  // AC3: gaia-install.sh accepts --branch and uses it in git clone
  // This tests that parse_args in gaia-install.sh will accept --branch
  // We test this indirectly via the JS CLI passing --branch through
  it("should include --branch in passthrough args for the shell installer (AC3)", () => {
    const { deps, calls, setProcessArgs } = buildMockDeps(["update", "--branch", "develop"]);
    setProcessArgs();
    cli.main(deps);

    expect(calls.execFile.length).toBe(1);
    const allArgs = calls.execFile[0].args;
    // The passthrough should contain --branch develop
    expect(allArgs).toContain("--branch");
    const branchIdx = allArgs.indexOf("--branch");
    expect(allArgs[branchIdx + 1]).toBe("develop");
  });

  // AC4: --help output includes both flags
  it("should include --branch and --staging in --help output (AC4)", () => {
    const { showUsage } = cli;
    // Capture console.log output
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    showUsage();

    console.log = origLog;
    const output = logs.join("\n");
    expect(output).toContain("--branch");
    expect(output).toContain("--staging");
  });

  // AC5: Default invocation (no flag) does not include --branch
  it("should not include --branch when no branch flag is provided (AC5)", () => {
    const { deps, calls, setProcessArgs } = buildMockDeps(["init"]);
    setProcessArgs();
    cli.main(deps);

    expect(calls.execFile.length).toBe(1);
    const allArgs = calls.execFile[0].args;
    expect(allArgs).not.toContain("--branch");
    expect(allArgs).not.toContain("--staging");
  });

  // Edge case: --branch without value
  it("should exit with error when --branch is provided without a value", () => {
    const { deps, setProcessArgs } = buildMockDeps(["init", "--branch"]);
    setProcessArgs();

    const origExit = process.exit;
    const origError = console.error;
    let exitCode = null;
    let errorOutput = "";
    process.exit = (code) => {
      exitCode = code;
      throw new Error("process.exit called");
    };
    console.error = (...args) => {
      errorOutput += args.join(" ");
    };

    try {
      cli.main(deps);
    } catch (e) {
      // Expected — process.exit throws
    }

    process.exit = origExit;
    console.error = origError;
    expect(exitCode).toBe(1);
    expect(errorOutput).toContain("--branch");
  });

  // Edge case: --branch and --staging together
  it("should exit with error when both --branch and --staging are provided", () => {
    const { deps, setProcessArgs } = buildMockDeps(["init", "--branch", "foo", "--staging"]);
    setProcessArgs();

    const origExit = process.exit;
    const origError = console.error;
    let exitCode = null;
    let errorOutput = "";
    process.exit = (code) => {
      exitCode = code;
      throw new Error("process.exit called");
    };
    console.error = (...args) => {
      errorOutput += args.join(" ");
    };

    try {
      cli.main(deps);
    } catch (e) {
      // Expected
    }

    process.exit = origExit;
    console.error = origError;
    expect(exitCode).toBe(1);
    expect(errorOutput).toContain("--branch");
    expect(errorOutput).toContain("--staging");
  });
});
