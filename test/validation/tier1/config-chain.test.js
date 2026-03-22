import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import { join, resolve, relative } from "path";
import { execSync } from "child_process";
import yaml from "js-yaml";
import {
  loadYaml,
  resolveConfigChain,
  resolveVariables,
  detectStaleness,
  validateNoUnresolved,
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
      { encoding: "utf8" },
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
        "Should find at least one .resolved/*.yaml file",
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
            `Unresolved variables found in ${fileName}: ${result.unresolvedVars.join(", ")}`,
          ).toBe(true);
        });

        it("should match runtime resolution of its source workflow", () => {
          const resolvedConfig = loadYaml(resolvedFile);
          expect(resolvedConfig).not.toBeNull();

          // Find the source workflow.yaml — .resolved/ is always a sibling of or near workflow.yaml
          const workflowName = fileName.replace(".yaml", "");
          const searchResult = execSync(
            `find -L "${join(GAIA_DIR, mod)}" -name "workflow.yaml" -path "*/${workflowName}/*" -not -path "*/.resolved/*" -not -path "*/_backups/*" 2>/dev/null || true`,
            { encoding: "utf8" },
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
            workflowConfig,
          );
          const runtimeWithVars = resolveVariables(runtimeResolved, PROJECT_ROOT, {
            project_path: globalConfig.project_path,
            installed_path: workflowConfig.installed_path,
          });

          // Compare key fields — name and module should match
          if (resolvedConfig.name && runtimeWithVars.name) {
            expect(
              resolvedConfig.name,
              `Mismatch on "name" in ${fileName}`,
            ).toEqual(runtimeWithVars.name);
          }
          if (resolvedConfig.module && runtimeWithVars.module) {
            expect(
              resolvedConfig.module,
              `Mismatch on "module" in ${fileName}`,
            ).toEqual(runtimeWithVars.module);
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
          expect(
            config.inherits,
            `${mod}/config.yaml should declare inherits`,
          ).toContain("global.yaml");
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
