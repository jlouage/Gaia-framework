/**
 * Cross-platform test utilities (E6-S9)
 *
 * Consolidates platform-specific checks into a single shared module
 * per architecture recommendation. All functions use Node.js built-ins
 * only (ADR-005: zero runtime dependencies).
 *
 * CJS-compatible exports (ADR-002: Vitest with pool: 'forks').
 */

import { mkdtempSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

/** True when running on Windows. */
export const IS_WINDOWS = process.platform === "win32";

/**
 * Platform-aware executable lookup.
 * Uses `where` on Windows, `which` on Unix.
 * Returns the resolved path string or null if not found.
 *
 * @param {string} name - Executable name (e.g., 'rsync', 'bash')
 * @returns {string|null}
 */
export function findExecutable(name) {
  const cmd = IS_WINDOWS ? "where" : "which";
  try {
    const result = spawnSync(cmd, [name], {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 5000,
    });
    if (result.status === 0 && result.stdout && result.stdout.trim().length > 0) {
      // `where` on Windows may return multiple lines; take the first
      return result.stdout.trim().split(/\r?\n/)[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a temporary directory using Node.js built-ins.
 * Cross-platform replacement for `mktemp -d`.
 *
 * @param {string} prefix - Directory name prefix (e.g., 'gaia-security-')
 * @returns {string} Absolute path to the created temp directory
 */
export function makeTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Discover bash executable using platform-aware lookup.
 * Search order:
 *   1. process.env.BASH
 *   2. Platform executable lookup (which/where)
 *   3. Well-known Git Bash paths on Windows
 * Returns path or null if bash is not available.
 *
 * @returns {string|null}
 */
export function findBash() {
  // 1. Check BASH environment variable
  if (process.env.BASH && existsSync(process.env.BASH)) {
    return process.env.BASH;
  }

  // 2. Platform-aware lookup
  const found = findExecutable("bash");
  if (found) return found;

  // 3. Well-known Git Bash paths on Windows
  if (IS_WINDOWS) {
    const wellKnownPaths = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
      "C:\\Git\\bin\\bash.exe",
    ];
    for (const p of wellKnownPaths) {
      if (existsSync(p)) return p;
    }
  }

  return null;
}

/**
 * Normalize path separators for cross-platform comparison.
 * Converts all backslashes to forward slashes.
 *
 * @param {string} p - Path string
 * @returns {string} Path with forward slashes only
 */
export function normalizePath(p) {
  return p.replace(/\\/g, "/");
}
