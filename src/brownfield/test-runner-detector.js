/**
 * E19-S12: Brownfield Test Runner Detection
 *
 * Detects test runners from package.json, build files, and config files.
 * Supports: Jest, Vitest, Mocha, Jasmine, pytest, JUnit (Maven/Gradle),
 * Go test, and BATS.
 *
 * Traces to: FR-231, NFR-041
 * NFR-041: Zero false positives — only detect when config or dependency is found.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

// ─── Known test runner dependencies (package.json devDependencies) ──────────

const SUPPORTED_RUNNERS = ["jest", "vitest", "mocha", "jasmine"];

// ─── Known test runner script references ────────────────────────────────────

const SCRIPT_RUNNER_PATTERNS = [
  { pattern: /\bjest\b/, runner: "jest" },
  { pattern: /\bvitest\b/, runner: "vitest" },
  { pattern: /\bmocha\b/, runner: "mocha" },
  { pattern: /\bjasmine\b/, runner: "jasmine" },
];

// ─── Config file → runner mappings ──────────────────────────────────────────

const CONFIG_FILE_CHECKS = [
  { files: ["jest.config.js", "jest.config.ts", "jest.config.json"], runner: "jest" },
  { files: ["vitest.config.js", "vitest.config.ts"], runner: "vitest" },
  { files: [".mocharc.js", ".mocharc.yml", ".mocharc.json"], runner: "mocha" },
  { files: ["pytest.ini"], runner: "pytest" },
  { files: ["go.mod"], runner: "go-test" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Safely read and parse JSON from a file path.
 * Returns null if file does not exist or cannot be parsed.
 */
function readJsonSafe(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Safely read a text file. Returns null if not found.
 */
function readTextSafe(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Check if a directory contains any .bats files (recursive, max 2 levels deep).
 */
function hasBatsFiles(dir, depth = 0) {
  if (depth > 2) return false;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".bats")) return true;
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        if (hasBatsFiles(join(dir, entry.name), depth + 1)) return true;
      }
    }
  } catch {
    // Directory not readable — skip
  }
  return false;
}

/**
 * Resolve workspace package directories from glob patterns.
 * Supports: ["packages/*"], ["apps/*", "libs/*"], etc.
 */
function resolveWorkspacePackages(rootDir, patterns) {
  const dirs = [];
  for (const pattern of patterns) {
    // Only handle simple "dir/*" glob patterns
    const trimmed = pattern.replace(/\/\*$/, "");
    const parentDir = join(rootDir, trimmed);
    if (!existsSync(parentDir)) continue;
    try {
      const entries = readdirSync(parentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs.push(join(parentDir, entry.name));
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }
  return dirs;
}

/**
 * Parse pnpm-workspace.yaml content and extract workspace glob patterns.
 * Returns an array of pattern strings, e.g. ["packages/*"].
 */
function parsePnpmWorkspacePatterns(content) {
  const lines = content.split("\n");
  const patterns = [];
  let inPackages = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "packages:") {
      inPackages = true;
      continue;
    }
    if (inPackages && trimmed.startsWith("- ")) {
      patterns.push(trimmed.slice(2).replace(/['"]/g, "").trim());
    } else if (inPackages && !trimmed.startsWith("-") && trimmed !== "") {
      inPackages = false;
    }
  }
  return patterns;
}

/**
 * Merge all items from a Set into another Set (mutates target).
 */
function mergeSets(target, source) {
  for (const item of source) target.add(item);
}

// ─── Core detection logic ───────────────────────────────────────────────────

/**
 * Scan a single directory for test runners.
 * Returns a Set of detected runner names.
 */
function scanDirectory(dir) {
  const runners = new Set();

  // 1. Check package.json devDependencies and scripts
  const pkg = readJsonSafe(join(dir, "package.json"));
  if (pkg) {
    const devDeps = pkg.devDependencies || {};
    for (const runner of SUPPORTED_RUNNERS) {
      if (runner in devDeps) {
        runners.add(runner);
      }
    }

    // Check scripts.test for runner references
    const testScript = pkg.scripts?.test;
    if (testScript && typeof testScript === "string") {
      for (const { pattern, runner } of SCRIPT_RUNNER_PATTERNS) {
        if (pattern.test(testScript)) {
          runners.add(runner);
        }
      }
    }
  }

  // 2. Check config files
  for (const { files, runner } of CONFIG_FILE_CHECKS) {
    for (const file of files) {
      if (existsSync(join(dir, file))) {
        runners.add(runner);
        break; // One match per runner group is enough
      }
    }
  }

  // 3. Check pyproject.toml for [tool.pytest] section
  const pyprojectContent = readTextSafe(join(dir, "pyproject.toml"));
  if (pyprojectContent && /\[tool\.pytest/.test(pyprojectContent)) {
    runners.add("pytest");
  }

  // 4. Check build.gradle / build.gradle.kts for test block
  for (const gradleFile of ["build.gradle", "build.gradle.kts"]) {
    const gradleContent = readTextSafe(join(dir, gradleFile));
    if (gradleContent && /\btest\s*\{/.test(gradleContent)) {
      runners.add("junit");
      break;
    }
  }

  // 5. Check pom.xml for Maven (implies JUnit by convention)
  if (existsSync(join(dir, "pom.xml"))) {
    runners.add("junit");
  }

  // 6. Check for BATS test files
  if (hasBatsFiles(dir)) {
    runners.add("bats");
  }

  return runners;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect test runners at the given project path.
 *
 * Scans the root directory and, if monorepo workspaces are detected,
 * also scans each workspace package directory.
 *
 * Returns: string[] — array of unique detected runner names, or [] if none found.
 *
 * Supported runners: "jest", "vitest", "mocha", "jasmine", "pytest",
 * "junit", "go-test", "bats"
 *
 * @param {string} projectPath — absolute path to the project root
 * @returns {Promise<string[]>}
 */
export async function detectTestRunners(projectPath) {
  const resolvedPath = resolve(projectPath);
  const allRunners = new Set();

  // Scan root directory
  mergeSets(allRunners, scanDirectory(resolvedPath));

  // Collect monorepo workspace directories from both sources
  const workspaceDirs = new Set();

  // Source 1: package.json workspaces field
  const pkg = readJsonSafe(join(resolvedPath, "package.json"));
  if (pkg?.workspaces) {
    const patterns = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : pkg.workspaces.packages || [];
    for (const dir of resolveWorkspacePackages(resolvedPath, patterns)) {
      workspaceDirs.add(dir);
    }
  }

  // Source 2: pnpm-workspace.yaml
  const pnpmContent = readTextSafe(join(resolvedPath, "pnpm-workspace.yaml"));
  if (pnpmContent) {
    const patterns = parsePnpmWorkspacePatterns(pnpmContent);
    for (const dir of resolveWorkspacePackages(resolvedPath, patterns)) {
      workspaceDirs.add(dir);
    }
  }

  // Scan each workspace package
  for (const wsDir of workspaceDirs) {
    mergeSets(allRunners, scanDirectory(wsDir));
  }

  return [...allRunners];
}
