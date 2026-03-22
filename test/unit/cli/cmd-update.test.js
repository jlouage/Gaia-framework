import { describe, it, expect, vi } from "vitest";
import { join } from "path";
import { loadMain } from "../../fixtures/load-helpers.js";

const BIN_DIR = join(import.meta.dirname, "../../../bin");

// ─── AC5: update happy path ───────────────────────────────────────────────

describe("cmd_update — AC5: happy path", () => {
  it("should call execFileSync with correct args for update command", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "update", "/target"],
    });

    main();

    expect(mocks.execFileSync).toHaveBeenCalledOnce();
    const [bashPath, args, opts] = mocks.execFileSync.mock.calls[0];
    expect(bashPath).toBe("bash");
    expect(args[0]).toContain("gaia-install.sh");
    expect(args[1]).toBe("update");
    expect(args[2]).toBe("--source");
    expect(args[3]).toBe("/tmp/gaia-framework-abc123");
    expect(args[4]).toBe("/target");
  });

  it("should inject --source at index 1 after the command name", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "update", "/target"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args[2]).toBe("--source");
    expect(args[3]).toBe("/tmp/gaia-framework-abc123");
  });

  it("should set GAIA_SOURCE env var to the temp directory", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "update", "/target"],
    });

    main();

    const opts = mocks.execFileSync.mock.calls[0][2];
    expect(opts.env.GAIA_SOURCE).toBe("/tmp/gaia-framework-abc123");
  });
});

// ─── AC5 extended: update with additional flags ───────────────────────────

describe("cmd_update — AC5: flag passthrough", () => {
  it("should pass --dry-run flag through to shell script", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "update", "/target", "--dry-run"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args).toContain("--dry-run");
  });
});

// ─── AC11: clone failure during update ────────────────────────────────────

describe("cmd_update — AC11: clone failure", () => {
  it("should exit non-zero when git clone fails during update", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "update", "/target"],
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
