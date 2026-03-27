import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const ADD_FEATURE_DIR = join(GAIA_DIR, "lifecycle", "workflows", "4-implementation", "add-feature");
const WORKFLOW_YAML = join(ADD_FEATURE_DIR, "workflow.yaml");
const INSTRUCTIONS_XML = join(ADD_FEATURE_DIR, "instructions.xml");
const CHECKLIST_MD = join(ADD_FEATURE_DIR, "checklist.md");
const SLASH_CMD = join(PROJECT_ROOT, ".claude", "commands", "gaia-add-feature.md");
const PM_AGENT = join(GAIA_DIR, "lifecycle", "agents", "pm.md");
const MANIFEST_CSV = join(GAIA_DIR, "_config", "workflow-manifest.csv");
const HELP_CSV = join(GAIA_DIR, "_config", "gaia-help.csv");
const PLANNING_ARTIFACTS = join(PROJECT_ROOT, "docs", "planning-artifacts");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function loadYaml(path) {
  const content = loadFile(path);
  if (!content) return null;
  return yaml.load(content);
}

describe("E10-S5: Add-Feature Triage Workflow", () => {
  // AC1: workflow.yaml + instructions.xml + checklist.md created in
  //      _gaia/lifecycle/workflows/4-implementation/add-feature/
  describe("AC1: Workflow files exist", () => {
    it("test_ac1_workflow_yaml — workflow.yaml exists in add-feature directory", () => {
      expect(existsSync(WORKFLOW_YAML)).toBe(true);
    });

    it("test_ac1_instructions_xml — instructions.xml exists in add-feature directory", () => {
      expect(existsSync(INSTRUCTIONS_XML)).toBe(true);
    });

    it("test_ac1_checklist_md — checklist.md exists in add-feature directory", () => {
      expect(existsSync(CHECKLIST_MD)).toBe(true);
    });
  });

  // AC2: 10-step flow: Intake → Classify → Impact Scan → Val Review →
  //      User Approval → CR Record (conditional) → Cascade → Story →
  //      Assessment Doc → Next Steps
  describe("AC2: 10-step instruction flow", () => {
    it("test_ac2_step_count — instructions.xml contains exactly 10 steps", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const steps = content.match(/<step\s+n="/g);
      expect(steps).not.toBeNull();
      expect(steps.length).toBe(10);
    });

    it("test_ac2_intake_step — step 1 handles intake/description collection", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step1 = content.match(/<step\s+n="1"[\s\S]*?<\/step>/);
      expect(step1).not.toBeNull();
      expect(step1[0]).toMatch(/[Ii]ntake/);
    });

    it("test_ac2_classify_step — step 2 classifies as patch/enhancement/feature", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step2 = content.match(/<step\s+n="2"[\s\S]*?<\/step>/);
      expect(step2).not.toBeNull();
      expect(step2[0]).toMatch(/[Cc]lassif/);
      expect(step2[0]).toMatch(/patch/i);
      expect(step2[0]).toMatch(/enhancement/i);
      expect(step2[0]).toMatch(/feature/i);
    });

    it("test_ac2_impact_scan — step 3 performs impact scan", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step3 = content.match(/<step\s+n="3"[\s\S]*?<\/step>/);
      expect(step3).not.toBeNull();
      expect(step3[0]).toMatch(/[Ii]mpact/i);
    });

    it("test_ac2_val_review — step 4 invokes Val review", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step4 = content.match(/<step\s+n="4"[\s\S]*?<\/step>/);
      expect(step4).not.toBeNull();
      expect(step4[0]).toMatch(/[Vv]al/);
    });

    it("test_ac2_user_approval — step 5 requires user approval", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step5 = content.match(/<step\s+n="5"[\s\S]*?<\/step>/);
      expect(step5).not.toBeNull();
      expect(step5[0]).toMatch(/[Aa]pprov/);
    });

    it("test_ac2_cr_record — step 6 handles CR record conditionally", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step6 = content.match(/<step\s+n="6"[\s\S]*?<\/step>/);
      expect(step6).not.toBeNull();
      expect(step6[0]).toMatch(/[Cc]hange.*[Rr]equest|CR/);
    });

    it("test_ac2_cascade — step 7 runs cascade through affected artifacts", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step7 = content.match(/<step\s+n="7"[\s\S]*?<\/step>/);
      expect(step7).not.toBeNull();
      expect(step7[0]).toMatch(/[Cc]ascade/);
    });

    it("test_ac2_story — step 8 creates/updates story", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step8 = content.match(/<step\s+n="8"[\s\S]*?<\/step>/);
      expect(step8).not.toBeNull();
      expect(step8[0]).toMatch(/[Ss]tory/);
    });

    it("test_ac2_assessment_doc — step 9 generates assessment document", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step9 = content.match(/<step\s+n="9"[\s\S]*?<\/step>/);
      expect(step9).not.toBeNull();
      expect(step9[0]).toMatch(/[Aa]ssessment/);
    });

    it("test_ac2_next_steps — step 10 provides next steps", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const step10 = content.match(/<step\s+n="10"[\s\S]*?<\/step>/);
      expect(step10).not.toBeNull();
      expect(step10[0]).toMatch(/[Nn]ext/);
    });
  });

  // AC3: Cascade follows corrected lifecycle order:
  //      PRD → UX → Architecture → Test Plan → Threat Model → Traceability
  describe("AC3: Cascade lifecycle order", () => {
    it("test_ac3_cascade_order — cascade step lists artifacts in correct lifecycle order", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Find the cascade step and verify order
      const cascadeStep = content.match(/<step\s+n="7"[\s\S]*?<\/step>/);
      expect(cascadeStep).not.toBeNull();
      const cascade = cascadeStep[0];
      const prdIdx = cascade.search(/PRD|prd|product.requirements/i);
      const uxIdx = cascade.search(/UX|ux.design/i);
      const archIdx = cascade.search(/[Aa]rchitecture/);
      const testIdx = cascade.search(/[Tt]est.[Pp]lan/);
      const threatIdx = cascade.search(/[Tt]hreat.[Mm]odel/);
      const traceIdx = cascade.search(/[Tt]raceability/);
      // All must be present
      expect(prdIdx).toBeGreaterThan(-1);
      expect(uxIdx).toBeGreaterThan(-1);
      expect(archIdx).toBeGreaterThan(-1);
      expect(testIdx).toBeGreaterThan(-1);
      expect(threatIdx).toBeGreaterThan(-1);
      expect(traceIdx).toBeGreaterThan(-1);
      // Order must be: PRD < UX < Arch < Test < Threat < Trace
      expect(prdIdx).toBeLessThan(uxIdx);
      expect(uxIdx).toBeLessThan(archIdx);
      expect(archIdx).toBeLessThan(testIdx);
      expect(testIdx).toBeLessThan(threatIdx);
      expect(threatIdx).toBeLessThan(traceIdx);
    });
  });

  // AC4: Each cascade step spawns owning agent's workflow as subagent
  describe("AC4: Cascade spawns subagents", () => {
    it("test_ac4_subagent_invocations — cascade step uses invoke-workflow or invoke-task for each artifact", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      const cascadeStep = content.match(/<step\s+n="7"[\s\S]*?<\/step>/);
      expect(cascadeStep).not.toBeNull();
      const cascade = cascadeStep[0];
      // Must invoke workflows as subagents
      expect(cascade).toMatch(/invoke-workflow|invoke-task|subagent/i);
    });

    it("test_ac4_owning_agents — cascade invokes the owning agent for each artifact type", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference the owning workflows: edit-prd, create-ux/edit-ux, edit-arch, test-design, threat-model, traceability
      expect(content).toMatch(/edit-prd|gaia-edit-prd/);
      expect(content).toMatch(/ux|gaia-create-ux|gaia-edit-ux/i);
      expect(content).toMatch(/edit-arch|gaia-edit-arch|gaia-create-arch/);
      expect(content).toMatch(/test-design|gaia-test-design/);
      expect(content).toMatch(/threat-model|gaia-threat-model/);
      expect(content).toMatch(/trac|gaia-trace/);
    });
  });

  // AC5: Only AFFECTED artifacts are processed — patches skip most steps
  describe("AC5: Patch classification skips cascade steps", () => {
    it("test_ac5_patch_skip — patches skip most cascade steps", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must contain conditional logic for patch classification
      expect(content).toMatch(/patch/i);
      // Must have skip/conditional logic tied to classification
      expect(content).toMatch(/skip|conditional|if.*patch|patch.*skip/i);
    });

    it("test_ac5_affected_only — only affected artifacts are processed", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Impact scan determines affected artifacts
      expect(content).toMatch(/affected|impact/i);
    });
  });

  // AC6: Supports --yolo parameter (FR-90) — auto-proceeds except CRITICAL Val findings
  describe("AC6: YOLO mode support", () => {
    it("test_ac6_yolo_parameter — workflow.yaml or instructions reference yolo mode", () => {
      const wfContent = loadFile(WORKFLOW_YAML);
      const instrContent = loadFile(INSTRUCTIONS_XML);
      expect(wfContent).not.toBeNull();
      const combined = (wfContent || "") + (instrContent || "");
      expect(combined).toMatch(/yolo/i);
    });

    it("test_ac6_critical_val_halt — CRITICAL Val findings halt even in yolo mode", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/CRITICAL/);
      // Must halt or pause on critical
      expect(content).toMatch(/halt|pause|stop|block/i);
    });
  });

  // AC7: Slash command created at {project-path}/.claude/commands/gaia-add-feature.md
  describe("AC7: Slash command file", () => {
    it("test_ac7_slash_command_exists — gaia-add-feature.md exists in .claude/commands/", () => {
      expect(existsSync(SLASH_CMD)).toBe(true);
    });

    it("test_ac7_slash_command_references_workflow — slash command points to add-feature workflow", () => {
      const content = loadFile(SLASH_CMD);
      expect(content).not.toBeNull();
      expect(content).toMatch(/add-feature/);
    });
  });

  // AC8: Added to PM menu, workflow-manifest.csv, gaia-help.csv
  describe("AC8: Registration in PM menu, manifest, and help", () => {
    it("test_ac8_pm_menu — PM agent menu includes add-feature", () => {
      const content = loadFile(PM_AGENT);
      expect(content).not.toBeNull();
      expect(content).toMatch(/add-feature|add.feature/i);
    });

    it("test_ac8_workflow_manifest — workflow-manifest.csv includes gaia-add-feature", () => {
      const content = loadFile(MANIFEST_CSV);
      expect(content).not.toBeNull();
      expect(content).toMatch(/gaia-add-feature|add-feature/);
    });

    it("test_ac8_gaia_help — gaia-help.csv includes gaia-add-feature", () => {
      const content = loadFile(HELP_CSV);
      expect(content).not.toBeNull();
      expect(content).toMatch(/gaia-add-feature|add-feature/);
    });
  });

  // AC9: Assessment document saved to {planning_artifacts}/add-feature-{feature_id}.md
  describe("AC9: Assessment document output path", () => {
    it("test_ac9_output_path — workflow.yaml declares output to planning-artifacts with add-feature prefix", () => {
      const wf = loadYaml(WORKFLOW_YAML);
      expect(wf).not.toBeNull();
      expect(wf.output).toBeDefined();
      const outputPath = typeof wf.output === "string" ? wf.output : wf.output.primary || "";
      expect(outputPath).toMatch(/planning.artifacts/);
      expect(outputPath).toMatch(/add-feature/);
    });

    it("test_ac9_template_output — instructions.xml has template-output for assessment doc", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      expect(content).toMatch(/<template-output/);
      expect(content).toMatch(/add-feature/);
      expect(content).toMatch(/assessment/i);
    });
  });
});
