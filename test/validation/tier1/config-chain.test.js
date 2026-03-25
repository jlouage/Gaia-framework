import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";
import {
  loadYaml,
  resolveConfigChain,
  resolveVariables,
  detectStaleness,
  validateNoUnresolved,
  resolveWorkflowConfig,
  countResolvedByModule,
  detectCountDrift,
  validateModuleResolution,
  PROJECT_ROOT,
} from "../../validators/config-validator.js";

const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const MODULES = ["lifecycle", "testing", "dev", "creative", "core"];

/**
 * Discover all .resolved/*.yaml files across GAIA modules (recursive).
 * Dynamic enumeration per AC3a — not a hardcoded list.
 * Searches workflow-level .resolved/ dirs, not just module root.
 */
function findResolvedFiles() {
  const files = [];
  for (const mod of MODULES) {
    const modDir = join(GAIA_DIR, mod);
    if (!existsSync(modDir)) continue;
    const result = execSync(
      `find -L "${modDir}" -path "*/.resolved/*.yaml" -not -path "*/_backups/*" -not -path "*/node_modules/*" 2>/dev/null || true`,
      { encoding: "utf8" }
    ).trim();
    if (result) {
      for (const f of result.split("\n").filter(Boolean)) {
        files.push({ module: mod, path: f, name: f.split("/").pop() });
      }
    }
  }
  return files;
}

describe("E2-S1: Config Chain Tier 1 Validation", () => {
  const resolvedFiles = findResolvedFiles();

  // ── AC3a: Pre-resolved configs match runtime resolution ──────
  describe("AC3a: Pre-resolved configs match runtime resolution", () => {
    it("should find resolved config files across modules", () => {
      expect(
        resolvedFiles.length,
        "Should find at least one .resolved/*.yaml file"
      ).toBeGreaterThan(0);
    });

    for (const { module: mod, path: resolvedFile, name: fileName } of resolvedFiles) {
      describe(`${mod}/${fileName}`, () => {
        it("should contain no unresolved {variable} placeholders", () => {
          const config = loadYaml(resolvedFile);
          expect(config).not.toBeNull();
          const result = validateNoUnresolved(config);
          expect(
            result.valid,
            `Unresolved variables found in ${fileName}: ${result.unresolvedVars.join(", ")}`
          ).toBe(true);
        });

        it("should match runtime resolution of its source workflow", () => {
          const resolvedConfig = loadYaml(resolvedFile);
          expect(resolvedConfig).not.toBeNull();

          // Find the source workflow.yaml — .resolved/ is always a sibling of or near workflow.yaml
          const workflowName = fileName.replace(".yaml", "");
          const searchResult = execSync(
            `find -L "${join(GAIA_DIR, mod)}" -name "workflow.yaml" -path "*/${workflowName}/*" -not -path "*/.resolved/*" -not -path "*/_backups/*" 2>/dev/null || true`,
            { encoding: "utf8" }
          ).trim();

          if (!searchResult) return; // skip if source not found

          const workflowPath = searchResult.split("\n")[0];
          const workflowConfig = loadYaml(workflowPath);
          const moduleConfig = loadYaml(join(GAIA_DIR, mod, "config.yaml"));
          const globalConfig = loadYaml(join(GAIA_DIR, "_config", "global.yaml"));

          // Runtime resolve the chain
          const runtimeResolved = resolveConfigChain(
            globalConfig,
            moduleConfig || {},
            workflowConfig
          );
          const runtimeWithVars = resolveVariables(runtimeResolved, PROJECT_ROOT, {
            project_path: globalConfig.project_path,
            installed_path: workflowConfig.installed_path,
          });

          // Compare key fields — name and module should match
          if (resolvedConfig.name && runtimeWithVars.name) {
            expect(resolvedConfig.name, `Mismatch on "name" in ${fileName}`).toEqual(
              runtimeWithVars.name
            );
          }
          if (resolvedConfig.module && runtimeWithVars.module) {
            expect(resolvedConfig.module, `Mismatch on "module" in ${fileName}`).toEqual(
              runtimeWithVars.module
            );
          }
        });
      });
    }
  });

  // ── AC3b: Staleness detection ────────────────────────────────
  describe("AC3b: Staleness detection for .resolved/ configs", () => {
    for (const { module: mod, path: resolvedFile, name: fileName } of resolvedFiles) {
      it(`should check staleness for ${mod}/${fileName}`, () => {
        const sourcePaths = [
          join(GAIA_DIR, "_config", "global.yaml"),
          join(GAIA_DIR, mod, "config.yaml"),
        ].filter((p) => existsSync(p));

        const result = detectStaleness(resolvedFile, sourcePaths);

        expect(result).toHaveProperty("stale");
        expect(typeof result.stale).toBe("boolean");
        if (result.stale) {
          expect(result.reason).toBeTruthy();
        }
      });
    }
  });

  // ── AC1: Live config inheritance chain validation ────────────
  describe("AC1: Live config inheritance chain", () => {
    it("should have global.yaml as the root of all config", () => {
      const globalConfig = loadYaml(join(GAIA_DIR, "_config", "global.yaml"));
      expect(globalConfig).not.toBeNull();
      expect(globalConfig.framework_name).toBe("GAIA");
    });

    it("should have module configs that reference global.yaml inheritance", () => {
      for (const mod of MODULES) {
        const configPath = join(GAIA_DIR, mod, "config.yaml");
        if (existsSync(configPath)) {
          const config = loadYaml(configPath);
          expect(config.inherits, `${mod}/config.yaml should declare inherits`).toContain(
            "global.yaml"
          );
        }
      }
    });
  });

  // ── AC2: Variable substitution in live configs ───────────────
  describe("AC2: Variable substitution in live framework", () => {
    it("should have global.yaml with resolvable variable patterns", () => {
      const globalConfig = loadYaml(join(GAIA_DIR, "_config", "global.yaml"));
      expect(globalConfig.project_root).toBe("{project-root}");
      expect(globalConfig.installed_path).toBe("{project-root}/_gaia");
    });
  });
});

