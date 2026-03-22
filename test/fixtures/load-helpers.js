import { vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Load main() and helper functions from gaia-framework.js with full mock injection.
 *
 * The CLI (bin/gaia-framework.js) is CJS and calls main() as a side-effect.
 * It cannot be require()'d directly. This function reads the source as text,
 * strips the shebang and main() call, wraps in new Function(...) to extract
 * named functions, and injects mocked require/process/console.
 *
 * @param {string} binDir - Absolute path to the bin/ directory
 * @param {object} mocks - Optional mock overrides
 * @returns {object} Exported functions + mocks object
 */
export function loadMain(binDir, mocks = {}) {
  const source = readFileSync(join(binDir, "gaia-framework.js"), "utf8");

  // Strip shebang but keep main() — we call it explicitly
  const wrappedSource = source.replace("#!/usr/bin/env node", "");
  // Remove the auto-invocation of main() at the bottom
  const cleanedSource = wrappedSource.replace(/^main\(\);?\s*$/m, "");

  const mockExecSync = mocks.execSync || vi.fn();
  const mockExecFileSync = mocks.execFileSync || vi.fn();
  const mockMkdtempSync = mocks.mkdtempSync || vi.fn(() => "/tmp/gaia-framework-abc123");
  const mockRmSync = mocks.rmSync || vi.fn();
  const mockExistsSync = mocks.existsSync || vi.fn(() => true);
  const mockTmpdir = mocks.tmpdir || vi.fn(() => "/tmp");
  const mockJoin = mocks.join || join;

  const mockRequire = (mod) => {
    if (mod === "child_process") return { execSync: mockExecSync, execFileSync: mockExecFileSync };
    if (mod === "fs") return { mkdtempSync: mockMkdtempSync, rmSync: mockRmSync, existsSync: mockExistsSync };
    if (mod === "os") return { tmpdir: mockTmpdir };
    if (mod === "path") return { join: mockJoin };
    if (mod === "../package.json") return { version: "1.0.0-test" };
    throw new Error(`Unexpected require: ${mod}`);
  };

  const mockExit = mocks.exit || vi.fn();
  const mockOn = mocks.on || vi.fn();
  const mockConsoleLog = mocks.consoleLog || vi.fn();
  const mockConsoleError = mocks.consoleError || vi.fn();

  const mockProcess = {
    argv: mocks.argv || ["node", "gaia-framework"],
    platform: mocks.platform || "darwin",
    exit: mockExit,
    on: mockOn,
    env: mocks.env || {},
  };

  const mockConsole = {
    log: mockConsoleLog,
    error: mockConsoleError,
  };

  const fn = new Function(
    "require",
    "process",
    "console",
    "__dirname",
    "__filename",
    `
    const module = { exports: {} };
    const exports = module.exports;
    ${cleanedSource}
    return { main, findBash, ensureGit, showUsage, fail, info, cleanup };
    `,
  );

  const exported = fn(
    mockRequire,
    mockProcess,
    mockConsole,
    binDir,
    join(binDir, "gaia-framework.js"),
  );

  return {
    ...exported,
    mocks: {
      execSync: mockExecSync,
      execFileSync: mockExecFileSync,
      mkdtempSync: mockMkdtempSync,
      rmSync: mockRmSync,
      existsSync: mockExistsSync,
      exit: mockExit,
      on: mockOn,
      consoleLog: mockConsoleLog,
      consoleError: mockConsoleError,
      process: mockProcess,
    },
  };
}
