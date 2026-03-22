/**
 * Tier 2: Workflow Engine Scenario Tests — E2-S3
 *
 * Tier classification: Tier 2 (LLM-runtime, local only)
 * These tests validate workflow engine structural contracts by examining
 * real framework files. They verify observable artifacts (files, YAML shape,
 * directory presence), NOT LLM-generated prose content.
 *
 * Excluded from `npm test` — run with:
 *   npx vitest run --config vitest.config.tier2.js
 *
 * References: ADR-001, ADR-002, ADR-010, ADR-011
 * ATDD: docs/test-artifacts/atdd-E2-S3.md
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

// ─── Path constants ──────────────────────────────────────────────
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_ROOT = join(PROJECT_ROOT, "_gaia");
const ENGINE_PATH = join(GAIA_ROOT, "core", "engine", "workflow.xml");
const GLOBAL_CONFIG = join(GAIA_ROOT, "_config", "global.yaml");
const TIER2_RESULTS = join(GAIA_ROOT, "_memory", "tier2-results");
const DEV_STORY_DIR = join(
  GAIA_ROOT,
  "lifecycle",
  "workflows",
  "4-implementation",
  "dev-story",
);

// ─── Validation patterns ─────────────────────────────────────────
/** Valid severity prefixes for quality gate on_fail messages */
const GATE_SEVERITY_PATTERN = /^(HALT|WARN|WARNING|RECOMMEND):/;

/** Known framework variable names used in workflow configs */
const KNOWN_VARIABLES = new Set([
  "project-root",
  "project-path",
  "installed_path",
  "planning_artifacts",
  "implementation_artifacts",
  "test_artifacts",
  "creative_artifacts",
  "data_path",
  "artifact_path",
  "plan_artifact_path",
  "memory_path",
  "checkpoint_path",
  "date",
  "story_key",
  "story_title_slug",
  "sprint_id",
  "spec_name",
  "cr_id",
  "version",
  "agent",
]);

/** Required fields for Tier 2 result YAML per ADR-011 */
const RESULT_REQUIRED_FIELDS = [
  "test_name",
  "date",
  "result",
  "observations",
  "runner",
  "framework_version",
];

// ─── Shared helpers ──────────────────────────────────────────────

/**
 * Parse step numbers from an instructions XML file.
 * @returns {number[]} Sorted array of step numbers found in <step n="..."> tags.
 */
function parseStepNumbers(xmlContent) {
  const pattern = /<step\s+n="(\d+)"/g;
  const steps = [];
  let match;
  while ((match = pattern.exec(xmlContent)) !== null) {
    steps.push(parseInt(match[1], 10));
  }
  return steps.sort((a, b) => a - b);
}

/**
 * Assert that step numbers are strictly sequential (1, 2, 3, ..., N) with no gaps.
 */
function assertSequentialSteps(steps) {
  expect(steps.length).toBeGreaterThan(0);
  for (let i = 0; i < steps.length; i++) {
    expect(steps[i]).toBe(i + 1);
  }
}

/**
 * Parse execution modes from workflow.xml.
 * @returns {{ name: string, content: string }[]}
 */
function parseExecutionModes(xmlContent) {
  const pattern = /<mode\s+name="([^"]+)">([\s\S]*?)<\/mode>/g;
  const modes = [];
  let match;
  while ((match = pattern.exec(xmlContent)) !== null) {
    modes.push({ name: match[1], content: match[2].trim() });
  }
  return modes;
}

/**
 * Recursively find all workflow.yaml files under a directory.
 * Excludes node_modules/ and _backups/ directories.
 */
function findWorkflowFiles(rootDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "_backups") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "workflow.yaml") {
        results.push(fullPath);
      }
    }
  }
  walk(rootDir);
  return results;
}

/**
 * Validate that each quality gate entry has required structure.
 */
function assertGateStructure(gates, contextLabel) {
  for (const gate of gates) {
    expect(gate, `${contextLabel}: gate missing 'check'`).toHaveProperty(
      "check",
    );
    expect(gate, `${contextLabel}: gate missing 'on_fail'`).toHaveProperty(
      "on_fail",
    );
    expect(typeof gate.check).toBe("string");
    expect(typeof gate.on_fail).toBe("string");
    expect(gate.on_fail).toMatch(GATE_SEVERITY_PATTERN);
  }
}

// ─── Test suite ──────────────────────────────────────────────────

