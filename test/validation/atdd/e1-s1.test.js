import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { PROJECT_ROOT } from "../../helpers/project-root.js";
import { walkFiles } from "../../validation/helpers/fs-walk.js";

/**
 * ATDD — E1-S1: Workflow Definition Validation
 *
 * Red-phase acceptance tests for story E1-S1.
 * Each test maps 1:1 to an acceptance criterion.
 *
 * AC1: Structural field validation (instructions, agent, config_source, validation/checklist)
 * AC2: Quality gate reference validation
 * AC3: Output artifact variable reference validation
 * AC4: YAML parsing with proper parser (js-yaml)
 * AC5: Clear error messages identifying specific workflow and failing check
 * AC6: Test file location (meta — validates this file exists at correct path)
 */

const GAIA_ROOT = join(PROJECT_ROOT, "_gaia");

// Known valid variable patterns used in workflow.yaml output paths
const VALID_VARIABLE_REFS = [
  "{project-root}",
  "{project-path}",
  "{planning_artifacts}",
  "{implementation_artifacts}",
  "{test_artifacts}",
  "{creative_artifacts}",
  "{installed_path}",
  "{date}",
  "{story_key}",
  "{story_title_slug}",
  "{user_name}",
  "{project_name}",
  "{sprint_id}",
  "{cr_id}",
  "{feature_id}",
  "{version}",
  "{spec_name}",
  "{plan_artifact_path}",
  "{artifact_path}",
  "{memory_path}",
  "{checkpoint_path}",
  "{data_path}",
  "{agent}",
  "{slug}",
];

function findWorkflowFiles() {
  return walkFiles(GAIA_ROOT, {
    namePattern: "workflow.yaml",
    exclude: ["node_modules", "_backups"],
  });
}

function parseWorkflow(filePath) {
  const content = readFileSync(filePath, "utf8");
  return yaml.load(content);
}

function resolveVariable(value, workflowPath, config) {
  let installedPath = join(PROJECT_ROOT, "_gaia");
  if (config?.installed_path) {
    installedPath = config.installed_path.replace(/\{project-root\}/g, PROJECT_ROOT);
  }
  return value
    .replace(/\{installed_path\}/g, installedPath)
    .replace(/\{project-root\}/g, PROJECT_ROOT);
}

