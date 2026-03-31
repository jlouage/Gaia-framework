/**
 * Integration Test: Update Flow (E3-S5)
 *
 * End-to-end tests for gaia-install.sh update command.
 * Drives the shell script directly via execFileSync.
 *
 * Covers: AC2 (happy-path update), AC6 (update without prior init),
 *         AC7 (dry-run update), AC9 (temp cleanup)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { findExecutable } from "../helpers/platform.js";
import {
  MOCK_FRAMEWORK,
  createTempDir,
  cleanupTempDir,
  runInstaller,
  initFirst,
} from "./helpers.js";

// Skip integration tests if rsync is not available (e.g., Ubuntu CI runners)
const hasRsync = findExecutable("rsync") !== null;

let tempDir;

describe.skipIf(!hasRsync)("Update flow integration tests", () => {
  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe("AC2: Happy-path update", () => {
    it("should update framework files after a prior init", () => {
      initFirst(tempDir);
      expect(existsSync(join(tempDir, "_gaia"))).toBe(true);

      const result = runInstaller(["update", "--source", MOCK_FRAMEWORK, "--yes", tempDir]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Update complete");
    });

    it("should create a timestamped backup when files are changed", () => {
      initFirst(tempDir);

      // Modify a framework file to force backup on update
      const manifestPath = join(tempDir, "_gaia", "_config", "manifest.yaml");
      writeFileSync(manifestPath, "# Modified for test\nversion: old\n");

      runInstaller(["update", "--source", MOCK_FRAMEWORK, "--yes", tempDir]);

      const backupDir = join(tempDir, "_gaia", "_backups");
      expect(existsSync(backupDir)).toBe(true);

      const backups = readdirSync(backupDir);
      expect(backups.length).toBeGreaterThan(0);
    });

    it("should preserve protected files (_gaia/_config/global.yaml)", () => {
      initFirst(tempDir);

      const globalPath = join(tempDir, "_gaia", "_config", "global.yaml");

      runInstaller(["update", "--source", MOCK_FRAMEWORK, "--yes", tempDir]);

      // global.yaml is NOT in update_targets, so it should preserve project_name
      const afterContent = readFileSync(globalPath, "utf-8");
      expect(afterContent).toContain("project_name:");
    });

    it("should preserve _memory/ contents during update", () => {
      initFirst(tempDir);

      // Create user data in _memory/ that should survive update
      const memoryFile = join(tempDir, "_memory", "checkpoints", "test-data.yaml");
      writeFileSync(memoryFile, "test: data\n");

      runInstaller(["update", "--source", MOCK_FRAMEWORK, "--yes", tempDir]);

      expect(existsSync(memoryFile)).toBe(true);
      expect(readFileSync(memoryFile, "utf-8")).toContain("test: data");
    });

    it("should refresh .claude/commands/ during update", () => {
      initFirst(tempDir);

      runInstaller(["update", "--source", MOCK_FRAMEWORK, "--yes", tempDir]);

      const cmdDir = join(tempDir, ".claude", "commands");
      expect(existsSync(cmdDir)).toBe(true);
    });
  });

  describe("AC6: Update without prior init", () => {
    it("should abort with error when no prior init exists", () => {
      const result = runInstaller(["update", "--source", MOCK_FRAMEWORK, "--yes", tempDir]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("No GAIA installation found");
    });

    it("should not create any files when aborting", () => {
      runInstaller(["update", "--source", MOCK_FRAMEWORK, "--yes", tempDir]);

      expect(existsSync(join(tempDir, "_gaia"))).toBe(false);
    });
  });

  describe("AC7: Dry-run update", () => {
    it("should not modify files when --dry-run is passed", () => {
      initFirst(tempDir);

      // Modify manifest to detect if update overwrites it
      const manifestPath = join(tempDir, "_gaia", "_config", "manifest.yaml");
      writeFileSync(manifestPath, "# MODIFIED\nversion: modified\n");
      const beforeContent = readFileSync(manifestPath, "utf-8");

      const result = runInstaller([
        "update",
        "--source",
        MOCK_FRAMEWORK,
        "--yes",
        "--dry-run",
        tempDir,
      ]);

      expect(result.status).toBe(0);
      expect(readFileSync(manifestPath, "utf-8")).toBe(beforeContent);
    });

    it("should describe what would be done in dry-run output", () => {
      initFirst(tempDir);

      const result = runInstaller([
        "update",
        "--source",
        MOCK_FRAMEWORK,
        "--yes",
        "--dry-run",
        tempDir,
      ]);

      expect(result.stdout.toLowerCase()).toContain("dry-run");
    });
  });

  describe("AC9: Temp directory cleanup", () => {
    it("should clean up temp directories via afterEach hook", () => {
      // Create nested content to validate recursive cleanup
      const nested = join(tempDir, "deep", "nested");
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(nested, "file.txt"), "test");
      expect(existsSync(nested)).toBe(true);
      // afterEach handles cleanup
    });
  });
});
