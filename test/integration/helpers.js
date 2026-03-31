/**
 * Shared helpers for integration tests (E3-S5)
 *
 * Provides common constants, temp directory management, and the
 * runInstaller() wrapper for driving gaia-install.sh via execFileSync.
 */

import { existsSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { PROJECT_ROOT } from "../helpers/project-root.js";
import { findBash } from "../helpers/platform.js";

export { PROJECT_ROOT };
export const SCRIPT_PATH = join(PROJECT_ROOT, "gaia-install.sh");
export const MOCK_FRAMEWORK = join(PROJECT_ROOT, "test", "fixtures", "mock-framework");

/**
 * Resolved bash path for integration tests.
 * If null, integration tests that require bash should be skipped.
 */
export const BASH_PATH = findBash();

/**
 * Create an isolated temp directory for a test.
 * @returns {string} Absolute path to the temp directory
 */
export function createTempDir() {
  return mkdtempSync(join(tmpdir(), "gaia-inttest-"));
}

/**
 * Remove a temp directory and all its contents.
 * Safe to call even if the directory no longer exists.
 * @param {string} dir - Absolute path to remove
 */
export function cleanupTempDir(dir) {
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Run gaia-install.sh with the given arguments.
 * Returns { stdout, stderr, status } without throwing on non-zero exit.
 *
 * @param {string[]} args - CLI arguments (e.g., ["init", "--source", path, "--yes", target])
 * @param {object} [options] - Optional overrides for cwd and env
 * @returns {{ stdout: string, stderr: string, status: number }}
 */
export function runInstaller(args, options = {}) {
  if (!BASH_PATH) {
    throw new Error(
      "bash not found — integration tests require bash. Install Git Bash on Windows."
    );
  }
  try {
    const stdout = execFileSync(BASH_PATH, [SCRIPT_PATH, ...args], {
      cwd: options.cwd || PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 25000,
      env: { ...process.env, ...(options.env || {}) },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      status: err.status ?? 1,
    };
  }
}

/**
 * Run init as a prerequisite for update tests.
 * Throws if init fails.
 *
 * @param {string} targetDir - Target directory for init
 * @returns {{ stdout: string, stderr: string, status: number }}
 */
export function initFirst(targetDir) {
  const result = runInstaller(["init", "--source", MOCK_FRAMEWORK, "--yes", targetDir]);
  if (result.status !== 0) {
    throw new Error(`Init prerequisite failed: ${result.stderr || result.stdout}`);
  }
  return result;
}
