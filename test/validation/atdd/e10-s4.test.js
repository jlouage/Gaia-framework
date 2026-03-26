import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const EDIT_UX_DIR = join(
  GAIA_DIR,
  "lifecycle",
  "workflows",
  "2-planning",
  "edit-ux-design",
);
const WORKFLOW_YAML = join(EDIT_UX_DIR, "workflow.yaml");
const INSTRUCTIONS_XML = join(EDIT_UX_DIR, "instructions.xml");
const CHECKLIST_MD = join(EDIT_UX_DIR, "checklist.md");
const SLASH_CMD = join(PROJECT_ROOT, ".claude", "commands", "gaia-edit-ux.md");
const UX_AGENT = join(GAIA_DIR, "lifecycle", "agents", "ux-designer.md");
const MANIFEST_CSV = join(GAIA_DIR, "_config", "workflow-manifest.csv");
const HELP_CSV = join(GAIA_DIR, "_config", "gaia-help.csv");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function loadYaml(path) {
  const content = loadFile(path);
  if (!content) return null;
  return yaml.load(content);
}

describe("E10-S4: Create edit-ux Workflow", () => {
  // AC1: workflow.yaml + instructions.xml + checklist.md exist in
  //      _gaia/lifecycle/workflows/2-planning/edit-ux-design/
  describe("AC1: Workflow files exist", () => {
    it("test_ac1_workflow_yaml — workflow.yaml exists in edit-ux-design directory", () => {
      expect(existsSync(WORKFLOW_YAML)).toBe(true);
    });

    it("test_ac1_instructions_xml — instructions.xml exists in edit-ux-design directory", () => {
      expect(existsSync(INSTRUCTIONS_XML)).toBe(true);
    });

    it("test_ac1_checklist_md — checklist.md exists in edit-ux-design directory", () => {
      expect(existsSync(CHECKLIST_MD)).toBe(true);
    });

    it("test_ac1_workflow_yaml_valid — workflow.yaml parses as valid YAML", () => {
      const wf = loadYaml(WORKFLOW_YAML);
      expect(wf).not.toBeNull();
      expect(wf.name).toBe("edit-ux-design");
    });

    it("test_ac1_workflow_agent — workflow.yaml declares ux-designer agent", () => {
      const wf = loadYaml(WORKFLOW_YAML);
      expect(wf).not.toBeNull();
      expect(wf.agent).toBe("ux-designer");
    });

    it("test_ac1_workflow_module — workflow.yaml declares lifecycle module", () => {
      const wf = loadYaml(WORKFLOW_YAML);
      expect(wf).not.toBeNull();
      expect(wf.module).toBe("lifecycle");
    });
  });

  // AC2: Christy's menu includes /gaia-edit-ux
  describe("AC2: UX Designer agent menu", () => {
    it("test_ac2_christy_menu — ux-designer.md menu includes edit-ux-design workflow", () => {
      const content = loadFile(UX_AGENT);
      expect(content).not.toBeNull();
      expect(content).toMatch(/edit-ux-design/);
    });

    it("test_ac2_christy_menu_label — menu item has Edit UX Design label", () => {
      const content = loadFile(UX_AGENT);
      expect(content).not.toBeNull();
      expect(content).toMatch(/Edit UX Design/);
    });
  });

  // AC3: Edit workflow consumes existing ux-design.md, applies changes, preserves unchanged content
  describe("AC3: Consume-and-edit logic", () => {
    it("test_ac3_loads_existing — instructions.xml loads existing ux-design.md", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/ux-design\.md/);
    });

    it("test_ac3_preserves_content — instructions.xml mandates preserving unchanged content", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/[Pp]reserve/);
    });

    it("test_ac3_apply_changes — instructions.xml has steps to apply user-requested changes", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/[Aa]pply|[Ee]dit/);
    });

    it("test_ac3_input_pattern — workflow.yaml declares ux-design.md as input", () => {
      const wf = loadYaml(WORKFLOW_YAML);
      expect(wf).not.toBeNull();
      expect(wf.input_file_patterns).toBeDefined();
      const patterns = JSON.stringify(wf.input_file_patterns);
      expect(patterns).toMatch(/ux-design\.md/);
    });
  });

  // AC4: val_validate_output flag is set to true
  describe("AC4: Val validate output flag", () => {
    it("test_ac4_val_flag — workflow.yaml has val_validate_output set to true", () => {
      const wf = loadYaml(WORKFLOW_YAML);
      expect(wf).not.toBeNull();
      expect(wf.val_validate_output).toBe(true);
    });
  });

  // AC5: Slash command exists at {project-path}/.claude/commands/gaia-edit-ux.md
  describe("AC5: Slash command file", () => {
    it("test_ac5_slash_command_exists — gaia-edit-ux.md exists in .claude/commands/", () => {
      expect(existsSync(SLASH_CMD)).toBe(true);
    });

    it("test_ac5_slash_command_references_workflow — slash command points to edit-ux-design workflow", () => {
      const content = loadFile(SLASH_CMD);
      expect(content).not.toBeNull();
      expect(content).toMatch(/edit-ux-design/);
    });
  });

  // AC6: Listed in workflow-manifest.csv and gaia-help.csv
  describe("AC6: Manifest and help entries", () => {
    it("test_ac6_workflow_manifest — workflow-manifest.csv includes edit-ux entry", () => {
      const content = loadFile(MANIFEST_CSV);
      expect(content).not.toBeNull();
      expect(content).toMatch(/edit-ux-design/);
      expect(content).toMatch(/gaia-edit-ux/);
    });

    it("test_ac6_gaia_help — gaia-help.csv includes edit-ux entry", () => {
      const content = loadFile(HELP_CSV);
      expect(content).not.toBeNull();
      expect(content).toMatch(/edit-ux/);
      expect(content).toMatch(/gaia-edit-ux/);
    });

    it("test_ac6_manifest_agent — manifest entry assigns ux-designer agent", () => {
      const content = loadFile(MANIFEST_CSV);
      expect(content).not.toBeNull();
      const editUxLine = content.split("\n").find((l) => l.includes("edit-ux-design"));
      expect(editUxLine).toBeDefined();
      expect(editUxLine).toMatch(/ux-designer/);
    });
  });
});
