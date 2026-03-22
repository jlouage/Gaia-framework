import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// gaia-framework.js uses CJS require() — we need to load it carefully.
// For unit tests, we extract and test the logic directly.

const SOURCE_PATH = join(import.meta.dirname, "../../../bin/gaia-framework.js");

describe("findBash", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    vi.restoreAllMocks();
  });

  it("should return 'bash' on non-Windows platforms", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });

    const { findBash } = await loadHelpers();
    expect(findBash()).toBe("bash");
  });

  it("should return 'bash' on linux", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });

    const { findBash } = await loadHelpers();
    expect(findBash()).toBe("bash");
  });

  it("should return 'bash' on Windows when bash is in PATH", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });

    const mockExecSync = vi.fn(); // succeeds (no throw)
    const { findBash } = await loadHelpers({
      execSync: mockExecSync,
    });

    expect(findBash()).toBe("bash");
    expect(mockExecSync).toHaveBeenCalledWith("bash --version", { stdio: "ignore" });
  });

  it("should find Git for Windows bash when PATH bash unavailable", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });

    const mockExecSync = vi.fn(() => { throw new Error("not found"); });
    // join() uses the host OS separator, so on macOS the path uses /
    const expectedPath = join("C:\\Program Files", "Git", "bin", "bash.exe");
    const mockExistsSync = vi.fn((p) => p === expectedPath);

    const { findBash } = await loadHelpers({
      execSync: mockExecSync,
      existsSync: mockExistsSync,
      env: {
        ProgramFiles: "C:\\Program Files",
        "ProgramFiles(x86)": "C:\\Program Files (x86)",
        LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
      },
    });

    expect(findBash()).toBe(expectedPath);
  });

  it("should return null on Windows when no bash is available", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });

    const mockExecSync = vi.fn(() => { throw new Error("not found"); });
    const mockExistsSync = vi.fn(() => false);

    const { findBash } = await loadHelpers({
      execSync: mockExecSync,
      existsSync: mockExistsSync,
      env: {
        ProgramFiles: "C:\\Program Files",
        "ProgramFiles(x86)": "C:\\Program Files (x86)",
        LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
      },
    });

    expect(findBash()).toBe(null);
  });

  it("should use default paths when Windows env vars are absent", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });

    const mockExecSync = vi.fn(() => { throw new Error("not found"); });
    const calledPaths = [];
    const mockExistsSync = vi.fn((p) => { calledPaths.push(p); return false; });

    const { findBash } = await loadHelpers({
      execSync: mockExecSync,
      existsSync: mockExistsSync,
      env: {},
    });

    findBash();

    // When env vars are empty, should fall back to default paths
    expect(calledPaths.some(p => p.includes("C:\\Program Files"))).toBe(true);
  });
});

describe("ensureGit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not throw when git is available", async () => {
    const { ensureGit } = await loadHelpers();
    expect(() => ensureGit()).not.toThrow();
  });

  it("should call process.exit(1) when git is not available", async () => {
    const mockExecSync = vi.fn(() => { throw new Error("not found"); });
    const mockExit = vi.fn(() => { throw new Error("exit"); });
    const mockConsole = {
      log: vi.fn(),
      error: vi.fn(),
    };

    const { ensureGit } = await loadHelpers({
      execSync: mockExecSync,
      processExit: mockExit,
      console: mockConsole,
    });

    expect(() => ensureGit()).toThrow("exit");
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsole.error.mock.calls[0][0]).toContain("https://git-scm.com/downloads");
  });
});

describe("showUsage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should output usage text to console", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { showUsage } = await loadHelpers();

    showUsage();

    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain("gaia-framework");
    expect(output).toContain("init");
    expect(output).toContain("update");
    expect(output).toContain("validate");
    expect(output).toContain("status");

    spy.mockRestore();
  });
});

describe("readPackageVersion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return version from a valid package.json", async () => {
    const { readPackageVersion } = await loadHelpers();
    const pkgPath = join(import.meta.dirname, "../../../package.json");
    const result = readPackageVersion(pkgPath);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("should throw for a nonexistent package.json path", async () => {
    const { readPackageVersion } = await loadHelpers();
    expect(() => readPackageVersion("/nonexistent/package.json")).toThrow();
  });
});

/**
 * Helper to load functions from gaia-framework.js.
 * Since the file is a CJS script that calls main() at the bottom,
 * we need to extract functions without triggering main().
 *
 * @param {Object} [mocks] - Optional mock overrides
 * @param {Function} [mocks.execSync] - Mock for child_process.execSync
 * @param {Function} [mocks.existsSync] - Mock for fs.existsSync
 * @param {Object} [mocks.env] - Mock process.env values
 * @param {Function} [mocks.processExit] - Mock for process.exit
 * @param {Object} [mocks.console] - Mock console object
 */
async function loadHelpers(mocks = {}) {
  const source = readFileSync(SOURCE_PATH, "utf8");

  // Create a module scope without executing main()
  const wrappedSource = source
    .replace("main();", "// main() disabled for testing")
    .replace("#!/usr/bin/env node", "");

  const fn = new Function(
    "require",
    "process",
    "console",
    "__dirname",
    "__filename",
    `
    const module = { exports: {} };
    const exports = module.exports;
    ${wrappedSource}
    return { findBash, ensureGit, showUsage, fail, info, cleanup, readPackageVersion };
  `,
  );

  const binDir = join(import.meta.dirname, "../../../bin");

  // Build a custom require that intercepts child_process and fs
  const customRequire = (mod) => {
    if (mod === "child_process" && (mocks.execSync || mocks.execFileSync)) {
      const real = require("child_process");
      return {
        ...real,
        execSync: mocks.execSync || real.execSync,
        execFileSync: mocks.execFileSync || real.execFileSync,
      };
    }
    if (mod === "fs" && mocks.existsSync) {
      const real = require("fs");
      return {
        ...real,
        existsSync: mocks.existsSync,
      };
    }
    return require(mod);
  };
  // Preserve require.resolve for any code that uses it
  customRequire.resolve = require.resolve;

  // Build a custom process with optional overrides
  const customProcess = mocks.processExit || mocks.env
    ? new Proxy(process, {
        get(target, prop) {
          if (prop === "exit" && mocks.processExit) return mocks.processExit;
          if (prop === "env" && mocks.env) return { ...target.env, ...mocks.env };
          return target[prop];
        },
      })
    : process;

  const customConsole = mocks.console || console;

  return fn(
    customRequire,
    customProcess,
    customConsole,
    binDir,
    join(binDir, "gaia-framework.js"),
  );
}
