import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const NEW_MEMORY = join(PROJECT_ROOT, "_memory");
const GLOBAL_YAML = join(PROJECT_ROOT, "_gaia", "_config", "global.yaml");
const GITIGNORE = join(PROJECT_ROOT, ".gitignore");

describe("E8-S1: Test Automation — Extended Coverage", () => {
  // ─── AC1 Extended: config.yaml deep structure validation ───
  describe("AC1 Extended: config.yaml structure depth", () => {
    let config;

    it("config.yaml loads as valid YAML", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      expect(existsSync(configPath)).toBe(true);
      config = yaml.load(readFileSync(configPath, "utf-8"));
      expect(config).toBeDefined();
    });

    it("defines all three tiers with correct labels", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      expect(config.tiers.tier_1.label).toBe("Rich");
      expect(config.tiers.tier_2.label).toBe("Standard");
      expect(config.tiers.tier_3.label).toBe("Simple");
    });

    it("tier_1 has ground_truth enabled, tier_2 and tier_3 do not", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      expect(config.tiers.tier_1.has_ground_truth).toBe(true);
      expect(config.tiers.tier_2.has_ground_truth).toBe(false);
      expect(config.tiers.tier_3.has_ground_truth).toBe(false);
    });

    it("tier_1 agents include validator, architect, pm, sm", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      expect(config.tiers.tier_1.agents).toEqual(
        expect.arrayContaining(["validator", "architect", "pm", "sm"]),
      );
    });

    it("tier_2 agents include orchestrator, security, devops, test-architect", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      expect(config.tiers.tier_2.agents).toEqual(
        expect.arrayContaining([
          "orchestrator",
          "security",
          "devops",
          "test-architect",
        ]),
      );
    });

    it("archival thresholds are defined with correct progression", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      expect(config.archival).toBeDefined();
      expect(config.archival.budget_warn_at).toBe(0.8);
      expect(config.archival.budget_alert_at).toBe(0.9);
      expect(config.archival.budget_archive_at).toBe(1.0);
      expect(config.archival.budget_warn_at).toBeLessThan(
        config.archival.budget_alert_at,
      );
      expect(config.archival.budget_alert_at).toBeLessThan(
        config.archival.budget_archive_at,
      );
    });

    it("archival uses 'archive' subdirectory matching .gitignore pattern", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      expect(config.archival.archive_subdir).toBe("archive");
    });

    it("cross-reference matrix defines read access for key agents", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      const crossRefs = config.cross_references;
      expect(crossRefs.architect?.reads_from).toBeDefined();
      expect(crossRefs.architect.reads_from.length).toBeGreaterThan(0);

      expect(crossRefs.validator?.reads_from).toBeDefined();
      expect(crossRefs.validator.reads_from.length).toBeGreaterThan(0);

      // Validator has a cross-ref budget cap
      expect(crossRefs.validator.cross_ref_budget_cap).toBeDefined();
      expect(crossRefs.validator.cross_ref_budget_cap).toBeLessThanOrEqual(1.0);
    });

    it("each cross-reference entry has agent, file, and mode fields", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      const crossRefs = config.cross_references;
      for (const [agentName, agentConfig] of Object.entries(crossRefs)) {
        if (agentConfig.reads_from) {
          for (const ref of agentConfig.reads_from) {
            expect(ref.agent, `${agentName} ref missing 'agent'`).toBeDefined();
            expect(ref.file, `${agentName} ref missing 'file'`).toBeDefined();
            expect(ref.mode, `${agentName} ref missing 'mode'`).toBeDefined();
            expect(["recent", "full", "summary"]).toContain(ref.mode);
          }
        }
      }
    });

    it("all 10 agents in config have sidecar directories that exist", () => {
      const configPath = join(NEW_MEMORY, "config.yaml");
      config = yaml.load(readFileSync(configPath, "utf-8"));

      for (const [agentName, agentConfig] of Object.entries(config.agents)) {
        if (agentConfig.sidecar) {
          const sidecarPath = join(NEW_MEMORY, agentConfig.sidecar);
          expect(
            existsSync(sidecarPath),
            `Sidecar directory missing for ${agentName}: ${agentConfig.sidecar}`,
          ).toBe(true);
        }
      }
    });
  });

  // ─── AC1 Extended: Empty sidecar directories ───
  describe("AC1 Extended: Empty sidecars have no unexpected content", () => {
    // validator-sidecar excluded — populated by E8-S13 (ground-truth.md, decision-log.md, conversation-context.md)
    // architect-sidecar, pm-sidecar, sm-sidecar excluded — populated by E9-S2 (Tier 1 memory)
    const emptySidecars = [
      "orchestrator-sidecar",
      "test-architect-sidecar",
      "storyteller-sidecar",
      "tech-writer-sidecar",
    ];

    it.each(emptySidecars)(
      "%s/ contains only .gitkeep or is empty (no content files yet)",
      (dir) => {
        const dirPath = join(NEW_MEMORY, dir);
        expect(existsSync(dirPath)).toBe(true);

        const contents = readdirSync(dirPath).filter(
          (f) => f !== ".gitkeep" && f !== ".DS_Store",
        );
        // These sidecars should have no content files — downstream stories create them
        expect(
          contents.length,
          `${dir}/ should be empty or have only .gitkeep, found: ${contents.join(", ")}`,
        ).toBe(0);
      },
    );
  });

  // ─── AC2 Extended: global.yaml complete validation ───
  describe("AC2 Extended: global.yaml path consistency", () => {
    it("memory_path and checkpoint_path are consistent (checkpoint under memory)", () => {
      const content = readFileSync(GLOBAL_YAML, "utf-8");
      const config = yaml.load(content);

      // checkpoint_path should start with memory_path value
      const memoryBase = config.memory_path.replace("{project-root}/", "");
      const checkpointBase = config.checkpoint_path.replace(
        "{project-root}/",
        "",
      );
      expect(checkpointBase.startsWith(memoryBase)).toBe(true);
    });

    it("no _gaia/_memory references remain anywhere in global.yaml", () => {
      const content = readFileSync(GLOBAL_YAML, "utf-8");
      // Check the raw file content, not just parsed values
      expect(content).not.toContain("_gaia/_memory");
    });
  });

  // ─── AC4 Extended: Migrated content is non-empty ───
  describe("AC4 Extended: Migrated sidecar content validation", () => {
    it("devops-sidecar/decision-log.md has meaningful content", () => {
      const filePath = join(NEW_MEMORY, "devops-sidecar", "decision-log.md");
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, "utf-8");
      expect(content.length).toBeGreaterThan(100);
      expect(content).toContain("Infrastructure Decisions");
    });

    it("security-sidecar/decision-log.md has meaningful content", () => {
      const filePath = join(NEW_MEMORY, "security-sidecar", "decision-log.md");
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, "utf-8");
      expect(content.length).toBeGreaterThan(100);
      expect(content).toContain("Threat Model Decisions");
    });
  });

  // ─── AC5 Extended: README completeness ───
  describe("AC5 Extended: Rollback documentation completeness", () => {
    it("README.md documents the directory structure", () => {
      const content = readFileSync(join(NEW_MEMORY, "README.md"), "utf-8");
      expect(content).toContain("checkpoints/");
      expect(content).toContain("sidecar");
      expect(content).toContain("config.yaml");
    });

    it("README.md references ADR-013 as the migration rationale", () => {
      const content = readFileSync(join(NEW_MEMORY, "README.md"), "utf-8");
      expect(content).toContain("ADR-013");
    });

    it("README.md mentions running /gaia-build-configs after revert", () => {
      const content = readFileSync(join(NEW_MEMORY, "README.md"), "utf-8");
      expect(content).toContain("gaia-build-configs");
    });
  });

  // ─── AC3 Extended: .gitignore pattern precision ───
  describe("AC3 Extended: .gitignore archive pattern", () => {
    it("archive exclusion uses wildcard pattern for all sidecars", () => {
      const content = readFileSync(GITIGNORE, "utf-8");
      // The pattern must use * to cover all sidecar directories
      expect(content).toContain("*-sidecar/archive/");
    });
  });
});
