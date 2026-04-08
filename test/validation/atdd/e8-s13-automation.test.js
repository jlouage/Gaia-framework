import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";
const MEMORY_DIR = join(PROJECT_ROOT, "_memory");
const SIDECAR_DIR = join(MEMORY_DIR, "validator-sidecar");
const GROUND_TRUTH = join(SIDECAR_DIR, "ground-truth.md");
const DECISION_LOG = join(SIDECAR_DIR, "decision-log.md");
const CONVERSATION_CONTEXT = join(SIDECAR_DIR, "conversation-context.md");

/**
 * E8-S13 Test Automation — Extended Coverage
 *
 * Validates the shipped empty-template invariants for the validator sidecar.
 * Per E9-S22, sidecars ship as empty templates (entry_count: 0). Population
 * is a runtime operation performed by `/gaia-refresh-ground-truth`, not a
 * committed state.
 *
 * Covers:
 * - AC5: Dependency guard (structural prerequisite)
 * - AC6: Empty-template invariant (frontmatter shape, not populated state)
 * - AC7: Ground truth file structure + frontmatter completeness
 * - Decision log and conversation context structural invariants
 */
describe("E8-S13: Test Automation — Extended Coverage", () => {
  // ─── AC5: Dependency guard prerequisite ───
  describe("AC5: Dependency guard — _memory/ must exist", () => {
    it("_memory/ directory exists at project root (prerequisite from E8-S1)", () => {
      expect(existsSync(MEMORY_DIR), "_memory/ directory must exist — E8-S1 dependency").toBe(true);
    });

    it("_memory/config.yaml exists (prerequisite from E8-S1)", () => {
      const configPath = join(MEMORY_DIR, "config.yaml");
      expect(existsSync(configPath), "_memory/config.yaml must exist — E8-S1 dependency").toBe(
        true
      );
    });
  });

  // ─── AC6: Empty-template invariant (E9-S22) ───
  describe("AC6: Shipped empty-template invariant", () => {
    it("ground-truth.md has entry_count: 0 (shipped as empty template per E9-S22)", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const match = content.match(/entry_count:\s*(\d+)/);
      expect(match, "entry_count field must exist in frontmatter").not.toBeNull();
      const count = parseInt(match[1], 10);
      expect(count, "entry_count must be 0 in the shipped template").toBe(0);
    });

    it("ground-truth.md has estimated_tokens: 0 (shipped as empty template)", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const match = content.match(/estimated_tokens:\s*(\d+)/);
      expect(match, "estimated_tokens field must exist in frontmatter").not.toBeNull();
      expect(parseInt(match[1], 10)).toBe(0);
    });

    it("ground-truth.md has YAML frontmatter followed by a header and description", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const parts = content.split("---");
      expect(parts.length, "File must have frontmatter and body").toBeGreaterThanOrEqual(3);
      const body = parts.slice(2).join("---").trim();
      // Body should contain the canonical "Ground Truth" header
      expect(body, "Body must contain Ground Truth header").toMatch(/# Ground Truth/);
    });
  });

  // ─── Ground truth frontmatter completeness ───
  describe("Ground truth frontmatter completeness", () => {
    it("frontmatter contains all required metadata fields", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const requiredFields = [
        "agent",
        "tier",
        "token_budget",
        "last_refresh",
        "entry_count",
        "estimated_tokens",
      ];

      for (const field of requiredFields) {
        expect(content, `Missing frontmatter field: ${field}`).toMatch(new RegExp(`${field}:`));
      }
    });

    it("last_refresh is a non-null ISO date string", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const match = content.match(/last_refresh:\s*"?([^"\n]+)"?/);
      expect(match, "last_refresh must exist").not.toBeNull();
      expect(match[1], "last_refresh must not be null").not.toBe("null");
      // Should contain a date-like pattern (YYYY-MM-DD)
      expect(match[1]).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("token_budget is a positive number", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const match = content.match(/token_budget:\s*(\d+)/);
      expect(match, "token_budget must exist").not.toBeNull();
      expect(parseInt(match[1], 10)).toBeGreaterThan(0);
    });

    it("agent field is 'validator'", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      expect(content).toMatch(/agent:\s*validator/);
    });

    it("tier is 1 (Tier 1 — Rich memory)", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      expect(content).toMatch(/tier:\s*1/);
    });
  });

  // ─── Decision log structure ───
  describe("Decision log structure", () => {
    it("decision-log.md exists with YAML frontmatter", () => {
      expect(existsSync(DECISION_LOG)).toBe(true);
      const content = readFileSync(DECISION_LOG, "utf-8");
      expect(content.startsWith("---"), "Must start with YAML frontmatter").toBe(true);
      expect(content).toMatch(/agent:\s*validator/);
    });

    it("decision-log.md frontmatter has entry_count: 0 (empty template)", () => {
      const content = readFileSync(DECISION_LOG, "utf-8");
      const match = content.match(/entry_count:\s*(\d+)/);
      expect(match, "entry_count must exist in decision-log frontmatter").not.toBeNull();
      expect(parseInt(match[1], 10)).toBe(0);
    });

    it("decision-log.md has Decision Log header", () => {
      const content = readFileSync(DECISION_LOG, "utf-8");
      expect(content).toMatch(/# Decision Log/);
    });
  });

  // ─── Conversation context structure ───
  describe("Conversation context structure", () => {
    it("conversation-context.md exists with YAML frontmatter", () => {
      expect(existsSync(CONVERSATION_CONTEXT)).toBe(true);
      const content = readFileSync(CONVERSATION_CONTEXT, "utf-8");
      expect(content.startsWith("---"), "Must start with YAML frontmatter").toBe(true);
      expect(content).toMatch(/agent:\s*validator/);
    });

    it("conversation-context.md has session_count of 0 (no sessions yet)", () => {
      const content = readFileSync(CONVERSATION_CONTEXT, "utf-8");
      expect(content).toMatch(/session_count:\s*0/);
    });

    it("conversation-context.md has last_session as null", () => {
      const content = readFileSync(CONVERSATION_CONTEXT, "utf-8");
      expect(content).toMatch(/last_session:\s*null/);
    });
  });

  // ─── Cross-file consistency ───
  describe("Cross-file consistency", () => {
    it("all 3 sidecar files reference agent: validator", () => {
      const files = [GROUND_TRUTH, DECISION_LOG, CONVERSATION_CONTEXT];
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        expect(content, `${file} must reference agent: validator`).toMatch(/agent:\s*validator/);
      }
    });
  });
});
