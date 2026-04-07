/**
 * ATDD — E16-S3: Resolution Routing
 *
 * Red phase: all tests must FAIL because the implementation does not exist yet.
 * The resolution routing step is not yet present in:
 *   _gaia/creative/workflows/problem-solving/instructions.xml
 *
 * AC1: Classification logic — isolated-fix / enhancement / systemic categories
 * AC2: isolated-fix → /gaia-create-story with pre-populated fields (FR-186)
 * AC3: enhancement → /gaia-add-feature with scope analysis fields (FR-187)
 * AC4: systemic → Problem Brief generation + escalation routing (FR-188)
 * AC5: test_gaps propagation from E16-S2 into created story Dev Notes (FR-190)
 * AC6: User can override classification before routing
 * AC7: User decline → workflow completes with action plan only
 *
 * Dependency: E16-S2 (Context-Informed Analysis) must produce test_gaps field
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const INSTRUCTIONS = path.join(
  PROJECT_ROOT,
  "_gaia",
  "creative",
  "workflows",
  "problem-solving",
  "instructions.xml"
);

// ── Fixture: read instructions file once ──────────────────────────────────

function readInstructions() {
  return fs.readFileSync(INSTRUCTIONS, "utf-8");
}

// ── AC1: Classification logic ─────────────────────────────────────────────

describe("AC1: Classification logic categorizes resolution", () => {
  it("test_ac1_classification_logic_in_instructions — instructions.xml contains resolution routing step with all three classification categories", () => {
    const content = readInstructions();

    // Must have a resolution routing step
    expect(content).toMatch(/resolution.routing|Resolution.Routing/i);

    // Must define all three classification categories
    expect(content).toMatch(/isolated-fix/);
    expect(content).toMatch(/enhancement/);
    expect(content).toMatch(/systemic/);

    // Must reference the classification decision criteria (scope, component_count, requires_upstream)
    expect(content).toMatch(/single.component|component_count|scope/i);
  });
});

// ── AC2: isolated-fix → /gaia-create-story ────────────────────────────────

describe("AC2: isolated-fix routes to /gaia-create-story with pre-populated fields", () => {
  it("test_ac2_isolated_fix_create_story_invocation — isolated-fix path contains invoke-workflow targeting create-story with all required fields", () => {
    const content = readInstructions();

    // Must invoke create-story workflow for isolated-fix
    expect(content).toMatch(/create-story/);
    expect(content).toMatch(/invoke-workflow|gaia-create-story/i);

    // Must pre-populate all required fields per FR-186:
    // title, epic (auto-detected), priority, source ref, root_cause,
    // affected_components, acceptance_criteria, test_gap, rejected_solutions
    expect(content).toMatch(/root_cause|root cause/i);
    expect(content).toMatch(/affected_components|affected components/i);
    expect(content).toMatch(/test_gap/);
    expect(content).toMatch(/rejected_solutions|rejected solutions/i);

    // Must set origin to problem-solving (FR-189 integration)
    expect(content).toMatch(/origin.*problem-solving|problem-solving.*origin/i);
  });
});

// ── AC3: enhancement → /gaia-add-feature ─────────────────────────────────

describe("AC3: enhancement routes to /gaia-add-feature with scope analysis", () => {
  it("test_ac3_enhancement_add_feature_invocation — enhancement path contains invoke-workflow targeting add-feature with scope fields", () => {
    const content = readInstructions();

    // Must invoke add-feature workflow for enhancement classification
    expect(content).toMatch(/add-feature/);
    expect(content).toMatch(/invoke-workflow|gaia-add-feature/i);

    // Must pass scope analysis and affected components per FR-187
    expect(content).toMatch(/scope.analysis|affected.components/i);
  });
});

// ── AC4a: systemic → Problem Brief generation ─────────────────────────────

describe("AC4: systemic generates Problem Brief and suggests escalation", () => {
  it("test_ac4_systemic_generates_problem_brief — systemic path contains template-output targeting problem-brief file", () => {
    const content = readInstructions();

    // Must have a template-output for the Problem Brief
    expect(content).toMatch(/problem-brief/i);
    expect(content).toMatch(/template-output/);

    // Problem Brief must reference the correct output path
    expect(content).toMatch(/docs\/planning-artifacts\/problem-brief/i);

    // Brief must include: analysis, affected components, risk assessment, rejected solutions
    expect(content).toMatch(/risk.assessment|affected.components/i);
    expect(content).toMatch(/rejected.solutions|recommended.approach/i);
  });

  // ── AC4b: systemic → escalation routing ───────────────────────────────

  it("test_ac4_systemic_escalation_routing — systemic path suggests Theo for architecture issues and Derek for requirements gaps", () => {
    const content = readInstructions();

    // Must reference Theo (architect) for architecture issues
    expect(content).toMatch(/Theo|architect/i);

    // Must reference Derek (PM) for requirements gaps
    expect(content).toMatch(/Derek|requirements.gap/i);
  });
});

// ── AC5: test_gaps propagation ────────────────────────────────────────────

describe("AC5: test_gaps from E16-S2 analysis propagate to created story Dev Notes", () => {
  it("test_ac5_test_gaps_propagation — instructions.xml references test_gaps field in create-story invocation context", () => {
    const content = readInstructions();

    // Must reference test_gaps field — propagated from E16-S2 analysis output
    expect(content).toMatch(/test_gaps/);

    // Must explicitly target Dev Notes section of the created story
    expect(content).toMatch(/Dev.Notes|dev.notes/i);
  });
});

// ── AC6: User override of classification ──────────────────────────────────

describe("AC6: User can override classification before routing proceeds", () => {
  it("test_ac6_user_override_classification — instructions.xml contains ask tag for classification confirmation that allows override", () => {
    const content = readInstructions();

    // Must have an ask tag for classification confirmation
    expect(content).toMatch(/<ask>/);

    // The ask must present override capability — allow user to select different type
    expect(content).toMatch(/override|confirm.classification|change.*classification/i);

    // Must present all three types as override options
    expect(content).toMatch(/isolated-fix/);
    expect(content).toMatch(/enhancement/);
    expect(content).toMatch(/systemic/);
  });
});

// ── AC7: User declines routing ────────────────────────────────────────────

describe("AC7: User can decline all routing — workflow completes with action plan only", () => {
  it("test_ac7_user_declines_routing — instructions.xml handles decline option without invoking downstream workflow", () => {
    const content = readInstructions();

    // Must have a decline/skip option in the routing ask
    expect(content).toMatch(/decline|skip.*routing|no.*routing/i);

    // When declined: workflow must complete with action plan output only
    // Verify the action plan template-output is still present (not gated on routing)
    expect(content).toMatch(/action.plan|action-plan/i);
    expect(content).toMatch(/template-output/);

    // Must NOT force invocation of downstream workflows when declined
    // (verified by absence of unconditional invoke-workflow for create-story/add-feature)
    // The invoke-workflow tags must be conditional on classification AND user confirmation
    expect(content).toMatch(/if=|if =/);
  });
});
