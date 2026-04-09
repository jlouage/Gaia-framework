import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

/**
 * E19-S7: Generated-vs-Executed Count Tracking
 *
 * Validates that the test gap analysis workflow tracks and displays
 * per-story and aggregate generated vs executed test-case counts with
 * an exec_ratio percentage, integrated into the FR-223 output schema.
 *
 * Traces to: FR-226, ADR-030 §10.22
 * Test cases: TGA-30, TGA-31, TGA-32
 */

const TEMPLATE_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "templates",
  "test-gap-analysis-template.md"
);

const INSTRUCTIONS_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "testing",
  "workflows",
  "test-gap-analysis",
  "instructions.xml"
);

const DOCUMENT_RULESETS_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "skills",
  "document-rulesets.md"
);

describe("E19-S7: Generated-vs-Executed Count Tracking", () => {
  let templateContent;
  let instructionsContent;
  let rulesetsContent;

  beforeAll(() => {
    if (existsSync(TEMPLATE_PATH)) {
      templateContent = readFileSync(TEMPLATE_PATH, "utf8");
    }
    if (existsSync(INSTRUCTIONS_PATH)) {
      instructionsContent = readFileSync(INSTRUCTIONS_PATH, "utf8");
    }
    if (existsSync(DOCUMENT_RULESETS_PATH)) {
      rulesetsContent = readFileSync(DOCUMENT_RULESETS_PATH, "utf8");
    }
  });

  // --- TGA-30 / AC1: Per-story generated and executed counters ---
  describe("TGA-30 / AC1: per-story generated and executed counters", () => {
    it("instructions describe counting generated test cases from test-artifacts", () => {
      expect(instructionsContent).toBeDefined();
      expect(instructionsContent).toMatch(/generated.*test.*case/i);
      // Must scan docs/test-artifacts/ — Task 1.1 spec
      expect(instructionsContent).toMatch(/test-artifacts/);
    });

    it("instructions describe counting executed test cases from evidence JSON and JUnit XML", () => {
      expect(instructionsContent).toBeDefined();
      expect(instructionsContent).toMatch(/executed/i);
      expect(instructionsContent).toMatch(/evidence.*JSON/i);
      expect(instructionsContent).toMatch(/JUnit.*XML/i);
    });

    it("instructions describe deduplication across result sources", () => {
      expect(instructionsContent).toBeDefined();
      expect(instructionsContent).toMatch(/dedup/i);
    });
  });

  // --- TGA-31 / AC2, AC5: Per-Story Detail exposes generated, executed, exec_ratio ---
  describe("TGA-31 / AC2, AC5: Per-Story Detail fields", () => {
    it("template Per-Story Detail documents generated, executed, exec_ratio fields", () => {
      expect(templateContent).toBeDefined();
      const perStorySection = templateContent.split(/##\s+Per-Story Detail/)[1].split(/\n## /)[0];
      expect(perStorySection).toMatch(/\bgenerated\b/i);
      expect(perStorySection).toMatch(/\bexecuted\b/i);
      expect(perStorySection).toMatch(/exec_ratio/);
    });

    it("instructions specify exec_ratio calculation and div-by-zero handling", () => {
      expect(instructionsContent).toBeDefined();
      expect(instructionsContent).toMatch(/exec_ratio/);
      // Must handle division-by-zero when generated == 0
      expect(instructionsContent).toMatch(
        /division.{0,5}by.{0,5}zero|divide.{0,5}by.{0,5}zero|generated\s*==\s*0|zero.{0,15}denominator/i
      );
    });

    it("instructions specify ratio is rendered as a percentage", () => {
      expect(instructionsContent).toBeDefined();
      expect(instructionsContent).toMatch(/percent|%/);
    });
  });

  // --- TGA-32 / AC3, AC4: Aggregate row and zero-executed flagging ---
  describe("TGA-32 / AC3, AC4: aggregate row and HIGH-gap flagging", () => {
    it("template Executive Summary documents a Generated vs Executed aggregate row", () => {
      expect(templateContent).toBeDefined();
      const summarySection = templateContent.split(/##\s+Executive Summary/)[1].split(/\n## /)[0];
      expect(summarySection).toMatch(/Generated vs Executed/i);
    });

    it("instructions specify aggregate generated-vs-executed computation", () => {
      expect(instructionsContent).toBeDefined();
      expect(instructionsContent).toMatch(/aggregate/i);
      expect(instructionsContent).toMatch(/Generated vs Executed/i);
    });

    it("instructions flag stories with zero executed tests as HIGH gap", () => {
      expect(instructionsContent).toBeDefined();
      // Must flag executed == 0 as HIGH
      expect(instructionsContent).toMatch(
        /executed\s*=\s*0|zero executed|no executed|executed count is 0/i
      );
      expect(instructionsContent).toMatch(/HIGH/);
    });

    it("gap-analysis-rules ruleset documents the generated-vs-executed fields", () => {
      expect(rulesetsContent).toBeDefined();
      // Find the gap-analysis-rules section body
      const match = rulesetsContent.match(
        /<!--\s*SECTION:\s*gap-analysis-rules\s*-->([\s\S]*?)<!--\s*END SECTION\s*-->/
      );
      expect(match).not.toBeNull();
      const section = match[1];
      expect(section).toMatch(/\bgenerated\b/i);
      expect(section).toMatch(/\bexecuted\b/i);
      expect(section).toMatch(/exec_ratio/);
    });
  });
});
