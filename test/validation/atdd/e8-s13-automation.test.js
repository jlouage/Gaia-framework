import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

// Project root is where _gaia/ lives (3 levels up from test/validation/atdd/)
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const MEMORY_DIR = join(PROJECT_ROOT, "_memory");
const SIDECAR_DIR = join(MEMORY_DIR, "validator-sidecar");
const GROUND_TRUTH = join(SIDECAR_DIR, "ground-truth.md");
const DECISION_LOG = join(SIDECAR_DIR, "decision-log.md");
const CONVERSATION_CONTEXT = join(SIDECAR_DIR, "conversation-context.md");

/**
 * E8-S13 Test Automation — Extended Coverage
 *
 * Fills gaps not covered by the ATDD tests in e8-s13.test.js:
 * - AC5: Dependency guard (structural prerequisite)
 * - AC6: Idempotent execution (frontmatter entry_count > 0 proves populated state)
 * - AC7: Automated spot-check of ground truth paths against filesystem
 * - Ground truth frontmatter completeness
 * - Decision log structure
 * - Conversation context structure
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

  // ─── AC6: Idempotent execution ───
  describe("AC6: Idempotent execution — ground truth is populated, not empty", () => {
    it("ground-truth.md entry_count is greater than 0 (proves seed ran)", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const match = content.match(/entry_count:\s*(\d+)/);
      expect(match, "entry_count field must exist in frontmatter").not.toBeNull();
      const count = parseInt(match[1], 10);
      expect(count, "entry_count must be > 0 after seed").toBeGreaterThan(0);
    });

    it("ground-truth.md has inventory content beyond just frontmatter", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      // Split on closing frontmatter delimiter
      const parts = content.split("---");
      // parts[0] is empty (before first ---), parts[1] is frontmatter, parts[2+] is body
      expect(parts.length, "File must have frontmatter and body").toBeGreaterThanOrEqual(3);
      const body = parts.slice(2).join("---").trim();
      expect(body.length, "Body must have substantial content").toBeGreaterThan(100);
    });
  });

  // ─── AC7: Automated spot-check of ground truth entries ───
  describe("AC7: Ground truth path verification — spot check", () => {
    it("5 workflow paths from ground truth exist on the filesystem", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      // Extract all workflow.yaml paths from the ground truth
      const pathPattern = /^- (_gaia\/[^\s]+\/workflow\.yaml)$/gm;
      const paths = [];
      let match;
      while ((match = pathPattern.exec(content)) !== null) {
        paths.push(match[1]);
      }
      expect(paths.length, "Ground truth must list workflow paths").toBeGreaterThan(5);

      // Pick 5 evenly spaced entries for spot-check
      const step = Math.floor(paths.length / 5);
      const samples = [
        paths[0],
        paths[step],
        paths[step * 2],
        paths[step * 3],
        paths[paths.length - 1],
      ];

      for (const relativePath of samples) {
        const fullPath = join(PROJECT_ROOT, relativePath);
        expect(existsSync(fullPath), `Ground truth path does not exist: ${relativePath}`).toBe(
          true
        );
      }
    });

    it("5 agent paths from ground truth exist on the filesystem", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const pathPattern = /^- (_gaia\/[^\s]+\/agents\/[^\s]+\.md)$/gm;
      const paths = [];
      let match;
      while ((match = pathPattern.exec(content)) !== null) {
        paths.push(match[1]);
      }
      expect(paths.length, "Ground truth must list agent paths").toBeGreaterThan(5);

      const step = Math.floor(paths.length / 5);
      const samples = [
        paths[0],
        paths[step],
        paths[step * 2],
        paths[step * 3],
        paths[paths.length - 1],
      ];

      for (const relativePath of samples) {
        const fullPath = join(PROJECT_ROOT, relativePath);
        expect(existsSync(fullPath), `Ground truth path does not exist: ${relativePath}`).toBe(
          true
        );
      }
    });

    it("manifest paths from ground truth exist on the filesystem", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const pathPattern = /^- (_gaia\/_config\/[^\s]+\.csv)$/gm;
      const paths = [];
      let match;
      while ((match = pathPattern.exec(content)) !== null) {
        paths.push(match[1]);
      }
      expect(paths.length, "Ground truth must list manifest CSV paths").toBeGreaterThan(0);

      for (const relativePath of paths) {
        const fullPath = join(PROJECT_ROOT, relativePath);
        expect(
          existsSync(fullPath),
          `Ground truth manifest path does not exist: ${relativePath}`
        ).toBe(true);
      }
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

    it("estimated_tokens is a positive number", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      const match = content.match(/estimated_tokens:\s*(\d+)/);
      expect(match, "estimated_tokens must exist").not.toBeNull();
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

    it("decision-log.md contains a seed entry", () => {
      const content = readFileSync(DECISION_LOG, "utf-8").toLowerCase();
      expect(content).toContain("seed");
      expect(content).toContain("validator sidecar");
    });

    it("decision-log.md frontmatter has entry_count >= 1", () => {
      const content = readFileSync(DECISION_LOG, "utf-8");
      const match = content.match(/entry_count:\s*(\d+)/);
      expect(match, "entry_count must exist in decision-log frontmatter").not.toBeNull();
      expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(1);
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
    it("ground truth workflow count matches actual workflow.yaml files on disk", () => {
      const content = readFileSync(GROUND_TRUTH, "utf-8");
      // Extract the total workflow count from the heading like "### Workflows (71)"
      const match = content.match(/### Workflows \((\d+)\)/);
      expect(match, "Workflows section with count must exist").not.toBeNull();
      const claimedCount = parseInt(match[1], 10);

      // Count actual workflow.yaml files
      const countWorkflows = (dir) => {
        let count = 0;
        if (!existsSync(dir)) return 0;
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            count += countWorkflows(fullPath);
          } else if (entry.name === "workflow.yaml") {
            count++;
          }
        }
        return count;
      };

      const gaiaDir = join(PROJECT_ROOT, "_gaia");
      const actualCount = countWorkflows(gaiaDir);

      // Allow a small delta (max 3) for workflows added after seed
      expect(
        Math.abs(claimedCount - actualCount),
        `Ground truth claims ${claimedCount} workflows but found ${actualCount}`
      ).toBeLessThanOrEqual(3);
    });

    it("all 3 sidecar files reference agent: validator", () => {
      const files = [GROUND_TRUTH, DECISION_LOG, CONVERSATION_CONTEXT];
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        expect(content, `${file} must reference agent: validator`).toMatch(/agent:\s*validator/);
      }
    });
  });
});
