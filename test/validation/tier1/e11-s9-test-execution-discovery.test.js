import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const SCAN_PROMPT_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "knowledge",
  "brownfield",
  "test-execution-scan.md"
);

const BROWNFIELD_INSTRUCTIONS_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "instructions.xml"
);

const CHECKLIST_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "checklist.md"
);

const WORKFLOW_YAML_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "anytime",
  "brownfield-onboarding",
  "workflow.yaml"
);

describe("E11-S9: Test Execution During Discovery", () => {
  // ── Task 1: Test Runner Auto-Detection (AC2, AC6) ──

  describe("Subagent Prompt Template", () => {
    it("prompt template file exists at expected path (AC2)", () => {
      expect(existsSync(SCAN_PROMPT_PATH)).toBe(true);
    });

    it("references gap schema for output formatting (AC5)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/gap.*schema|gap-entry-schema/i);
    });

    it("specifies GAP-TEST sequential ID format (AC5)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/GAP-TEST/);
    });

    it("specifies verified_by as machine-detected (AC5)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toContain("machine-detected");
    });
  });

  describe("Test Runner Detection Rules (AC2)", () => {
    it("includes package.json / npm test detection", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/package\.json/);
      expect(content).toMatch(/npm test/);
    });

    it("includes pytest detection (pytest.ini / pyproject.toml / setup.cfg)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/pytest\.ini|pyproject\.toml|setup\.cfg/);
      expect(content).toMatch(/pytest/);
    });

    it("includes Maven detection (pom.xml)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/pom\.xml/);
      expect(content).toMatch(/mvn test/);
    });

    it("includes Gradle detection (build.gradle)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/build\.gradle/);
      expect(content).toMatch(/gradle test/);
    });

    it("includes Go test detection (go.mod)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/go\.mod/);
      expect(content).toMatch(/go test/);
    });

    it("includes Flutter test detection (pubspec.yaml)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/pubspec\.yaml/);
      expect(content).toMatch(/flutter test/);
    });

    it("specifies detection priority order for all 6 runners", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      // Priority order must be documented
      expect(content).toMatch(/priority|order/i);
      // All 6 runners mentioned
      const runners = ["npm test", "pytest", "mvn test", "gradle test", "go test", "flutter test"];
      for (const runner of runners) {
        expect(content).toContain(runner);
      }
    });
  });

  describe("No Test Suite Detected (AC6)", () => {
    it("handles no-test-suite case with info-level gap entry", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/GAP-TEST-INFO-001/);
      expect(content).toMatch(/No test suite detected/i);
    });

    it("specifies info severity and operational category for no-suite case", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      // Should reference info severity and operational category
      expect(content).toMatch(/severity.*info|info.*severity/i);
    });
  });

  describe("Timeout Handling (AC3)", () => {
    it("specifies configurable timeout with 5-minute default", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/timeout/i);
      expect(content).toMatch(/5\s*min|300/);
    });

    it("specifies graceful termination and partial result capture", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/partial.*result|graceful.*terminat/i);
    });
  });

  describe("Output Parsing (AC4)", () => {
    it("specifies extraction of test metrics (total, pass, fail, skip)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/total/i);
      expect(content).toMatch(/pass/i);
      expect(content).toMatch(/fail/i);
      expect(content).toMatch(/skip/i);
    });

    it("includes parsing patterns for Jest/Mocha output", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/Jest|Mocha/i);
    });

    it("includes parsing patterns for pytest output", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/pytest/i);
    });

    it("includes parsing patterns for Go test output", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/go test|FAIL.*PASS/i);
    });
  });

  describe("Gap Entry Conversion (AC5)", () => {
    it("specifies severity mapping by test type (unit=medium, integration=high, e2e=critical)", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/unit.*medium|medium.*unit/i);
      expect(content).toMatch(/integration.*high|high.*integration/i);
      expect(content).toMatch(/e2e.*critical|critical.*e2e/i);
    });

    it("specifies test type inference from file paths", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/test\/unit|test\/integration|test\/e2e|__tests__/i);
    });
  });

  describe("Infrastructure Error Detection (AC8)", () => {
    it("specifies infrastructure error heuristics", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/ECONNREFUSED/);
      expect(content).toMatch(/infrastructure|infra/i);
    });

    it("distinguishes infra errors from test failures", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/warning.*gap|warning.*infra|infrastructure.*warning/i);
    });
  });

  describe("Monorepo / Polyglot Support (AC9)", () => {
    it("specifies sequential execution for multiple runners", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/sequential|multiple.*runner|monorepo/i);
    });

    it("specifies aggregated results with runner name in description", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/aggregat|runner.*name.*description/i);
    });
  });

  describe("Token Budget (AC7)", () => {
    it("references NFR-024 token budget constraint", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/NFR-024|token.*budget|40K/i);
    });

    it("specifies truncation for excessive output", () => {
      const content = readFileSync(SCAN_PROMPT_PATH, "utf8");
      expect(content).toMatch(/truncat/i);
    });
  });

  // ── Task 5: Brownfield Workflow Integration (AC1) ──

  describe("Brownfield Instructions Integration (AC1)", () => {
    it("brownfield instructions.xml contains test execution step", () => {
      const content = readFileSync(BROWNFIELD_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/test.*execut|Test Execution/i);
    });

    it("test execution step comes after Step 2/2.5 scans", () => {
      const content = readFileSync(BROWNFIELD_INSTRUCTIONS_PATH, "utf8");
      // Test execution must be in a step after 2.5 and before the gap consolidation step
      const step25Idx = content.indexOf('step n="2.5"');
      const testExecMatch = content.match(/test.*execution.*scan|Test Execution/i);
      expect(testExecMatch).not.toBeNull();
      const testExecIdx = content.indexOf(testExecMatch[0]);
      expect(testExecIdx).toBeGreaterThan(step25Idx);
    });

    it("test execution references the scan prompt template", () => {
      const content = readFileSync(BROWNFIELD_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/test-execution-scan\.md/);
    });

    it("test execution output goes to brownfield-scan-test-execution.md", () => {
      const content = readFileSync(BROWNFIELD_INSTRUCTIONS_PATH, "utf8");
      expect(content).toMatch(/brownfield-scan-test-execution\.md/);
    });

    it("test execution is non-blocking (failures do not halt workflow)", () => {
      const content = readFileSync(BROWNFIELD_INSTRUCTIONS_PATH, "utf8");
      // Must have language about non-blocking / continue on failure
      expect(content).toMatch(/non-blocking|not.*halt|continue.*fail|warning.*continue/i);
    });
  });

  describe("Brownfield Checklist Integration", () => {
    it("checklist includes test execution verification", () => {
      const content = readFileSync(CHECKLIST_PATH, "utf8");
      expect(content).toMatch(/test.*execut/i);
    });

    it("checklist references scan output file", () => {
      const content = readFileSync(CHECKLIST_PATH, "utf8");
      expect(content).toMatch(/brownfield-scan-test-execution/);
    });
  });

  describe("Workflow YAML Integration", () => {
    it("workflow.yaml output artifacts includes test execution scan file", () => {
      const content = readFileSync(WORKFLOW_YAML_PATH, "utf8");
      expect(content).toMatch(/brownfield-scan-test-execution/);
    });
  });
});
