import { describe, it, expect, vi } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { loadMain } from "../../fixtures/load-helpers.js";

const BIN_DIR = join(import.meta.dirname, "../../../bin");

// ─── AC8: status happy path ───────────────────────────────────────────────

describe("cmd_status — AC8: happy path", () => {
  it("should pass status command through to shell script correctly", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "status", "/target"],
    });

    main();

    expect(mocks.execFileSync).toHaveBeenCalledOnce();
    const [bashPath, args] = mocks.execFileSync.mock.calls[0];
    expect(bashPath).toBe("bash");
    expect(args[0]).toContain("gaia-install.sh");
    expect(args[1]).toBe("status");
    expect(args[2]).toBe("--source");
    expect(args[3]).toBe("/tmp/gaia-framework-abc123");
    expect(args[4]).toBe("/target");
  });

  it("should return exit code from subprocess", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "status", "/target"],
      execFileSync: vi.fn(),
    });

    main();

    // If execFileSync doesn't throw, process.exit is NOT called (success path)
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("should exit with subprocess error code when status command fails", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "status", "/target"],
      execFileSync: vi.fn(() => {
        const err = new Error("subprocess failed");
        err.status = 2;
        throw err;
      }),
    });

    main();

    expect(mocks.exit).toHaveBeenCalledWith(2);
  });
});

// ─── AC8 extended: status clone failure ───────────────────────────────────

describe("cmd_status — clone failure", () => {
  it("should exit non-zero when git clone fails during status", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "status", "/target"],
      execSync: vi.fn((cmd) => {
        if (cmd.startsWith("git clone")) {
          const err = new Error("clone failed");
          err.stderr = Buffer.from("network error");
          throw err;
        }
      }),
    });

    main();

    expect(mocks.exit).toHaveBeenCalledWith(1);
  });
});

// ─── AC12: test file locations ────────────────────────────────────────────

describe("test file locations — AC12", () => {
  const expectedFiles = [
    "test/unit/cli/cmd-init.test.js",
    "test/unit/cli/cmd-update.test.js",
    "test/unit/cli/cmd-validate.test.js",
    "test/unit/cli/cmd-status.test.js",
  ];

  const projectRoot = join(import.meta.dirname, "../../..");

  it.each(expectedFiles)("should have test file: %s", (file) => {
    expect(existsSync(join(projectRoot, file))).toBe(true);
  });
});
