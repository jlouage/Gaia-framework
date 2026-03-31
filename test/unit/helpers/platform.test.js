/**
 * Unit tests for test/helpers/platform.js
 * Cross-platform utility functions (E6-S9)
 *
 * Tests: findExecutable, makeTempDir, findBash, normalizePath
 */

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, statSync } from "fs";

// Import the module under test — will fail until platform.js is created
import { findExecutable, makeTempDir, findBash, normalizePath } from "../../helpers/platform.js";

// Track temp dirs for cleanup
const tempDirs = [];

afterEach(() => {
  const { rmSync } = require("fs");
  for (const dir of tempDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  tempDirs.length = 0;
});

// ─── findExecutable ─────────────────────────────────────────

describe("findExecutable", () => {
  it("should return a string path for an executable that exists (node)", () => {
    const result = findExecutable("node");
    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return null for an executable that does not exist", () => {
    const result = findExecutable("__nonexistent_binary_xyz__");
    expect(result).toBeNull();
  });

  it("should not throw when executable is not found", () => {
    expect(() => findExecutable("__nonexistent_binary_xyz__")).not.toThrow();
  });

  it("should find rsync on macOS/Linux if installed", () => {
    const result = findExecutable("rsync");
    // rsync may or may not be installed — just verify no throw and correct type
    expect(result === null || typeof result === "string").toBe(true);
  });
});

// ─── makeTempDir ────────────────────────────────────────────

describe("makeTempDir", () => {
  it("should create a temporary directory that exists", () => {
    const dir = makeTempDir("gaia-test-");
    tempDirs.push(dir);
    expect(existsSync(dir)).toBe(true);
  });

  it("should return an absolute path", () => {
    const dir = makeTempDir("gaia-test-");
    tempDirs.push(dir);
    // path.isAbsolute check
    expect(dir.startsWith("/") || /^[A-Z]:\\/i.test(dir)).toBe(true);
  });

  it("should create a directory (not a file)", () => {
    const dir = makeTempDir("gaia-test-");
    tempDirs.push(dir);
    expect(statSync(dir).isDirectory()).toBe(true);
  });

  it("should include the prefix in the directory name", () => {
    const dir = makeTempDir("gaia-security-");
    tempDirs.push(dir);
    const dirName = dir.split(/[\\/]/).pop();
    expect(dirName.startsWith("gaia-security-")).toBe(true);
  });
});

// ─── findBash ───────────────────────────────────────────────

describe("findBash", () => {
  it("should return a string path or null", () => {
    const result = findBash();
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("should return a path to an existing file when bash is found", () => {
    const result = findBash();
    if (result !== null) {
      expect(existsSync(result)).toBe(true);
    }
  });

  it("should not throw even if bash is not available", () => {
    expect(() => findBash()).not.toThrow();
  });
});

// ─── normalizePath ──────────────────────────────────────────

describe("normalizePath", () => {
  it("should convert backslashes to forward slashes", () => {
    expect(normalizePath("src\\components\\foo.js")).toBe("src/components/foo.js");
  });

  it("should leave forward slashes unchanged", () => {
    expect(normalizePath("src/components/foo.js")).toBe("src/components/foo.js");
  });

  it("should handle mixed separators", () => {
    expect(normalizePath("src/components\\foo.js")).toBe("src/components/foo.js");
  });

  it("should handle empty string", () => {
    expect(normalizePath("")).toBe("");
  });

  it("should handle Windows drive paths", () => {
    expect(normalizePath("C:\\Users\\test\\file.js")).toBe("C:/Users/test/file.js");
  });
});