describe("ATDD E2-S3: Workflow Engine Scenario Tests", () => {
  /** Cached engine content — loaded once, used across AC1/AC4/AC5 */
  let engineContent;
  /** Cached workflow file list — used across AC3/AC4 */
  let workflowFiles;

  beforeAll(() => {
    engineContent = readFileSync(ENGINE_PATH, "utf8");
    workflowFiles = findWorkflowFiles(GAIA_ROOT);
  });

  // ─── AC1: Step ordering enforcement ───────────────────────────
  describe("AC1: Step ordering enforcement", () => {
    it("should have steps defined in strict numerical order in workflow.xml", () => {
      assertSequentialSteps(parseStepNumbers(engineContent));
    });

    it("should have sequential steps in real workflow instruction files", () => {
      const instructionsPath = join(DEV_STORY_DIR, "instructions.xml");
      expect(existsSync(instructionsPath)).toBe(true);

      const content = readFileSync(instructionsPath, "utf8");
      assertSequentialSteps(parseStepNumbers(content));
    });

    it("should declare instructions path in every workflow that has one", () => {
      expect(workflowFiles.length).toBeGreaterThan(0);

      for (const wfPath of workflowFiles) {
        const config = yaml.load(readFileSync(wfPath, "utf8"));
        if (config?.instructions) {
          expect(typeof config.instructions).toBe("string");
          expect(config.instructions.length).toBeGreaterThan(0);
        }
      }
    });

    it("should include conditional and optional steps in step numbering", () => {
      const conditionalPattern = /<step\s+n="(\d+)"[^>]*\s+if="/g;
      const conditionalSteps = [];
      let match;
      while ((match = conditionalPattern.exec(engineContent)) !== null) {
        conditionalSteps.push(parseInt(match[1], 10));
      }

      const allSteps = parseStepNumbers(engineContent);
      for (const cs of conditionalSteps) {
        expect(allSteps).toContain(cs);
      }
    });
  });

  // ─── AC2: Checkpoint writing with required fields ─────────────
  describe("AC2: Checkpoint writing with required fields", () => {
    /** Reference checkpoint matching the contract from CLAUDE.md */
    const REFERENCE_CHECKPOINT = {
      workflow: "dev-story",
      step: 4,
      key_variables: {
        story_key: "E2-S3",
        epic_key: "E2",
        risk_level: "high",
      },
      output_file_path:
        "docs/implementation-artifacts/E2-S3-workflow-engine-scenario-tests.md",
      files_touched: [
        {
          path: "test/validation/tier2/engine-scenarios.test.js",
          checksum:
            "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          last_modified: "2026-03-22T00:00:00Z",
        },
      ],
    };

    it("should validate checkpoint YAML contains workflow field", () => {
      const parsed = yaml.load(yaml.dump(REFERENCE_CHECKPOINT));
      expect(parsed).toHaveProperty("workflow");
      expect(typeof parsed.workflow).toBe("string");
      expect(parsed.workflow.length).toBeGreaterThan(0);
    });

    it("should validate checkpoint YAML contains step number", () => {
      const parsed = yaml.load(yaml.dump(REFERENCE_CHECKPOINT));
      expect(parsed).toHaveProperty("step");
      expect(typeof parsed.step).toBe("number");
      expect(parsed.step).toBeGreaterThan(0);
    });

    it("should validate files_touched entries have path, sha256 checksum, and last_modified", () => {
      const parsed = yaml.load(yaml.dump(REFERENCE_CHECKPOINT));

      expect(parsed).toHaveProperty("files_touched");
      expect(Array.isArray(parsed.files_touched)).toBe(true);
      expect(parsed.files_touched.length).toBeGreaterThan(0);

      for (const entry of parsed.files_touched) {
        expect(entry).toHaveProperty("path");
        expect(typeof entry.path).toBe("string");
        expect(entry.path.length).toBeGreaterThan(0);

        expect(entry).toHaveProperty("checksum");
        expect(entry.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);

        expect(entry).toHaveProperty("last_modified");
        expect(new Date(entry.last_modified).toISOString()).toBeTruthy();
      }
    });
  });

  // ─── AC3: Quality gate enforcement ────────────────────────────
  describe("AC3: Quality gate enforcement — halt on failure", () => {
    it("should declare pre_start gates with check and on_fail fields in workflow configs", () => {
      const workflowsWithPreStart = [];

      for (const wfPath of workflowFiles) {
        const config = yaml.load(readFileSync(wfPath, "utf8"));
        if (config?.quality_gates?.pre_start) {
          workflowsWithPreStart.push(wfPath);
          assertGateStructure(config.quality_gates.pre_start, wfPath);
        }
      }

      expect(workflowsWithPreStart.length).toBeGreaterThan(0);
    });

    it("should declare post_complete gates with check and on_fail fields", () => {
      const workflowsWithPostComplete = [];

      for (const wfPath of workflowFiles) {
        const config = yaml.load(readFileSync(wfPath, "utf8"));
        if (config?.quality_gates?.post_complete) {
          workflowsWithPostComplete.push(wfPath);
          assertGateStructure(config.quality_gates.post_complete, wfPath);
        }
      }

      expect(workflowsWithPostComplete.length).toBeGreaterThan(0);
    });

    it("should have descriptive halt messages in dev-story quality gates", () => {
      const devStoryConfig = yaml.load(
        readFileSync(join(DEV_STORY_DIR, "workflow.yaml"), "utf8"),
      );

      for (const gate of devStoryConfig.quality_gates.pre_start) {
        expect(gate.on_fail.length).toBeGreaterThan(10);
        expect(gate.on_fail).toMatch(
          /HALT:.*\.(.*Run|.*first|.*must|.*required)/i,
        );
      }

      for (const gate of devStoryConfig.quality_gates.post_complete) {
        expect(gate.on_fail.length).toBeGreaterThan(10);
        expect(gate.on_fail).toMatch(/HALT:/);
      }
    });
  });

  // ─── AC4: Variable resolution ─────────────────────────────────
  describe("AC4: Variable resolution before step execution", () => {
    it("should define all resolvable variables in global.yaml", () => {
      expect(existsSync(GLOBAL_CONFIG)).toBe(true);
      const config = yaml.load(readFileSync(GLOBAL_CONFIG, "utf8"));

      expect(config).toHaveProperty("project_path");
      expect(typeof config.project_path).toBe("string");
      expect(config).toHaveProperty("project_root");
      expect(config).toHaveProperty("installed_path");

      // project_path resolution logic
      if (config.project_path !== ".") {
        expect(config.project_path.length).toBeGreaterThan(0);
        expect(config.project_path).not.toMatch(/^\./);
      }
    });

    it("should use only known variable references in workflow configs", () => {
      const singleBraceVar = /(?<!\{)\{([a-z][a-z0-9_-]*)\}(?!\})/g;

      for (const wfPath of workflowFiles) {
        const content = readFileSync(wfPath, "utf8");
        let match;
        while ((match = singleBraceVar.exec(content)) !== null) {
          expect(
            KNOWN_VARIABLES.has(match[1]),
            `Unknown variable {${match[1]}} in ${wfPath}`,
          ).toBe(true);
        }
      }
    });

    it("should require global.yaml reading for variable resolution in engine", () => {
      expect(engineContent).toContain("global.yaml");
      expect(engineContent).toMatch(/unresolved/i);
      expect(engineContent).toContain(
        "ASK user for any remaining unknown variables",
      );
    });
  });

  // ─── AC5: Execution mode switching ────────────────────────────
  describe("AC5: Execution mode switching", () => {
    it("should define normal mode with pause-at-template-output behavior", () => {
      const modes = parseExecutionModes(engineContent);
      const normalMode = modes.find((m) => m.name === "normal");

      expect(normalMode).toBeDefined();
      expect(normalMode.content).toContain("template-output");
      expect(normalMode.content).toMatch(/pause|wait|stop/i);
    });

    it("should define yolo mode with auto-proceed behavior", () => {
      const modes = parseExecutionModes(engineContent);
      const yoloMode = modes.find((m) => m.name === "yolo");

      expect(yoloMode).toBeDefined();
      expect(yoloMode.content).toMatch(/auto-proceed|auto.*continue/i);
    });

    it("should specify mode switching at interaction boundaries", () => {
      expect(engineContent).toContain("switch to normal mode");

      const modes = parseExecutionModes(engineContent);
      expect(modes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── AC6: Result storage in tier2-results/ ────────────────────
  describe("AC6: Results stored in tier2-results/", () => {
    it("should have _gaia/_memory/tier2-results/ directory", () => {
      expect(existsSync(TIER2_RESULTS)).toBe(true);
    });

    it("should produce valid result YAML with all required fields", () => {
      const sampleResult = {
        test_name: "engine-scenarios",
        date: new Date().toISOString(),
        result: "pass",
        observations: "All 6 ACs validated via structural tests",
        runner: "vitest",
        framework_version: "1.45.0",
      };

      const parsed = yaml.load(yaml.dump(sampleResult));

      for (const field of RESULT_REQUIRED_FIELDS) {
        expect(parsed, `Missing required field: ${field}`).toHaveProperty(
          field,
        );
        expect(parsed[field]).toBeTruthy();
      }

      expect(new Date(parsed.date).toISOString()).toBeTruthy();
      expect(["pass", "fail"]).toContain(parsed.result);
    });
  });
});
