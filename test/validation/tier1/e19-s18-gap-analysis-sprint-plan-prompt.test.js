import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

/**
 * E19-S18: Gap Analysis Trigger — Sprint Planning Prompt (FR-237)
 *
 * Validates that the /gaia-sprint-plan workflow instructions contain a
 * gap-analysis tip prompt between the velocity check (Step 3) and story
 * selection (Step 4), with correct gating behavior for AC1-AC4.
 */

const INSTRUCTIONS_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "4-implementation",
  "sprint-planning",
  "instructions.xml"
);

describe("E19-S18: sprint-planning gap analysis tip prompt", () => {
  let instructions;

  beforeAll(() => {
    expect(existsSync(INSTRUCTIONS_PATH)).toBe(true);
    instructions = readFileSync(INSTRUCTIONS_PATH, "utf8");
  });

  it("declares a dedicated gap-analysis tip step between velocity check and story selection", () => {
    // AC1: prompt appears after velocity check (Step 3 Sprint Scoping) and
    // before story selection (Step 4). We add it as Step 3b.
    const step3bMatch = instructions.match(
      /<step\s+n="3b"[^>]*title="[^"]*Gap Analysis[^"]*"[^>]*>[\s\S]*?<\/step>/i
    );
    expect(step3bMatch, "Step 3b 'Gap Analysis Tip' must exist").not.toBeNull();

    // Step 3b must appear after Step 3 and before Step 4 in the file
    const step3Idx = instructions.indexOf('<step n="3"');
    const step3bIdx = instructions.indexOf('<step n="3b"');
    const step4Idx = instructions.indexOf('<step n="4"');
    expect(step3Idx).toBeGreaterThan(-1);
    expect(step3bIdx).toBeGreaterThan(step3Idx);
    expect(step4Idx).toBeGreaterThan(step3bIdx);
  });

  it("AC1: displays the literal gap-analysis tip text referencing /gaia-test-gap-analysis", () => {
    // Extract just the Step 3b block so we assert the text lives inside it.
    const step3b = instructions.match(/<step\s+n="3b"[\s\S]*?<\/step>/)?.[0];
    expect(step3b).toBeTruthy();
    expect(step3b).toMatch(/Tip:\s*Run\s*`?\/gaia-test-gap-analysis`?/);
    expect(step3b).toMatch(/identify untested areas/i);
  });

  it("AC2: gates the tip on absence of test-gap-analysis-{sprint_start_date}.md", () => {
    const step3b = instructions.match(/<step\s+n="3b"[\s\S]*?<\/step>/)?.[0];
    expect(step3b).toBeTruthy();
    // Must reference the test-artifacts file pattern and a sprint_start_date
    // variable so the check is clearly date-scoped.
    expect(step3b).toMatch(/test-gap-analysis-/);
    expect(step3b).toMatch(/sprint_start_date/);
    expect(step3b).toMatch(/test-artifacts/);
    // Must only show the prompt when the file is absent
    expect(step3b).toMatch(/(absent|does not exist|not exist|missing)/i);
  });

  it("AC3: auto-continues the prompt after 2 seconds in YOLO mode", () => {
    const step3b = instructions.match(/<step\s+n="3b"[\s\S]*?<\/step>/)?.[0];
    expect(step3b).toBeTruthy();
    expect(step3b).toMatch(/yolo/i);
    expect(step3b).toMatch(/2\s*seconds?/i);
    expect(step3b).toMatch(/auto-continue/i);
  });

  it("AC4: supports --skip-gap-prompt flag to bypass the step entirely", () => {
    const step3b = instructions.match(/<step\s+n="3b"[\s\S]*?<\/step>/)?.[0];
    expect(step3b).toBeTruthy();
    expect(step3b).toMatch(/--skip-gap-prompt/);
    expect(step3b).toMatch(/(skip|bypass)/i);
  });
});
