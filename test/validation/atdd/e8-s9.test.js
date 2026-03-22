import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_DIR = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "val-refresh-ground-truth",
);
const MANIFEST_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "_config",
  "workflow-manifest.csv",
);

describe("E8-S9: val-refresh-ground-truth Workflow", () => {
  // AC1: Required workflow files exist
  describe("AC1: Workflow files created at correct path", () => {
    const requiredFiles = ["workflow.yaml", "instructions.xml", "checklist.md"];

    it.each(requiredFiles)("%s exists in workflow directory", (file) => {
      expect(
        existsSync(join(WORKFLOW_DIR, file)),
        `Missing file: val-refresh-ground-truth/${file}`,
      ).toBe(true);
    });
  });

  // AC2: Scan protocol covers all required inventory targets
  describe("AC2: Scan protocol inventories all targets", () => {
    it("instructions.xml references all 11 scan targets", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      expect(existsSync(instrPath)).toBe(true);

      const content = readFileSync(instrPath, "utf-8");

      const scanTargets = [
        { name: "lifecycle agents", pattern: /_gaia\/lifecycle\/agents\/\*\.md/ },
        { name: "lifecycle workflows", pattern: /_gaia\/lifecycle\/workflows\/\*/ },
        { name: "dev agents", pattern: /_gaia\/dev\/agents\/\*\.md/ },
        { name: "dev skills", pattern: /_gaia\/dev\/skills\/\*\.md/ },
        { name: "lifecycle skills", pattern: /_gaia\/lifecycle\/skills\/\*\.md/ },
        { name: "slash commands", pattern: /\.claude\/commands\/gaia-\*\.md/ },
        { name: "workflow manifest", pattern: /workflow-manifest\.csv/ },
        { name: "global.yaml", pattern: /global\.yaml/ },
        { name: "planning artifacts", pattern: /planning-artifacts/ },
        { name: "implementation artifacts", pattern: /implementation-artifacts/ },
        { name: "test artifacts", pattern: /test-artifacts/ },
      ];

      for (const target of scanTargets) {
        expect(
          content,
          `Missing scan target: ${target.name}`,
        ).toMatch(target.pattern);
      }
    });

    it("instructions.xml references asset types for inventory", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      const assetTypes = ["workflow", "agent", "skill", "command", "manifest"];
      for (const asset of assetTypes) {
        expect(content, `Missing asset type: ${asset}`).toContain(asset);
      }
    });
  });

  // AC3: Ground truth update reference
  describe("AC3: Ground truth update in validator-sidecar", () => {
    it("instructions.xml references ground-truth.md in validator-sidecar", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      expect(existsSync(instrPath)).toBe(true);

      const content = readFileSync(instrPath, "utf-8");
      expect(content).toMatch(/ground-truth/i);
      expect(content).toMatch(/validator-sidecar/i);
    });

    it("instructions.xml includes last-refresh timestamp in header", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();
      expect(content).toContain("last-refresh");
      expect(content).toContain("timestamp");
    });
  });

  // AC4: Manifest entry
  describe("AC4: Manifest entry exists", () => {
    it("workflow-manifest.csv contains val-refresh-ground-truth", () => {
      expect(existsSync(MANIFEST_PATH)).toBe(true);

      const content = readFileSync(MANIFEST_PATH, "utf-8");
      expect(content).toContain("val-refresh-ground-truth");
    });
  });

  // AC5: First-run initialization
  describe("AC5: First-run initialization", () => {
    it("instructions.xml handles missing validator-sidecar directory", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      expect(content).toContain("validator-sidecar");
      // Should reference creating the directory and memory files
      expect(content).toMatch(/ground-truth\.md/);
      expect(content).toMatch(/decision-log\.md/);
      expect(content).toMatch(/conversation-context\.md/);
    });
  });

  // AC6: REMOVED status for deleted files
  describe("AC6: Deleted file detection with REMOVED status", () => {
    it("instructions.xml specifies REMOVED marking for deleted files", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");

      expect(content).toMatch(/REMOVED/);
      expect(content).toMatch(/delet/i);
    });
  });

  // AC7: Diff/delta report
  describe("AC7: Diff/delta report with counts", () => {
    it("instructions.xml generates diff report with added/removed/updated counts", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      expect(content).toContain("added");
      expect(content).toContain("removed");
      expect(content).toContain("updated");
      expect(content).toMatch(/diff|delta|report/);
    });
  });

  // AC8: Report logged to decision-log.md
  describe("AC8: Report logged to decision-log.md", () => {
    it("instructions.xml logs report to decision-log.md", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");

      expect(content).toMatch(/decision-log\.md/);
    });
  });

  // AC9: Section-by-section progress
  describe("AC9: Progress shown during scan", () => {
    it("instructions.xml shows section-by-section progress", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      expect(content).toMatch(/progress/);
      expect(content).toMatch(/scanning|scan/);
    });
  });

  // AC10: Full vs incremental mode
  describe("AC10: Full and incremental refresh modes", () => {
    it("workflow.yaml supports --incremental parameter", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      expect(existsSync(workflowPath)).toBe(true);

      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/incremental/i);
    });

    it("instructions.xml handles both full and incremental modes", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      expect(content).toContain("full");
      expect(content).toContain("incremental");
    });
  });

  // AC11: JIT skill loading
  describe("AC11: JIT skill loading of ground-truth-management skill", () => {
    it("instructions.xml references ground-truth-management skill sections", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");

      const sections = [
        "full-refresh",
        "incremental-refresh",
        "entry-structure",
        "conflict-resolution",
        "token-budget",
      ];

      for (const section of sections) {
        expect(
          content,
          `Missing skill section reference: ${section}`,
        ).toContain(section);
      }
    });
  });

  // AC12: Standalone and sub-step invocation identical
  describe("AC12: No special-case invocation logic", () => {
    it("instructions.xml has no invocation-context branching", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();

      // Should NOT contain special-case logic for brownfield or caller context
      expect(content).not.toMatch(/if.*called.*from.*brownfield/);
      expect(content).not.toMatch(/if.*invoked.*as.*sub-step/);
    });
  });

  // Coverage gap: workflow.yaml structural correctness
  describe("Structural: workflow.yaml configuration fields", () => {
    it("workflow.yaml declares agent as validator", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/agent:\s*validator/);
    });

    it("workflow.yaml declares config_source referencing lifecycle config", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/config_source:.*lifecycle\/config\.yaml/);
    });

    it("workflow.yaml declares output pointing to ground-truth.md", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toMatch(/ground-truth\.md/);
    });

    it("workflow.yaml declares required_skill_sections for all 5 sections", () => {
      const workflowPath = join(WORKFLOW_DIR, "workflow.yaml");
      const content = readFileSync(workflowPath, "utf-8");
      const sections = [
        "full-refresh",
        "incremental-refresh",
        "entry-structure",
        "conflict-resolution",
        "token-budget",
      ];
      for (const section of sections) {
        expect(
          content,
          `Missing required_skill_section: ${section}`,
        ).toContain(section);
      }
    });
  });

  // Coverage gap: instructions.xml structural completeness
  describe("Structural: instructions.xml step completeness", () => {
    it("instructions.xml contains all 11 steps", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      // Count step tags with n attributes
      const stepMatches = content.match(/<step\s+n="/g);
      expect(stepMatches).not.toBeNull();
      expect(stepMatches.length).toBe(11);
    });

    it("instructions.xml has critical mandates section", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      expect(content).toMatch(/<critical>/);
      expect(content).toMatch(/<mandate>/);
    });

    it("instructions.xml has template-output referencing ground-truth.md", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8");
      expect(content).toMatch(/<template-output.*ground-truth\.md/);
    });

    it("instructions.xml has a token budget step", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();
      expect(content).toMatch(/token.budget/i);
    });

    it("instructions.xml has a compare/detect changes step with conflict resolution", () => {
      const instrPath = join(WORKFLOW_DIR, "instructions.xml");
      const content = readFileSync(instrPath, "utf-8").toLowerCase();
      expect(content).toContain("compare");
      expect(content).toContain("conflict-resolution");
    });
  });

  // Coverage gap: checklist.md structure validation
  describe("Structural: checklist.md completeness", () => {
    it("checklist.md covers all major workflow areas", () => {
      const checklistPath = join(WORKFLOW_DIR, "checklist.md");
      const content = readFileSync(checklistPath, "utf-8").toLowerCase();

      const areas = [
        "scan",
        "ground truth",
        "diff",
        "first-run",
        "skill",
        "manifest",
      ];
      for (const area of areas) {
        expect(
          content,
          `Checklist missing area: ${area}`,
        ).toContain(area);
      }
    });

    it("checklist.md uses checkbox format", () => {
      const checklistPath = join(WORKFLOW_DIR, "checklist.md");
      const content = readFileSync(checklistPath, "utf-8");
      const checkboxes = content.match(/- \[ \]/g);
      expect(checkboxes).not.toBeNull();
      expect(checkboxes.length).toBeGreaterThanOrEqual(5);
    });
  });
});
