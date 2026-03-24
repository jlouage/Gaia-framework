/**
 * Sync Check Test
 *
 * Runs sync-check.js as a Vitest test so fixture drift is caught in CI.
 * Validates that mock-framework/ mirrors the real framework's key structural paths.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const SYNC_CHECK_PATH = resolve(import.meta.dirname, "sync-check.js");

describe("Fixture sync check", () => {
  it("should pass when mock-framework matches real framework structure", () => {
    // sync-check.js is CJS — runs directly with node
    const result = execFileSync("node", [SYNC_CHECK_PATH], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    expect(result).toContain("Fixture sync check passed");
  });

  it("should exit with code 0 on valid fixtures", () => {
    // If this doesn't throw, exit code was 0
    expect(() => {
      execFileSync("node", [SYNC_CHECK_PATH], {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }).not.toThrow();
  });
});
