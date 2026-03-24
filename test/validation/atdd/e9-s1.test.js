import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const VALIDATOR_MD = join(
  PROJECT_ROOT,
  "_gaia/lifecycle/agents/validator.md"
);

function loadValidator() {
  expect(existsSync(VALIDATOR_MD)).toBe(true);
  return readFileSync(VALIDATOR_MD, "utf-8");
}

describe("E9-S1: Tier 1 Memory — Val Load/Save Protocol", () => {
  // AC1: All 3 sidecar files loaded at activation
  describe("AC1: Activation loads all 3 sidecar files", () => {
    it("test_ac1_activation_loads_all_3_files — activation step loads ground-truth.md, decision-log.md, and conversation-context.md", () => {
      const content = loadValidator();
      // Activation must reference loading all 3 sidecar files
      expect(content).toContain("ground-truth.md");
      expect(content).toContain("decision-log.md");
      expect(content).toContain("conversation-context.md");
      // The activation block must mention loading all 3, not just conversation-context
      // Look for the activation section and verify it references all 3 files in its load step
      const activationMatch = content.match(
        /<activation[\s\S]*?<\/activation>/
      );
      expect(activationMatch).not.toBeNull();
      const activationBlock = activationMatch[0];
      expect(activationBlock).toContain("ground-truth.md");
      expect(activationBlock).toContain("decision-log.md");
      expect(activationBlock).toContain("conversation-context.md");
    });
  });

  // AC2: Session-save with user confirmation
  describe("AC2: Session-save with user confirmation", () => {
    it("test_ac2_session_save_protocol — save protocol presents summary for user confirmation before writing", () => {
      const content = loadValidator();
      // Must have a session-save section
      expect(content).toMatch(/session.save/i);
      // Must mention user confirmation before writing
      expect(content).toMatch(/confirm/i);
      // Must mention what happens when user declines
      expect(content).toMatch(/decline/i);
    });
  });

  // AC3: Token budget enforcement
  describe("AC3: Token budget enforcement", () => {
    it("test_ac3_budget_enforcement — enforces 300K session, 200K ground-truth, 150K cross-ref cap", () => {
      const content = loadValidator();
      // Must reference the budget values
      expect(content).toContain("300");
      expect(content).toMatch(/200.*ground.truth|ground.truth.*200/is);
      // Cross-ref cap at 50% (150K)
      expect(content).toMatch(/150|50%|cross.ref.*cap/i);
    });

    it("test_ac3_warning_thresholds — triggers warnings at 80%, 90%, 100%", () => {
      const content = loadValidator();
      expect(content).toContain("80%");
      expect(content).toContain("90%");
      expect(content).toContain("100%");
    });

    it("test_ac3_token_approximation — uses 4 chars/token approximation", () => {
      const content = loadValidator();
      expect(content).toMatch(/4\s*char/i);
    });
  });

  // AC4: session-load skill reference with correct parameters
  describe("AC4: session-load skill reference", () => {
    it("test_ac4_session_load_parameters — references memory-management session-load with sidecar_path, tier_budget=300000, recent_n=20", () => {
      const content = loadValidator();
      // Must reference memory-management skill session-load section
      expect(content).toMatch(/memory.management/i);
      expect(content).toMatch(/session.load/i);
      // Must include the specific parameters
      expect(content).toMatch(/sidecar_path/i);
      expect(content).toMatch(/validator-sidecar/);
      expect(content).toContain("300000");
      expect(content).toMatch(/recent_n.*20|20.*recent/i);
    });
  });

  // AC5: Graceful fallback for missing/unparseable files
  describe("AC5: Graceful fallback for missing/unparseable files", () => {
    it("test_ac5_graceful_fallback — initializes stubs for missing files, warns user, continues activation", () => {
      const content = loadValidator();
      // Must mention handling missing/unparseable files
      expect(content).toMatch(/missing|unparseable|corrupt/i);
      // Must mention stub/empty initialization
      expect(content).toMatch(/stub|empty|initialize/i);
      // Must mention warning the user
      expect(content).toMatch(/warn/i);
      // Must NOT abort on missing files
      expect(content).toMatch(/continue|does not abort|do not abort/i);
    });
  });

  // AC6: Archival at 100% budget
  describe("AC6: Archival at 100% budget", () => {
    it("test_ac6_archival_protocol — at 100% offers Archive or Force Save, archives decision-log only", () => {
      const content = loadValidator();
      // Must mention archival
      expect(content).toMatch(/archiv/i);
      // Must mention Archive and Force Save options
      expect(content).toMatch(/archive/i);
      expect(content).toMatch(/force.*save/i);
      // Ground-truth must never be archived
      expect(content).toMatch(
        /ground.truth.*never.*archiv|never.*archiv.*ground.truth/is
      );
    });

    it("test_ac6_archive_directory — archives to archive/ subdirectory", () => {
      const content = loadValidator();
      expect(content).toMatch(/archive\//);
    });
  });

  // Structural constraints
  describe("Structural constraints", () => {
    it("test_structural_line_count — validator.md stays under 400 lines", () => {
      const content = loadValidator();
      const lineCount = content.split("\n").length;
      expect(lineCount).toBeLessThanOrEqual(400);
    });

    it("test_structural_conversation_context_rolling_replace — conversation-context uses rolling replace", () => {
      const content = loadValidator();
      expect(content).toMatch(/rolling.*replace|full.*overwrite|overwrit/i);
    });

    it("test_structural_decision_log_full_read_write — decision-log uses full-file read + write pattern", () => {
      const content = loadValidator();
      expect(content).toMatch(/full.file.*read|read.*append.*write/i);
    });
  });
});
