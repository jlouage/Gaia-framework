import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

/**
 * E19-S19: Gap Analysis Trigger — Deploy Checklist (FR-238)
 *
 * Validates that the /gaia-deploy-checklist workflow instructions contain a
 * gap-analysis quality gate between the approval gates (Step 6d) and the
 * checklist generation (Step 7), with the gate behavior described in
 * AC1-AC5 of the story.
 */

const INSTRUCTIONS_PATH = join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "5-deployment",
  "deployment-checklist",
  "instructions.xml"
);

describe("E19-S19: deployment-checklist gap analysis gate", () => {
  let instructions;
  let step6e;

  beforeAll(() => {
    expect(existsSync(INSTRUCTIONS_PATH)).toBe(true);
    instructions = readFileSync(INSTRUCTIONS_PATH, "utf8");
    step6e = instructions.match(/<step\s+n="6e"[\s\S]*?<\/step>/)?.[0];
  });

  it("declares a Step 6e 'Gap Analysis Gate' between Step 6d and Step 7", () => {
    expect(step6e, "Step 6e 'Gap Analysis Gate' must exist").toBeTruthy();
    expect(step6e).toMatch(/title="[^"]*Gap Analysis[^"]*"/i);

    const step6dIdx = instructions.indexOf('<step n="6d"');
    const step6eIdx = instructions.indexOf('<step n="6e"');
    const step7Idx = instructions.indexOf('<step n="7"');
    expect(step6dIdx).toBeGreaterThan(-1);
    expect(step6eIdx).toBeGreaterThan(step6dIdx);
    expect(step7Idx).toBeGreaterThan(step6eIdx);
  });

  it("AC1: declares the gate checking for test-gap-analysis-{sprint_date}.md in test-artifacts", () => {
    expect(step6e).toBeTruthy();
    expect(step6e).toMatch(/test-gap-analysis-/);
    expect(step6e).toMatch(/test-artifacts/);
    expect(step6e).toMatch(/FR-238/);
  });

  it("AC2: reads sprint_id and sprint start date from sprint-status.yaml", () => {
    expect(step6e).toBeTruthy();
    expect(step6e).toMatch(/sprint-status\.yaml/);
    expect(step6e).toMatch(/(sprint_start|started|sprint window)/i);
    expect(step6e).toMatch(/sprint_id/);
  });

  it("AC3: fails the gate with a specific blocking message when the file is missing", () => {
    expect(step6e).toBeTruthy();
    // HALT-style failure + exact message wording
    expect(step6e).toMatch(/(HALT|FAIL)/);
    expect(step6e).toMatch(/Deploy blocked: no gap analysis found for sprint/);
    expect(step6e).toMatch(/\/gaia-test-gap-analysis/);
  });

  it("AC4: supports --skip-gap-gate flag to bypass the gate with a warning", () => {
    expect(step6e).toBeTruthy();
    expect(step6e).toMatch(/--skip-gap-gate/);
    expect(step6e).toMatch(/(warning|warn)/i);
    expect(step6e).toMatch(/(bypass|skip)/i);
    // Bypass is recorded in the checklist output
    expect(step6e).toMatch(/(record|log)/i);
  });

  it("AC5: warns (does not block) when gap analysis has CRITICAL gaps", () => {
    expect(step6e).toBeTruthy();
    expect(step6e).toMatch(/CRITICAL/);
    expect(step6e).toMatch(/WARNING/);
    // Must parse gap_count / Gap Table for severity=critical
    expect(step6e).toMatch(/(gap_count|Gap Table|severity)/);
    // Must be explicit that this does NOT halt
    expect(step6e).toMatch(/(not\s+a\s+HALT|not\s+block|non-?blocking|warning only)/i);
  });
});
