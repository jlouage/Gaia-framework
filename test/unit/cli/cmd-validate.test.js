import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { loadMain } from "../../fixtures/load-helpers.js";

const BIN_DIR = join(import.meta.dirname, "../../../bin");

// ─── AC6: validate happy path — correct args, no eval ─────────────────────

describe("cmd_validate — AC6: happy path", () => {
  it("should pass validate command through to shell script correctly", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "validate", "/target"],
    });

    main();

    expect(mocks.execFileSync).toHaveBeenCalledOnce();
    const [bashPath, args] = mocks.execFileSync.mock.calls[0];
    expect(bashPath).toBe("bash");
    expect(args[0]).toContain("gaia-install.sh");
    expect(args[1]).toBe("validate");
    expect(args[2]).toBe("--source");
    expect(args[3]).toBe("/tmp/gaia-framework-abc123");
    expect(args[4]).toBe("/target");
  });

  it("should NOT use eval anywhere in this test file", () => {
    // AC6 explicitly enforces: NO eval in test code or source under test
    const testSource = readFileSync(import.meta.filename, "utf8");
    const lines = testSource.split("\n");
    const evalLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) return false;
      if (trimmed.startsWith("*")) return false;
      if (trimmed.includes('"eval') || trimmed.includes("'eval")) return false;
      if (trimmed.includes("/\\beval") || trimmed.includes("match(")) return false;
      return /\beval\s*\(/.test(trimmed);
    });
    expect(evalLines).toEqual([]);
  });

  it("should NOT use eval in the source under test", () => {
    const cliSource = readFileSync(
      join(import.meta.dirname, "../../../bin/gaia-framework.js"),
      "utf8"
    );
    const evalCalls = cliSource.match(/\beval\s*\(/g);
    expect(evalCalls).toBeNull();
  });
});

// ─── AC7: validate with paths containing spaces/special chars ─────────────

describe("cmd_validate — AC7: path with spaces and special characters", () => {
  it("should pass path with spaces correctly without shell injection", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "validate", "/my target dir"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args[4]).toBe("/my target dir");
  });

  it("should pass path with special characters correctly", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "validate", "/path/with$pecial&chars"],
    });

    main();

    const args = mocks.execFileSync.mock.calls[0][1];
    expect(args[4]).toBe("/path/with$pecial&chars");
  });

  it("should use execFileSync (not execSync) for command execution to prevent injection", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "validate", "/target"],
    });

    main();

    expect(mocks.execFileSync).toHaveBeenCalledOnce();
  });
});

// ─── AC6 extended: validate error paths ───────────────────────────────────

describe("cmd_validate — error paths", () => {
  it("should exit non-zero when clone fails during validate", () => {
    const { main, mocks } = loadMain(BIN_DIR, {
      argv: ["node", "gaia-framework", "validate", "/target"],
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
