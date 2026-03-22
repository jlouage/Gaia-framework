import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";
import {
  loadYaml,
  resolveConfigChain,
  resolveVariables,
  validateNoUnresolved,
  FRAMEWORK_VARIABLES,
  PROJECT_ROOT,
} from "../../validators/config-validator.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../fixtures/config");

describe("E2-S1: Config Resolution Unit Tests", () => {
  // ── AC1: Config inheritance chain ────────────────────────────
  describe("AC1: Four-layer config inheritance chain", () => {
    it("should merge global → module → workflow with correct override precedence", () => {
      const global = loadYaml(join(FIXTURES_DIR, "global.yaml"));
      const module = loadYaml(join(FIXTURES_DIR, "module-config.yaml"));
      const workflow = loadYaml(join(FIXTURES_DIR, "workflow.yaml"));

      const resolved = resolveConfigChain(global, module, workflow);

      // Global values should be present
      expect(resolved.framework_name).toBe("GAIA");
      // Module values should be present
      expect(resolved.module_name).toBe("lifecycle");
      // Workflow values should be present
      expect(resolved.workflow_setting).toBe("from-workflow");
      // Shared key: workflow-level should win
      expect(resolved.override_test).toBe("workflow-value");
    });

    it("should preserve global values not overridden by module or workflow", () => {
      const global = loadYaml(join(FIXTURES_DIR, "global.yaml"));
      const module = loadYaml(join(FIXTURES_DIR, "module-config.yaml"));
      const workflow = loadYaml(join(FIXTURES_DIR, "workflow.yaml"));

      const resolved = resolveConfigChain(global, module, workflow);

      expect(resolved.shared_setting).toBe("from-global");
      expect(resolved.framework_version).toBe("1.0.0-test");
    });

    it("should handle empty module config gracefully", () => {
      const global = loadYaml(join(FIXTURES_DIR, "global.yaml"));
      const workflow = loadYaml(join(FIXTURES_DIR, "workflow.yaml"));

      const resolved = resolveConfigChain(global, {}, workflow);

      expect(resolved.framework_name).toBe("GAIA");
      expect(resolved.override_test).toBe("workflow-value");
    });
  });

  // ── AC2: Variable substitution ───────────────────────────────
  describe("AC2: Variable substitution", () => {
    it("should resolve {project-root} to the actual filesystem root", () => {
      const config = { path: "{project-root}/_gaia" };
      const resolved = resolveVariables(config, PROJECT_ROOT);
      expect(resolved.path).toBe(`${PROJECT_ROOT}/_gaia`);
      expect(resolved.path).not.toContain("{project-root}");
    });

    it("should resolve {project-path} based on project_path setting", () => {
      const config = { path: "{project-path}/src" };
      const resolved = resolveVariables(config, PROJECT_ROOT, {
        project_path: "Gaia-framework",
      });
      expect(resolved.path).toBe(`${PROJECT_ROOT}/Gaia-framework/src`);
    });

    it("should resolve {installed_path} to framework install location", () => {
      const config = { path: "{installed_path}/core" };
      const resolved = resolveVariables(config, PROJECT_ROOT, {
        installed_path: `${PROJECT_ROOT}/_gaia`,
      });
      expect(resolved.path).toBe(`${PROJECT_ROOT}/_gaia/core`);
    });

    it("should resolve {date} to valid ISO 8601 format", () => {
      const config = { date: "{date}" };
      const resolved = resolveVariables(config, PROJECT_ROOT);
      // Pattern match, not exact value — avoids flakiness
      expect(resolved.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should resolve variables in nested objects", () => {
      const config = {
        outer: {
          inner: "{project-root}/nested/path",
        },
      };
      const resolved = resolveVariables(config, PROJECT_ROOT);
      expect(resolved.outer.inner).toBe(`${PROJECT_ROOT}/nested/path`);
    });
  });

  // ── AC4: project_path handling ───────────────────────────────
  describe("AC4: project_path handling", () => {
    it('should resolve project_path "." to exact {project-root} (no trailing dot)', () => {
      const config = { path: "{project-path}/src" };
      const resolved = resolveVariables(config, PROJECT_ROOT, {
        project_path: ".",
      });
      // {project-path} should be PROJECT_ROOT exactly, not PROJECT_ROOT/.
      expect(resolved.path).toBe(`${PROJECT_ROOT}/src`);
      expect(resolved.path).not.toContain("/./");
    });

    it('should resolve project_path "Gaia-framework" to {project-root}/Gaia-framework', () => {
      const config = { path: "{project-path}" };
      const resolved = resolveVariables(config, PROJECT_ROOT, {
        project_path: "Gaia-framework",
      });
      expect(resolved.path).toBe(`${PROJECT_ROOT}/Gaia-framework`);
    });
  });

  // ── AC5: Undefined variable handling ─────────────────────────
  describe("AC5: Undefined variable produces actionable error", () => {
    it("should throw an error for undefined variables, not silently pass through", () => {
      const config = {
        path: "{nonexistent_var}/instructions.xml",
      };
      expect(() => resolveVariables(config, PROJECT_ROOT)).toThrow();
    });

    it("should include the undefined variable name in the error message", () => {
      const config = {
        path: "{undefined_setting}/output",
      };
      expect(() => resolveVariables(config, PROJECT_ROOT)).toThrow(
        /undefined_setting/,
      );
    });
  });

  // ── AC6: Override precedence ─────────────────────────────────
  describe("AC6: Override precedence — workflow beats module beats global", () => {
    it("should use workflow value when same key exists at all three levels", () => {
      const global = { override_test: "global-value", shared: "global" };
      const module = { override_test: "module-value" };
      const workflow = { override_test: "workflow-value" };

      const resolved = resolveConfigChain(global, module, workflow);
      expect(resolved.override_test).toBe("workflow-value");
    });

    it("should use module value when key exists at global and module only", () => {
      const global = { override_test: "global-value" };
      const module = { override_test: "module-value" };
      const workflow = {};

      const resolved = resolveConfigChain(global, module, workflow);
      expect(resolved.override_test).toBe("module-value");
    });

    it("should use global value when key exists only at global level", () => {
      const global = { override_test: "global-value" };
      const module = {};
      const workflow = {};

      const resolved = resolveConfigChain(global, module, workflow);
      expect(resolved.override_test).toBe("global-value");
    });
  });
});