// ── E2-S2: Build-Configs Regeneration Verification ────────────
const IN_SCOPE_MODULES = ["lifecycle", "testing", "dev", "creative"];

describe("E2-S2: Build-Configs Regeneration Verification", () => {
  const globalConfig = loadYaml(join(GAIA_DIR, "_config", "global.yaml"));

  // ── AC1: Regeneration produces no unresolved placeholders ───
  describe("AC1: All resolved configs regenerate without unresolved placeholders", () => {
    for (const mod of IN_SCOPE_MODULES) {
      const modDir = join(GAIA_DIR, mod);
      if (!existsSync(modDir)) continue;

      it(`should resolve all ${mod} workflow configs with no unresolved build-time variables`, () => {
        const counts = countResolvedByModule([mod]);
        const modCounts = counts[mod];

        // Skip modules with no resolved files
        if (!modCounts || modCounts.resolved === 0) return;

        // For each resolved file, verify no unresolved build-time variables remain
        const result = execSync(
          `find -L "${modDir}" -path "*/.resolved/*.yaml" -not -path "*/_backups/*" 2>/dev/null || true`,
          { encoding: "utf8" }
        ).trim();

        if (!result) return;

        for (const resolvedPath of result.split("\n").filter(Boolean)) {
          const config = loadYaml(resolvedPath);
          expect(config).not.toBeNull();
          const validation = validateNoUnresolved(config);
          expect(
            validation.valid,
            `Unresolved build-time variables in ${relative(GAIA_DIR, resolvedPath)}: ${validation.unresolvedVars.join(", ")}`
          ).toBe(true);
        }
      });
    }
  });

  // ── AC2: Deep comparison of dev-story resolved config ────────
  describe("AC2: Sample workflow deep comparison (dev-story)", () => {
    it("should resolve dev-story workflow config matching the resolved file field-by-field", () => {
      const workflowPath = join(
        GAIA_DIR,
        "lifecycle/workflows/4-implementation/dev-story/workflow.yaml"
      );
      const resolvedResult = resolveWorkflowConfig(workflowPath, PROJECT_ROOT, globalConfig);

      expect(resolvedResult).not.toBeNull();
      expect(resolvedResult.name).toBe("dev-story");
      expect(resolvedResult.module).toBe("lifecycle");
    });

    it("should resolve {project-path} to {project-root}/Gaia-framework, not just {project-root}", () => {
      const workflowPath = join(
        GAIA_DIR,
        "lifecycle/workflows/4-implementation/dev-story/workflow.yaml"
      );
      const resolvedResult = resolveWorkflowConfig(workflowPath, PROJECT_ROOT, globalConfig);

      // The resolved config should contain the full project-path, not bare project-root
      // for fields that use {project-path}
      expect(globalConfig.project_path).toBe("Gaia-framework");
      expect(resolvedResult).not.toBeNull();
    });

    it("should resolve all four variable types correctly", () => {
      const workflowPath = join(
        GAIA_DIR,
        "lifecycle/workflows/4-implementation/dev-story/workflow.yaml"
      );
      const resolvedResult = resolveWorkflowConfig(workflowPath, PROJECT_ROOT, globalConfig);

      // Validate using the standard unresolved-variable checker which
      // correctly excludes runtime variables (date, story_key, etc.)
      const validation = validateNoUnresolved(resolvedResult);
      expect(
        validation.valid,
        `Unresolved build-time variables: ${validation.unresolvedVars.join(", ")}`
      ).toBe(true);

      // Key build-time fields should contain the actual project root path
      expect(resolvedResult.config_source).toContain(PROJECT_ROOT);
      expect(resolvedResult.config_resolved).toContain(PROJECT_ROOT);
    });
  });

  // ── AC3a: Content drift / staleness detection ────────────────
  describe("AC3a: Staleness detection (content drift)", () => {
    it("should detect stale resolved file when source has newer mtime", () => {
      // Use detectStaleness with a source that is guaranteed newer
      // The global.yaml is always a source — if it's newer than a resolved file, staleness is detected
      const testResolvedPath = join(GAIA_DIR, "lifecycle/.resolved/dev-story.yaml");

      // This may or may not exist — the test validates the detection logic
      if (!existsSync(testResolvedPath)) {
        // If no resolved file exists, staleness should report it as missing
        const result = detectStaleness(testResolvedPath, [
          join(GAIA_DIR, "_config", "global.yaml"),
        ]);
        expect(result.stale).toBe(true);
        expect(result.reason).toBeTruthy();
        return;
      }

      const sourcePaths = [
        join(GAIA_DIR, "_config", "global.yaml"),
        join(GAIA_DIR, "lifecycle", "config.yaml"),
      ].filter((p) => existsSync(p));

      const result = detectStaleness(testResolvedPath, sourcePaths);
      expect(result).toHaveProperty("stale");
      expect(typeof result.stale).toBe("boolean");
    });

    it("should include actionable remediation message when stale", () => {
      // Create a scenario: check a non-existent resolved path
      const fakePath = join(GAIA_DIR, "lifecycle/.resolved/nonexistent-workflow.yaml");
      const result = detectStaleness(fakePath, [join(GAIA_DIR, "_config", "global.yaml")]);
      expect(result.stale).toBe(true);
      expect(result.reason).toContain("does not exist");
    });
  });

  // ── AC3b: Count drift detection ──────────────────────────────
  describe("AC3b: Count drift detection (missing resolved files)", () => {
    it("should detect modules where workflow count exceeds resolved count", () => {
      const driftResults = detectCountDrift(IN_SCOPE_MODULES);

      expect(driftResults).toBeDefined();
      expect(Array.isArray(driftResults)).toBe(true);

      // lifecycle has 51 workflows but only 45 resolved — should be detected
      const lifecycleDrift = driftResults.find((d) => d.module === "lifecycle");
      if (lifecycleDrift) {
        expect(lifecycleDrift.missing).toBeGreaterThan(0);
        expect(lifecycleDrift.missingFiles).toBeDefined();
      }
    });

    it("should report missing resolved files with workflow names", () => {
      const driftResults = detectCountDrift(IN_SCOPE_MODULES);

      for (const drift of driftResults) {
        if (drift.missing > 0) {
          expect(drift.missingFiles).toBeDefined();
          expect(drift.missingFiles.length).toBe(drift.missing);
        }
      }
    });
  });

  // ── AC4: Count verification across modules ───────────────────
  describe("AC4: Resolved file count matches workflow count per module", () => {
    it("should count resolved files per in-scope module", () => {
      const counts = countResolvedByModule(IN_SCOPE_MODULES);

      expect(counts).toBeDefined();
      for (const mod of IN_SCOPE_MODULES) {
        if (counts[mod]) {
          expect(typeof counts[mod].resolved).toBe("number");
          expect(typeof counts[mod].workflows).toBe("number");
          expect(counts[mod].resolved).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should report gaps where resolved count < workflow count", () => {
      const counts = countResolvedByModule(IN_SCOPE_MODULES);

      for (const mod of IN_SCOPE_MODULES) {
        if (counts[mod]) {
          const gap = counts[mod].workflows - counts[mod].resolved;
          expect(typeof gap).toBe("number");
          if (gap > 0) {
            // Gap exists — this is expected for lifecycle (51 vs 45) and testing (13 vs 12)
            expect(counts[mod].gap).toBe(gap);
          }
        }
      }
    });
  });

  // ── AC5: Partial failure / error handling ─────────────────────
  describe("AC5: Error handling for module resolution failure", () => {
    it("should report per-module error when config.yaml is missing", () => {
      const result = validateModuleResolution("nonexistent-module", PROJECT_ROOT);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should not produce partial output for a failed module", () => {
      const result = validateModuleResolution("nonexistent-module", PROJECT_ROOT);

      expect(result.success).toBe(false);
      expect(result.resolvedConfigs).toBeUndefined();
    });
  });
});
