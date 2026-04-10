import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const INSTRUCTIONS_XML = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/create-story/instructions.xml"
);

describe("E19-S11: Edge Case Results Feed into Test Plan (FR-230)", () => {
  const xml = readFileSync(INSTRUCTIONS_XML, "utf8");

  // ── AC1: Edge case results appended to test-plan.md under story's section ──
  describe("AC1: Append edge case rows to test-plan.md (FR-230)", () => {
    it("references FR-230", () => {
      expect(xml).toMatch(/FR-230/);
    });

    it("contains an explicit test-plan append step that runs after AC-EC append", () => {
      // Test plan append must appear AFTER Step 4c (AC-EC append) and BEFORE Step 6 (output)
      const acEcAppendIdx = xml.search(
        /AC-EC append|Append Edge Case Results to Acceptance Criteria/i
      );
      const testPlanAppendIdx = xml.search(
        /test-plan\.md[\s\S]{0,500}append|Append Edge Case Results to Test Plan|test.plan.*edge.case.*append/i
      );
      const step6Idx = xml.search(/<step n="6"/);
      expect(acEcAppendIdx).toBeGreaterThan(-1);
      expect(testPlanAppendIdx).toBeGreaterThan(acEcAppendIdx);
      expect(testPlanAppendIdx).toBeLessThan(step6Idx);
    });

    it("references docs/test-artifacts/test-plan.md as the target", () => {
      expect(xml).toMatch(/test.artifacts.*test-plan\.md|\{test_artifacts\}\/test-plan\.md/);
    });

    it("locates the story section in test-plan.md before appending", () => {
      expect(xml).toMatch(/locate|find|search/i);
      expect(xml).toMatch(/story.?key|story\s+section/i);
    });
  });

  // ── AC2: Row format ──
  describe("AC2: Append rows use the canonical row format", () => {
    it("documents the row format with tc_id, scenario, edge-case, severity, story_key", () => {
      // Format: | {tc_id} | {scenario} | edge-case | {severity} | {story_key} |
      expect(xml).toMatch(
        /tc_id[\s\S]{0,300}scenario[\s\S]{0,300}edge-case[\s\S]{0,300}severity[\s\S]{0,300}story_key/i
      );
    });

    it("uses the 'edge-case' tag literal in the row format", () => {
      expect(xml).toMatch(/edge-case/);
    });
  });

  // ── AC3: TC ID numbering from existing highest ID ──
  describe("AC3: Test case IDs follow existing numbering convention", () => {
    it("describes reading the highest existing TC ID from test-plan.md", () => {
      expect(xml).toMatch(/highest|last|existing.*TC.?ID|auto.?increment|increment.*from/i);
    });

    it("references TC ID auto-increment logic", () => {
      expect(xml).toMatch(/TC.?ID|tc_id/);
      expect(xml).toMatch(/increment|next.*ID/i);
    });
  });

  // ── AC4: Missing test-plan.md — non-blocking ──
  describe("AC4: Missing test-plan.md handled non-blockingly", () => {
    it("checks file existence before attempting append", () => {
      expect(xml).toMatch(/test-plan\.md[\s\S]{0,400}(?:exists?|not\s+found|missing|absent)/i);
    });

    it("logs a note in the story file instead of raising an error when missing", () => {
      expect(xml).toMatch(/no\s+error|non.?blocking|skip.*append|continue/i);
    });
  });

  // ── AC5: Idempotency — no duplicate rows on re-run ──
  describe("AC5: Idempotency — no duplicate edge case rows", () => {
    it("describes a deduplication check before appending", () => {
      expect(xml).toMatch(/duplicate|dedup|idempoten|already\s+(?:exists?|present)/i);
    });

    it("uses story_key as part of the dedup key", () => {
      const dedupContext = xml.match(/(?:duplicate|dedup|idempoten)[\s\S]{0,600}/i);
      expect(dedupContext).not.toBeNull();
      expect(dedupContext[0]).toMatch(/story_key|story.?key/i);
    });
  });
});
