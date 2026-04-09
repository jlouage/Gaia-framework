import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// E20-S7 ATDD — Dev-Story Step 15 — Wait for CI Checks
//
// Source: docs/test-artifacts/atdd-E20-S7.md
// Story: docs/implementation-artifacts/E20-S7-dev-story-step-15-wait-for-ci-checks.md
//
// These tests verify each AC by scanning the modified instructions.xml
// for canonical content markers. They run in the Red→Green→Refactor cycle
// and lock in the implementation surface described in the ATDD.

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const DEV_STORY_INSTRUCTIONS = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "dev-story",
  "instructions.xml"
);
const GLOBAL_YAML = join(PROJECT_ROOT, "_gaia", "_config", "global.yaml");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E20-S7: Dev-Story Step 15 — Wait for CI Checks", () => {
  // AC1: Step 15 polls CI check status at 30-second intervals using `gh pr checks` or equivalent (FR-249)
  describe("AC1: Step 15 polls CI check status (FR-249)", () => {
    // Test 1
    it("instructions.xml contains a Step 15 that references gh pr checks or equivalent CI polling", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/step\s+n="15"|step n='15'|<step[^>]+n="15"/i);
      expect(content).toMatch(/gh\s+pr\s+checks|ci.?check|poll/i);
    });

    // Test 2
    it("instructions.xml references 30-second polling interval and FR-249", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/FR-249/);
      expect(content).toMatch(/30.?second|30s\b|interval.*30|poll.*30/i);
    });
  });

  // AC2: Progress display shows check name, status (pending/running/passed/failed), elapsed time
  describe("AC2: Progress display with check name, status, elapsed time", () => {
    // Test 3
    it("instructions.xml Step 15 specifies CI progress display with all four status values", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(
        /pending[\s\S]*running[\s\S]*passed[\s\S]*failed|pending[\s\S]*running[\s\S]*success[\s\S]*fail/i
      );
    });

    // Test 4
    it("instructions.xml specifies elapsed time in the progress output", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/elapsed/i);
    });
  });

  // AC3: Timeout defaults to 15 minutes, configurable via ci_cd.ci_timeout_minutes in global.yaml (NFR-043)
  describe("AC3: 15-minute timeout with ci_cd.ci_timeout_minutes config (NFR-043)", () => {
    // Test 5
    it("instructions.xml or global.yaml references ci_cd.ci_timeout_minutes or a 15-minute default", () => {
      const instructionsContent = loadFile(DEV_STORY_INSTRUCTIONS);
      const globalContent = loadFile(GLOBAL_YAML);
      const combined = (instructionsContent ?? "") + (globalContent ?? "");
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/ci_timeout_minutes|15.?min|timeout.*15|15.*minute/i);
    });

    // Test 6
    it("instructions.xml references NFR-043 for the timeout constraint", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/NFR-043/);
    });
  });

  // AC4: On timeout: workflow halts with message listing pending checks and resume instruction
  describe("AC4: Timeout halt with pending check list and resume guidance", () => {
    // Test 7
    it("instructions.xml includes a timeout halt action with pending checks list in the message", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/timed?\s*out|timeout.*halt|halt.*timeout/i);
      expect(content).toMatch(/pending.*check|check.*pending|still.*pending/i);
    });

    // Test 8
    it("instructions.xml timeout message includes /gaia-resume guidance", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/gaia-resume/);
      expect(content).toMatch(
        /timed?\s*out.*minute|minute.*timed?\s*out|\{N\}.*minute|minute.*\{N\}/i
      );
    });
  });

  // AC5: On all checks passed: display success summary and proceed to Step 16
  describe("AC5: All checks passed — success summary and proceed to Step 16", () => {
    // Test 9
    it("instructions.xml Step 15 defines CI success path showing success summary and proceeding to Step 16", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(
        /all.*ci.*check.*pass|ci.*check.*all.*pass|all.*checks.*pass[\s\S]*step.?16|all.*passed[\s\S]*step.?16/i
      );
    });
  });

  // AC6: On any check failed: display failure details and halt with resume guidance
  describe("AC6: Any check failed — failure details halt with resume guidance", () => {
    // Test 10
    it("instructions.xml Step 15 halts with the specific CI check name in the failure message", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/CI\s+check\s+\{name\}|\{name\}.*failed.*CI|ci.*check.*\{name\}/i);
    });

    // Test 11
    it("instructions.xml failure message includes /gaia-resume guidance", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/gaia-resume/);
      expect(content).toMatch(/fix.*push.*resume|push.*resume|fix.*resume/i);
    });
  });

  // AC7: If ci_checks array is empty or not defined, step auto-passes with "No CI checks configured"
  describe("AC7: Empty/undefined ci_checks auto-passes", () => {
    // Test 12
    it("instructions.xml handles empty or missing ci_checks with No CI checks configured message", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(
        /no\s+ci\s+checks\s+configured|ci_checks.*empty|ci_checks.*not\s+defined|empty.*ci_checks/i
      );
    });
  });
});
