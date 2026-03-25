import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";
import yaml from "js-yaml";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const NEW_MEMORY = join(PROJECT_ROOT, "_memory");
const GLOBAL_YAML = join(PROJECT_ROOT, "_gaia", "_config", "global.yaml");
const GITIGNORE = join(PROJECT_ROOT, ".gitignore");

describe("E8-S1: Memory Directory Migration", () => {
  // AC1: Memory directories exist at project root with correct structure
  describe("AC1: Directory structure at project root", () => {
    it("_memory/ exists at project root", () => {
      expect(existsSync(NEW_MEMORY)).toBe(true);
    });

    it("checkpoints/ and checkpoints/completed/ exist", () => {
      expect(existsSync(join(NEW_MEMORY, "checkpoints"))).toBe(true);
      expect(existsSync(join(NEW_MEMORY, "checkpoints", "completed"))).toBe(true);
    });

    const expectedSidecars = [
      "validator-sidecar",
      "architect-sidecar",
      "pm-sidecar",
      "sm-sidecar",
      "orchestrator-sidecar",
      "security-sidecar",
      "devops-sidecar",
      "test-architect-sidecar",
      "storyteller-sidecar",
      "tech-writer-sidecar",
    ];

    it.each(expectedSidecars)("%s/ directory exists", (dir) => {
      expect(existsSync(join(NEW_MEMORY, dir)), `Missing directory: _memory/${dir}`).toBe(true);
    });

    it("config.yaml exists with token budgets and cross-reference matrix", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      expect(existsSync(configPath)).toBe(true);

      const content = readFileSync(configPath, "utf-8");
      const config = yaml.load(content);

      // Tier session budgets
      expect(config.tiers).toBeDefined();
      expect(config.tiers.tier_1?.session_budget).toBe(300000);
      expect(config.tiers.tier_2?.session_budget).toBe(100000);

      // Per-agent ground truth budgets (Tier 1 only)
      expect(config.agents?.validator?.ground_truth_budget).toBe(200000);
      expect(config.agents?.architect?.ground_truth_budget).toBe(150000);
      expect(config.agents?.pm?.ground_truth_budget).toBe(100000);
      expect(config.agents?.sm?.ground_truth_budget).toBe(100000);

      // Cross-reference matrix
      expect(config.cross_references).toBeDefined();
    });
  });

  // AC2: global.yaml paths updated
  describe("AC2: global.yaml paths updated", () => {
    it("memory_path references {project-root}/_memory", () => {
      const content = readFileSync(GLOBAL_YAML, "utf-8");
      const config = yaml.load(content);

      expect(config.memory_path).toMatch(/\{project-root\}\/_memory/);
      expect(config.memory_path).not.toContain("_gaia/_memory");
    });

    it("checkpoint_path references {project-root}/_memory/checkpoints", () => {
      const content = readFileSync(GLOBAL_YAML, "utf-8");
      const config = yaml.load(content);

      expect(config.checkpoint_path).toMatch(/\{project-root\}\/_memory\/checkpoints/);
      expect(config.checkpoint_path).not.toContain("_gaia/_memory");
    });
  });

  // AC3: .gitignore updated
  describe("AC3: .gitignore memory patterns", () => {
    it("contains _memory/checkpoints/ exclusion (not under _gaia/)", () => {
      const content = readFileSync(GITIGNORE, "utf-8");
      const lines = content.split("\n");
      const hasNewPattern = lines.some(
        (line) => line.includes("_memory/checkpoints/") && !line.includes("_gaia/_memory")
      );
      expect(hasNewPattern, "Missing _memory/checkpoints/ gitignore line").toBe(true);
    });

    it("contains _memory/*-sidecar/archive/ exclusion", () => {
      const content = readFileSync(GITIGNORE, "utf-8");
      expect(content).toMatch(/_memory\/\*-sidecar\/archive\//);
    });

    it("does NOT contain _gaia/_memory/ exclusions", () => {
      const content = readFileSync(GITIGNORE, "utf-8");
      expect(content).not.toMatch(/_gaia\/_memory\//);
    });
  });

  // AC4: Existing sidecar content preserved (only devops + security have content)
  describe("AC4: Sidecar content preserved", () => {
    function sha256(filePath) {
      return execSync(`shasum -a 256 "${filePath}"`, { encoding: "utf-8" }).split(" ")[0].trim();
    }

    function expectMigratedContent(sidecar, oldFilename) {
      const newPath = join(NEW_MEMORY, sidecar, "decision-log.md");
      expect(existsSync(newPath), `${sidecar}/decision-log.md not found`).toBe(true);

      const oldPath = join(PROJECT_ROOT, "_gaia", "_memory", sidecar, oldFilename);
      if (existsSync(oldPath)) {
        expect(sha256(newPath), `Content mismatch: ${sidecar}/decision-log.md`).toBe(
          sha256(oldPath)
        );
      }
    }

    it("devops-sidecar/decision-log.md exists with content from infrastructure-decisions.md", () => {
      expectMigratedContent("devops-sidecar", "infrastructure-decisions.md");
    });

    it("security-sidecar/decision-log.md exists with content from threat-model-decisions.md", () => {
      expectMigratedContent("security-sidecar", "threat-model-decisions.md");
    });
  });

  // AC5: Rollback procedure documented
  describe("AC5: Rollback procedure", () => {
    it("rollback documentation exists in _memory/README.md", () => {
      const readmePath = join(NEW_MEMORY, "README.md");
      expect(existsSync(readmePath), "No _memory/README.md found").toBe(true);

      const content = readFileSync(readmePath, "utf-8").toLowerCase();
      expect(content).toContain("rollback");
      expect(content).toContain("git revert");
    });
  });
});
