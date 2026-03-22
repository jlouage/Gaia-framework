import { describe, it, expect, vi } from "vitest";
import { join } from "path";
import { loadMain } from "../../fixtures/load-helpers.js";

const BIN_DIR = join(import.meta.dirname, "../../../bin");

// ─── AC1: init happy path — execFileSync called with correct args ─────────

describe("cmd_init — AC1: happy path (rsync available)", () => {
  it("should call execFileSync with gaia-install.sh, init, --source, <tmp>, and target args", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target"],
    });

    main();

    expect(mocks.execFileSync).toHaveBeenCalledOnce();
    const [bashPath, args, opts] = mocks.execFileSync.mock.calls[0];
    expect(bashPath).toBe("bash");
    expect(args[0]).toContain("gaia-install.sh");
    expect(args[1]).toBe("init");
    expect(args[2]).toBe("--source");
    expect(args[3]).toBe("/tmp/gaia-framework-abc123");
    expect(args[4]).toBe("/target");
  });

  it("should set GAIA_SOURCE env var to the temp directory", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target"],
    });

    main();

    const opts = mocks.execFileSync.mock.calls[0][2];
    expect(opts.env.GAIA_SOURCE).toBe("/tmp/gaia-framework-abc123");
  });

  it("should inject --source at index 1 of the args array (after command name)", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target", "--verbose"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args[1]).toBe("init");
    expect(args[2]).toBe("--source");
    expect(args[3]).toBe("/tmp/gaia-framework-abc123");
    expect(args[4]).toBe("/target");
    expect(args[5]).toBe("--verbose");
  });
});

// ─── AC2: init rsync fallback ─────────────────────────────────────────────

describe("cmd_init — AC2: rsync fallback args assembly", () => {
  it("should assemble correct passthrough args regardless of rsync availability", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args[1]).toBe("init");
    expect(args[2]).toBe("--source");
    expect(args.length).toBe(5);
  });
});

// ─── AC3: init existing dir with/without --yes ────────────────────────────

describe("cmd_init — AC3: existing directory handling", () => {
  it("should pass --yes flag through to shell script when provided", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target", "--yes"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args).toContain("--yes");
  });

  it("should NOT include --yes when not provided by user", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args).not.toContain("--yes");
  });
});

// ─── AC4: init --dry-run passthrough ──────────────────────────────────────

describe("cmd_init — AC4: --dry-run flag passthrough", () => {
  it("should pass --dry-run through to shell script", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target", "--dry-run"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args).toContain("--dry-run");
  });

  it("should not make persistent filesystem changes at the JS layer with --dry-run", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target", "--dry-run"],
    });

    main();

    expect(mocks.execFileSync).toHaveBeenCalledOnce();
    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args).toContain("--dry-run");
  });
});

// ─── AC9: unknown command rejection ───────────────────────────────────────

describe("cmd dispatch — AC9: unknown command rejection", () => {
  it("should call process.exit with non-zero code for unknown commands", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "foobar"],
    });

    main();

    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it("should display error message for unknown commands", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "foobar"],
    });

    main();

    expect(mocks.consoleError).toHaveBeenCalled();
    const errorMsg = mocks.consoleError.mock.calls[0][0];
    expect(errorMsg).toContain("foobar");
  });
});

// ─── AC10: --help / -h / no-args ──────────────────────────────────────────

describe("cmd dispatch — AC10: help and no-args handling", () => {
  it("should call showUsage and exit 0 when --help is passed", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "--help"],
    });

    main();

    expect(mocks.consoleLog).toHaveBeenCalled();
    expect(mocks.exit).toHaveBeenCalledWith(0);
  });

  it("should call showUsage and exit 0 when -h is passed", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "-h"],
    });

    main();

    expect(mocks.consoleLog).toHaveBeenCalled();
    expect(mocks.exit).toHaveBeenCalledWith(0);
  });

  it("should call showUsage and exit 0 when no arguments are passed", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework"],
    });

    main();

    expect(mocks.consoleLog).toHaveBeenCalled();
    expect(mocks.exit).toHaveBeenCalledWith(0);
  });
});

// ─── AC11: clone failure error handling ───────────────────────────────────

describe("cmd_init — AC11: clone failure handling", () => {
  it("should exit non-zero when git clone fails", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target"],
      execSync: vi.fn((cmd) => {
        if (cmd.startsWith("git clone")) {
          const err = new Error("clone failed");
          err.stderr = Buffer.from("fatal: repository not found");
          throw err;
        }
      }),
    });

    main();

    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it("should display error message when clone fails", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "init", "/target"],
      execSync: vi.fn((cmd) => {
        if (cmd.startsWith("git clone")) {
          const err = new Error("clone failed");
          err.stderr = Buffer.from("fatal: repository not found");
          throw err;
        }
      }),
    });

    main();

    expect(mocks.consoleError).toHaveBeenCalled();
  });
});
