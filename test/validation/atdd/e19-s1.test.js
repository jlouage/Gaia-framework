import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_YAML = join(
  PROJECT_ROOT,
  "_gaia",
  "testing",
  "workflows",
  "test-gap-analysis",
  "workflow.yaml"
);
const INSTRUCTIONS_XML = join(
  PROJECT_ROOT,
  "_gaia",
  "testing",
  "workflows",
  "test-gap-analysis",
  "instructions.xml"
);
const WORKFLOW_MANIFEST = join(PROJECT_ROOT, "_gaia", "_config", "workflow-manifest.csv");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E19-S1: Gap Analysis Workflow — Coverage Mode", () => {
  // AC1: /gaia-test-gap-analysis --mode coverage invokes the workflow in coverage mode (FR-221)
  describe("AC1: coverage mode invocation", () => {
    it("workflow.yaml declares 'coverage' as a valid mode (FR-221)", () => {
      const content = loadFile(WORKFLOW_YAML);
      expect(content).not.toBeNull();
      // workflow.yaml must register coverage as a mode
      expect(content).toMatch(/coverage/i);
      // Must be associated with a mode/flag definition
      expect(content).toMatch(/mode|modes/i);
    });

    it("workflow manifest entry lists /gaia-test-gap-analysis as a registered command", () => {
      const content = loadFile(WORKFLOW_MANIFEST);
      expect(content).not.toBeNull();
      expect(content).toMatch(/gaia-test-gap-analysis/);
    });
  });

  // AC2: Coverage mode scans docs/test-artifacts/test-plan.md and all story files
  // in docs/implementation-artifacts/ to identify ACs without corresponding test cases
  describe("AC2: file scanning — test-plan.md and story files", () => {
    it("instructions.xml scans docs/test-artifacts/test-plan.md for acceptance criteria", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference test-plan.md as a scan target
      expect(content).toMatch(/test-plan\.md/);
    });

    it("instructions.xml scans story files in docs/implementation-artifacts/ for acceptance criteria", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference implementation-artifacts directory
      expect(content).toMatch(/implementation-artifacts/);
      // Must reference AC scanning / acceptance criteria extraction
      expect(content).toMatch(/acceptance.?criteri|AC\d|untested|gap/i);
    });
  });

  // AC3: Output document created at docs/test-artifacts/test-gap-analysis-{date}.md
  // matching the schema defined in FR-223
  describe("AC3: output document path and schema (FR-223)", () => {
    it("workflow.yaml declares the output path as docs/test-artifacts/test-gap-analysis-{date}.md", () => {
      const content = loadFile(WORKFLOW_YAML);
      expect(content).not.toBeNull();
      // Output path must match the pattern docs/test-artifacts/test-gap-analysis-{date}.md
      expect(content).toMatch(/test-gap-analysis.*\{date\}|test-gap-analysis.*date/i);
      expect(content).toMatch(/test.?artifacts/i);
    });

    it("instructions.xml generates output with FR-223 schema sections", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // FR-223 schema requires: summary count, per-story gap table, coverage percentage
      // Must reference at least summary/count and per-story breakdown
      expect(content).toMatch(/FR-223|summary.*count|per.story|coverage.?(?:gap|percent|rate)/i);
    });
  });

  // AC4: Workflow completes in under 60 seconds on a typical GAIA project (NFR-040)
  describe("AC4: performance constraint NFR-040 (< 60 seconds)", () => {
    it("workflow.yaml or instructions.xml references NFR-040 performance constraint", () => {
      const workflowContent = loadFile(WORKFLOW_YAML);
      const instructionsContent = loadFile(INSTRUCTIONS_XML);
      // At least one of the two files must trace to NFR-040 or reference the 60-second limit
      const combined = (workflowContent ?? "") + (instructionsContent ?? "");
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/NFR-040|60\s*second|under\s*60/i);
    });
  });

  // AC5: Coverage mode listed as a valid mode in --help output and manifest entry
  describe("AC5: coverage mode in help and manifest", () => {
    it("workflow.yaml includes coverage in the modes list or description", () => {
      const content = loadFile(WORKFLOW_YAML);
      expect(content).not.toBeNull();
      // Coverage mode must be explicitly listed — not just mentioned in passing
      expect(content).toMatch(/coverage/i);
      // Must appear alongside other modes or in a modes/description context
      expect(content).toMatch(/mode.*coverage|coverage.*mode|modes:/i);
    });
  });

  // AC6: When no gaps detected, output states "No coverage gaps detected" with summary count
  describe("AC6: no-gaps-detected case", () => {
    it("instructions.xml handles the zero-gap case with explicit 'No coverage gaps detected' message", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must handle the no-gap scenario — not just the happy path
      expect(content).toMatch(
        /no.*(?:gap|coverage\s*gap).*detected|no.*coverage.*gaps|zero.*gap/i
      );
    });
  });
});
