import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";
import {
  getWorkflowPaths,
  VALID_VARIABLE_REFS,
  resolveVariable,
} from "../helpers/workflow-paths.js";

// Project root is where _gaia/ lives
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

describe("Workflow Definition Validation (FR-30)", () => {
  const workflowFiles = getWorkflowPaths(PROJECT_ROOT);

  it("should find workflow.yaml files", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it("should exclude _backups/ directory from discovery", () => {
    const backupFiles = workflowFiles.filter((f) => f.includes("_backups"));
    expect(
      backupFiles,
      "Backup workflow files should be excluded from validation scope",
    ).toHaveLength(0);
  });

  describe.each(workflowFiles)("%s", (workflowPath) => {
    let config;

    try {
      const content = readFileSync(workflowPath, "utf8");
      config = yaml.load(content);
    } catch {
      config = null;
    }

    it("should parse as valid YAML", () => {
      expect(
        config,
        `YAML parse error (workflow: ${workflowPath})`,
      ).not.toBeNull();
    });

    it("should have a name field", () => {
      expect(
        config?.name,
        `Missing name field (workflow: ${workflowPath})`,
      ).toBeTruthy();
    });

    it("should have an instructions field", () => {
      expect(
        config?.instructions,
        `Missing instructions field (workflow: ${workflowPath})`,
      ).toBeTruthy();
    });

    it("should reference an existing instructions file or directory", () => {
      if (!config?.instructions) return;
      const resolvedPath = resolveVariable(
        config.instructions,
        workflowPath,
        config,
        PROJECT_ROOT,
      );
      expect(
        existsSync(resolvedPath),
        `Instructions not found: ${resolvedPath} (workflow: ${workflowPath})`,
      ).toBe(true);
    });

    it("should reference an existing agent file (if agent declared)", () => {
      if (!config?.agent || config.agent === "orchestrator") return;
      if (config.agent === "dev-*") return;

      const module = config.module || "lifecycle";
      const agentPath = join(
        PROJECT_ROOT,
        "_gaia",
        module,
        "agents",
        `${config.agent}.md`,
      );
      expect(
        existsSync(agentPath),
        `Agent file not found: ${agentPath} (workflow: ${workflowPath})`,
      ).toBe(true);
    });

    it("should reference an existing config_source file (if declared)", () => {
      if (!config?.config_source) return;
      const resolvedPath = resolveVariable(
        config.config_source,
        workflowPath,
        config,
        PROJECT_ROOT,
      );
      expect(
        existsSync(resolvedPath),
        `config_source not found: ${resolvedPath} (workflow: ${workflowPath})`,
      ).toBe(true);
    });

    it("should reference an existing validation/checklist file (if declared)", () => {
      if (!config?.validation) return;
      const resolvedPath = resolveVariable(
        config.validation,
        workflowPath,
        config,
        PROJECT_ROOT,
      );
      expect(
        existsSync(resolvedPath),
        `Validation file not found: ${resolvedPath} (workflow: ${workflowPath})`,
      ).toBe(true);
    });

    it("should have valid quality_gates structure (if declared)", () => {
      if (!config?.quality_gates) return;

      const gates = [
        ...(config.quality_gates.pre_start || []),
        ...(config.quality_gates.post_complete || []),
      ];

      for (const gate of gates) {
        expect(
          gate.check,
          `quality_gates entry missing 'check' field (workflow: ${workflowPath})`,
        ).toBeTruthy();
        expect(
          gate.on_fail,
          `quality_gates entry missing 'on_fail' field (workflow: ${workflowPath})`,
        ).toBeTruthy();
      }
    });

    it("should use only valid variable references in output.primary (if declared)", () => {
      if (!config?.output?.primary) return;

      const varRefs = config.output.primary.match(/\{[^}]+\}/g) || [];
      for (const ref of varRefs) {
        expect(
          VALID_VARIABLE_REFS,
          `Invalid variable reference '${ref}' in output.primary (workflow: ${workflowPath})`,
        ).toContain(ref);
      }
    });
  });
});
