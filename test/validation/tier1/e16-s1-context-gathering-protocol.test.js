import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const WORKFLOW_DIR = join(PROJECT_ROOT, "_gaia", "creative", "workflows", "problem-solving");
const GLOBAL_YAML_PATH = join(PROJECT_ROOT, "_gaia", "_config", "global.yaml");

/**
 * E16-S1: Context Gathering Protocol (Step 0)
 *
 * Validates:
 * - AC1: Step 0 exists before original Step 1 logic
 * - AC2: Keyword extraction actions present in instructions
 * - AC3: Two-tier artifact scan actions present
 * - AC4: Token budget config in global.yaml + sub-budgets in workflow.yaml
 * - AC5: Context Brief synthesis action present
 * - AC6: User validation ask + checkpoint persistence
 * - AC7: Graceful empty-context fallback (no halt on zero matches)
 */
describe("E16-S1: Context Gathering Protocol", () => {
  // ────────────────────────────────────────────────────
  // Fixture: load all files once
  // ────────────────────────────────────────────────────

  const instructionsPath = join(WORKFLOW_DIR, "instructions.xml");
  const workflowYamlPath = join(WORKFLOW_DIR, "workflow.yaml");
  const checklistPath = join(WORKFLOW_DIR, "checklist.md");

  const instructions = existsSync(instructionsPath) ? readFileSync(instructionsPath, "utf8") : null;

  const workflowConfig = existsSync(workflowYamlPath)
    ? yaml.load(readFileSync(workflowYamlPath, "utf8"))
    : null;

  const globalConfig = existsSync(GLOBAL_YAML_PATH)
    ? yaml.load(readFileSync(GLOBAL_YAML_PATH, "utf8"))
    : null;

  const checklist = existsSync(checklistPath) ? readFileSync(checklistPath, "utf8") : null;

  // ────────────────────────────────────────────────────
  // File existence
  // ────────────────────────────────────────────────────

  it("instructions.xml exists", () => {
    expect(existsSync(instructionsPath)).toBe(true);
  });

  it("workflow.yaml exists and parses", () => {
    expect(workflowConfig).not.toBeNull();
  });

  it("checklist.md exists", () => {
    expect(existsSync(checklistPath)).toBe(true);
  });

  // ────────────────────────────────────────────────────
  // AC1: Step 0 (Context Gathering) precedes original Step 1
  // ────────────────────────────────────────────────────

  describe("AC1: Step ordering", () => {
    it("should contain a Problem Intake step (step 1) before Problem Framing (step 3)", () => {
      // The original Step 1 (Problem Framing) is now Step 3
      // New Step 1 = Problem Intake, Step 2 = Context Gathering
      const intakeMatch = instructions.match(/<step\s+n="1"\s+title="Problem Intake"/);
      const contextMatch = instructions.match(/<step\s+n="2"\s+title="Context Gathering"/);
      const framingMatch = instructions.match(/<step\s+n="3"\s+title="Problem Framing"/);
      expect(intakeMatch, "Step 1 (Problem Intake) not found").not.toBeNull();
      expect(contextMatch, "Step 2 (Context Gathering) not found").not.toBeNull();
      expect(framingMatch, "Step 3 (Problem Framing) not found").not.toBeNull();
    });

    it("should retain all original steps (now renumbered 3-11)", () => {
      // Original steps: Problem Framing, Root Cause Analysis, Constraint Identification,
      // Solution Generation, Solution Evaluation, Action Plan
      // New numbering: 3, 4, 5, 6, 7, + resolution routing steps 8-11
      const expectedSteps = [
        "Problem Framing",
        "Root Cause Analysis",
        "Constraint Identification",
        "Solution Generation",
        "Solution Evaluation",
      ];
      for (const title of expectedSteps) {
        expect(instructions, `Missing step: ${title}`).toContain(`title="${title}"`);
      }
    });
  });

  // ────────────────────────────────────────────────────
  // AC2: Keyword extraction with semantic expansion
  // ────────────────────────────────────────────────────

  describe("AC2: Keyword extraction", () => {
    it("should extract domain keywords from the problem statement", () => {
      expect(instructions).toContain("Extract domain keywords");
    });

    it("should expand keywords semantically", () => {
      expect(instructions).toContain("expanded semantically");
    });

    it("should not require an external lookup table", () => {
      // The instructions should reference domain knowledge, not a lookup file
      expect(instructions).toContain("domain knowledge");
    });
  });

  // ────────────────────────────────────────────────────
  // AC3: Two-tier artifact scan
  // ────────────────────────────────────────────────────

  describe("AC3: Two-tier artifact scan", () => {
    it("should have Tier 1 artifact scan (always)", () => {
      expect(instructions).toContain("Tier 1");
      expect(instructions).toContain("Artifact Scan");
    });

    it("Tier 1 should scan story files", () => {
      expect(instructions).toContain("Stories (budget: 8K tokens)");
    });

    it("Tier 1 should scan architecture", () => {
      expect(instructions).toContain("Architecture (budget: 5K tokens)");
    });

    it("Tier 1 should scan PRD", () => {
      expect(instructions).toContain("PRD (budget: 5K tokens)");
    });

    it("Tier 1 should scan decision logs from PM/architect/SM sidecars", () => {
      expect(instructions).toContain("Decision Logs (budget: 3K tokens)");
      expect(instructions).toContain("pm-sidecar");
      expect(instructions).toContain("architect-sidecar");
      expect(instructions).toContain("sm-sidecar");
    });

    it("Tier 1 should scan test artifacts", () => {
      expect(instructions).toContain("Test Artifacts (budget: 4K tokens)");
    });

    it("should have Tier 2 codebase scan (conditional on technical problem)", () => {
      expect(instructions).toContain("Tier 2");
      expect(instructions).toContain("Codebase Scan");
      expect(instructions).toContain("problem is technical");
    });

    it("Tier 2 should check git log", () => {
      expect(instructions).toContain("git log");
    });

    it("Tier 2 should identify related test files", () => {
      expect(instructions).toContain("related test files");
    });
  });

  // ────────────────────────────────────────────────────
  // AC4: Token budget configuration
  // ────────────────────────────────────────────────────

  describe("AC4: Token budget configuration", () => {
    it("global.yaml should have problem_solving.context_budget = 30000", () => {
      expect(globalConfig).toHaveProperty("problem_solving");
      expect(globalConfig.problem_solving).toHaveProperty("context_budget", 30000);
    });

    it("workflow.yaml should declare context_budget = 30000", () => {
      expect(workflowConfig).toHaveProperty("context_budget", 30000);
    });

    it("workflow.yaml should declare context_sub_budgets with correct values", () => {
      const sub = workflowConfig.context_sub_budgets;
      expect(sub).toBeDefined();
      expect(sub.stories).toBe(8000);
      expect(sub.architecture).toBe(5000);
      expect(sub.prd).toBe(5000);
      expect(sub.decision_logs).toBe(3000);
      expect(sub.codebase).toBe(5000);
      expect(sub.test_artifacts).toBe(4000);
    });

    it("sub-budgets should sum to <= context_budget", () => {
      const sub = workflowConfig.context_sub_budgets;
      const total = Object.values(sub).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(workflowConfig.context_budget);
    });

    it("instructions should reference summarize (not truncate) on overflow", () => {
      // The instructions should indicate content is summarized, not truncated
      expect(instructions).toContain("Summarize");
    });
  });

  // ────────────────────────────────────────────────────
  // AC5: Context Brief synthesis
  // ────────────────────────────────────────────────────

  describe("AC5: Context Brief generation", () => {
    it("should synthesize a structured Context Brief", () => {
      expect(instructions).toContain("Context Brief");
    });

    it("Context Brief should contain required sections", () => {
      const requiredSections = [
        "Relevant Requirements",
        "Architecture Context",
        "Related Stories",
        "Decision Log Entries",
        "Test Coverage",
      ];
      for (const section of requiredSections) {
        expect(instructions, `Context Brief missing section: ${section}`).toContain(section);
      }
    });

    it("Context Brief should contain keyword hit info", () => {
      expect(instructions).toContain("Keywords");
    });
  });

  // ────────────────────────────────────────────────────
  // AC6: User validation of Context Brief
  // ────────────────────────────────────────────────────

  describe("AC6: User validation and checkpoint", () => {
    it("should ask user to validate the Context Brief", () => {
      // There should be an <ask> tag after the Context Brief synthesis
      expect(instructions).toMatch(/<ask>.*missing from this context.*<\/ask>/s);
    });

    it("should incorporate additional user context", () => {
      expect(instructions).toContain("Incorporate any additional context the user provides");
    });
  });

  // ────────────────────────────────────────────────────
  // AC7: Graceful empty-context fallback
  // ────────────────────────────────────────────────────

  describe("AC7: Empty context fallback", () => {
    it("instructions should not contain a HALT on zero keyword matches", () => {
      // Context Gathering step should not HALT when no matches found.
      // Check that there is no <check> that halts on empty results in step 2.
      const step2 = instructions.match(/<step n="2"[\s\S]*?<\/step>/);
      if (step2) {
        // Should not contain a HALT for empty scan results
        expect(step2[0]).not.toMatch(/HALT.*no.*match/i);
        expect(step2[0]).not.toMatch(/HALT.*empty.*context/i);
      }
    });
  });

  // ────────────────────────────────────────────────────
  // Workflow.yaml: input_file_patterns
  // ────────────────────────────────────────────────────

  describe("Workflow config: input_file_patterns", () => {
    it("should declare input_file_patterns for artifact scanning", () => {
      expect(workflowConfig).toHaveProperty("input_file_patterns");
    });

    it("should include prd, architecture, sprint_status, test_plan, traceability", () => {
      const patterns = workflowConfig.input_file_patterns;
      expect(patterns).toHaveProperty("prd");
      expect(patterns).toHaveProperty("architecture");
      expect(patterns).toHaveProperty("sprint_status");
      expect(patterns).toHaveProperty("test_plan");
      expect(patterns).toHaveProperty("traceability");
    });

    it("all input patterns should use SELECTIVE_LOAD strategy", () => {
      const patterns = workflowConfig.input_file_patterns;
      for (const [key, val] of Object.entries(patterns)) {
        expect(val.load_strategy, `${key} should use SELECTIVE_LOAD`).toBe("SELECTIVE_LOAD");
      }
    });
  });

  // ────────────────────────────────────────────────────
  // Checklist: covers all three phases
  // ────────────────────────────────────────────────────

  describe("Checklist validation", () => {
    it("should cover Phase 1: Intake", () => {
      expect(checklist).toContain("Phase 1: Intake");
    });

    it("should cover Context Gathering checklist items", () => {
      expect(checklist).toContain("Tier 1 artifact scan completed");
      expect(checklist).toContain("Tier 2 codebase scan completed");
      expect(checklist).toContain("Context Brief synthesized");
      expect(checklist).toContain("Context Brief presented to user");
    });

    it("should cover Phase 2: Context-Informed Analysis", () => {
      expect(checklist).toContain("Phase 2: Context-Informed Analysis");
    });

    it("should cover Phase 3: Resolution Routing", () => {
      expect(checklist).toContain("Phase 3: Resolution Routing");
    });

    it("should include test gap identification", () => {
      expect(checklist).toContain("Test gap identified");
    });
  });

  // ────────────────────────────────────────────────────
  // Critical mandates
  // ────────────────────────────────────────────────────

  describe("Critical mandates", () => {
    it("should mandate automatic context gathering (no user interrogation)", () => {
      expect(instructions).toContain(
        "NEVER interrogate the user for information that exists in project artifacts"
      );
    });

    it("should mandate resolution routing through /gaia-create-story", () => {
      expect(instructions).toContain(
        "ALL code-change resolutions MUST route through /gaia-create-story"
      );
    });
  });
});