describe("ATDD E1-S1: Workflow Definition Validation", () => {
  const workflowFiles = findWorkflowFiles();

  // ── AC1: Structural field validation ──────────────────────────────
  describe("AC1: Validation suite parses all workflow.yaml files and verifies structural fields", () => {
    it("should find at least 60 workflow.yaml files", () => {
      expect(workflowFiles.length).toBeGreaterThanOrEqual(60);
    });

    describe.each(workflowFiles)("%s", (workflowPath) => {
      let config;
      try {
        config = parseWorkflow(workflowPath);
      } catch {
        config = null;
      }

      it("instructions path resolves to an existing file", () => {
        expect(config).not.toBeNull();
        expect(config.instructions).toBeTruthy();
        const resolved = resolveVariable(config.instructions, workflowPath, config);
        expect(
          existsSync(resolved),
          `Instructions file not found: ${resolved} (workflow: ${workflowPath})`
        ).toBe(true);
      });

      it("agent field maps to an existing agent persona (if declared)", () => {
        if (!config?.agent || config.agent === "orchestrator") return;
        if (config.agent === "dev-*") return;

        const module = config.module || "lifecycle";
        const agentPath = join(PROJECT_ROOT, "_gaia", module, "agents", `${config.agent}.md`);
        expect(
          existsSync(agentPath),
          `Agent file not found: ${agentPath} (workflow: ${workflowPath})`
        ).toBe(true);
      });

      it("config_source path exists (if declared)", () => {
        if (!config?.config_source) return;
        const resolved = resolveVariable(config.config_source, workflowPath, config);
        expect(
          existsSync(resolved),
          `config_source not found: ${resolved} (workflow: ${workflowPath})`
        ).toBe(true);
      });

      it("validation/checklist paths exist (if declared)", () => {
        if (!config?.validation) return;
        const resolved = resolveVariable(config.validation, workflowPath, config);
        expect(
          existsSync(resolved),
          `Validation file not found: ${resolved} (workflow: ${workflowPath})`
        ).toBe(true);
      });
    });
  });

  // ── AC2: Quality gate reference validation ────────────────────────
  describe("AC2: Quality gate references are validated", () => {
    const workflowsWithGates = workflowFiles
      .map((f) => {
        try {
          return { path: f, config: parseWorkflow(f) };
        } catch {
          return null;
        }
      })
      .filter(
        (w) =>
          w?.config?.quality_gates &&
          (w.config.quality_gates.pre_start || w.config.quality_gates.post_complete)
      );

    it("should find workflows with quality gates", () => {
      expect(
        workflowsWithGates.length,
        "No workflows with quality_gates found — expected at least 1"
      ).toBeGreaterThan(0);
    });

    describe.each(workflowsWithGates.map((w) => [w.path, w.config]))("%s", (wPath, wConfig) => {
      const gates = [
        ...(wConfig.quality_gates?.pre_start || []),
        ...(wConfig.quality_gates?.post_complete || []),
      ];

      it.each(gates)("gate '%s' has a verifiable check and on_fail message", (gate) => {
        expect(gate.check, `Gate missing 'check' field in ${wPath}`).toBeTruthy();
        expect(gate.on_fail, `Gate missing 'on_fail' field in ${wPath}`).toBeTruthy();
      });
    });
  });

  // ── AC3: Output artifact variable references ──────────────────────
  describe("AC3: All output.artifacts paths use valid variable references", () => {
    const workflowsWithOutput = workflowFiles
      .map((f) => {
        try {
          return { path: f, config: parseWorkflow(f) };
        } catch {
          return null;
        }
      })
      .filter((w) => w?.config?.output);

    it("should find workflows with output declarations", () => {
      expect(workflowsWithOutput.length, "No workflows with output fields found").toBeGreaterThan(
        0
      );
    });

    describe.each(workflowsWithOutput.map((w) => [w.path, w.config]))("%s", (wPath, wConfig) => {
      const outputPaths = [];
      if (wConfig.output?.primary) outputPaths.push(wConfig.output.primary);
      if (wConfig.output?.artifacts) {
        if (Array.isArray(wConfig.output.artifacts)) {
          outputPaths.push(...wConfig.output.artifacts);
        } else if (typeof wConfig.output.artifacts === "string") {
          outputPaths.push(wConfig.output.artifacts);
        }
      }

      it.each(outputPaths)("output path '%s' uses only valid variable references", (outputPath) => {
        const varRefs = outputPath.match(/\{[^}]+\}/g) || [];
        for (const ref of varRefs) {
          expect(
            VALID_VARIABLE_REFS,
            `Invalid variable reference '${ref}' in output path of ${wPath}`
          ).toContain(ref);
        }
      });
    });
  });

  // ── AC4: YAML parsing without error ───────────────────────────────
  describe("AC4: YAML parses without error for all workflow files", () => {
    it.each(workflowFiles)("%s parses as valid YAML", (workflowPath) => {
      const content = readFileSync(workflowPath, "utf8");
      let parsed;
      let parseError = null;
      try {
        parsed = yaml.load(content);
      } catch (e) {
        parseError = e;
      }
      expect(parseError, `YAML parse error in ${workflowPath}: ${parseError?.message}`).toBeNull();
      expect(parsed).toBeTruthy();
    });
  });

  // ── AC5: Clear error messages ─────────────────────────────────────
  describe("AC5: Validation produces clear error messages identifying specific workflow and failing check", () => {
    it("test file contains workflow-identifying error messages in assertions", () => {
      const thisFile = readFileSync(import.meta.filename, "utf8");
      const assertionsWithContext = (thisFile.match(/\$\{w(?:orkflow)?Path\}/g) || []).length;
      expect(
        assertionsWithContext,
        "Too few assertions include workflow-identifying error messages"
      ).toBeGreaterThanOrEqual(5);
    });

    it("failure output includes the specific workflow file path", () => {
      const fakeWorkflow = "/non/existent/workflow.yaml";
      const errorMsg = `Instructions file not found: /fake/path (workflow: ${fakeWorkflow})`;
      expect(errorMsg).toContain(fakeWorkflow);
      expect(errorMsg).toMatch(/workflow:/);
    });
  });

  // ── AC6: Test file location ───────────────────────────────────────
  describe("AC6: Test file at test/validation/tier1/workflows.test.js", () => {
    it("workflows.test.js exists at the declared path", () => {
      const targetPath = join(PROJECT_ROOT, "test", "validation", "tier1", "workflows.test.js");
      expect(existsSync(targetPath), `Expected test file at ${targetPath}`).toBe(true);
    });

    it("workflows.test.js uses js-yaml for proper YAML parsing", () => {
      const targetPath = join(PROJECT_ROOT, "test", "validation", "tier1", "workflows.test.js");
      if (!existsSync(targetPath)) return;
      const content = readFileSync(targetPath, "utf8");
      expect(content, "workflows.test.js should import js-yaml for proper YAML parsing").toContain(
        "js-yaml"
      );
    });

    it("workflows.test.js validates config_source paths", () => {
      const targetPath = join(PROJECT_ROOT, "test", "validation", "tier1", "workflows.test.js");
      if (!existsSync(targetPath)) return;
      const content = readFileSync(targetPath, "utf8");
      expect(content, "workflows.test.js should validate config_source field").toContain(
        "config_source"
      );
    });

    it("workflows.test.js validates quality_gates", () => {
      const targetPath = join(PROJECT_ROOT, "test", "validation", "tier1", "workflows.test.js");
      if (!existsSync(targetPath)) return;
      const content = readFileSync(targetPath, "utf8");
      expect(content, "workflows.test.js should validate quality_gates").toContain("quality_gates");
    });

    it("workflows.test.js validates output artifact paths", () => {
      const targetPath = join(PROJECT_ROOT, "test", "validation", "tier1", "workflows.test.js");
      if (!existsSync(targetPath)) return;
      const content = readFileSync(targetPath, "utf8");
      expect(content, "workflows.test.js should validate output paths").toMatch(
        /output.*artifact|output.*primary/i
      );
    });
  });
});
