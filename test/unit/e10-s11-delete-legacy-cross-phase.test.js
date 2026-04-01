import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");

describe("E10-S11: Delete Legacy cross-phase/add-feature Directory", () => {
  // ── AC1: Legacy directory deleted ────────────────────────────
  describe("AC1: Legacy cross-phase/add-feature directory removed", () => {
    it("should not have cross-phase/add-feature directory in product source", () => {
      const legacyDir = resolve(PROJECT_ROOT, "_gaia/lifecycle/workflows/cross-phase/add-feature");
      expect(existsSync(legacyDir)).toBe(false);
    });

    it("should not have cross-phase parent directory if empty", () => {
      const crossPhaseDir = resolve(PROJECT_ROOT, "_gaia/lifecycle/workflows/cross-phase");
      expect(existsSync(crossPhaseDir)).toBe(false);
    });
  });

  // ── AC2: Zero active references ─────────────────────────────
  describe("AC2: No active references to cross-phase/add-feature", () => {
    it("should not reference cross-phase/add-feature in checksums.txt", () => {
      const checksumsPath = resolve(PROJECT_ROOT, "checksums.txt");
      if (!existsSync(checksumsPath)) return; // skip in CI where file may not be present
      const checksums = readFileSync(checksumsPath, "utf8");
      expect(checksums).not.toContain("cross-phase/add-feature");
    });

    it("should not reference cross-phase/add-feature in ground-truth.md", () => {
      const groundTruth = readFileSync(
        resolve(PROJECT_ROOT, "_memory/validator-sidecar/ground-truth.md"),
        "utf8"
      );
      expect(groundTruth).not.toContain("cross-phase/add-feature");
    });
  });

  // ── AC4: Architecture reference updated ─────────────────────
  describe("AC4: Architecture.md references new path", () => {
    it("should not reference cross-phase/add-feature in architecture.md", () => {
      const archPath = resolve(PROJECT_ROOT, "..", "docs/planning-artifacts/architecture.md");
      if (!existsSync(archPath)) return; // skip in CI — architecture.md is a framework artifact outside git
      const architecture = readFileSync(archPath, "utf8");
      expect(architecture).not.toContain("cross-phase/add-feature");
    });
  });

  // ── AC5: gaia-change-request.md updated ─────────────────────
  describe("AC5: gaia-change-request.md references new path", () => {
    it("should reference 4-implementation/add-feature in product source gaia-change-request.md", () => {
      const cmdFile = readFileSync(
        resolve(PROJECT_ROOT, ".claude/commands/gaia-change-request.md"),
        "utf8"
      );
      expect(cmdFile).toContain("4-implementation/add-feature/workflow.yaml");
      expect(cmdFile).not.toContain("cross-phase/add-feature");
    });
  });
});
