/**
 * Documentation Count Alignment — E2-S7
 *
 * Tier classification: Tier 1 (programmatic, CI-safe)
 * Verifies that documentation references (counts, paths, classifications)
 * match actual framework state. Pure file-reading — no LLM runtime needed.
 *
 * References: ADR-001, E2-S7 (AC1–AC4)
 */

import { describe, it, expect } from "vitest";
import { resolve, join } from "path";
import { readFileSync } from "fs";
import { getWorkflowPaths } from "../helpers/workflow-paths.js";
import { loadYaml } from "../../validators/config-validator.js";

// FRAMEWORK_ROOT: outer project root where _gaia/ and docs/ live
const FRAMEWORK_ROOT = resolve(import.meta.dirname, "../../../..");

/**
 * Count total quality gate checks across all non-backup workflow.yaml files.
 */
function countQualityGateChecks() {
  const workflowPaths = getWorkflowPaths(FRAMEWORK_ROOT);
  let totalChecks = 0;

  for (const wfPath of workflowPaths) {
    const parsed = loadYaml(wfPath);

    if (parsed?.quality_gates) {
      for (const section of ["pre_start", "post_complete"]) {
        if (Array.isArray(parsed.quality_gates[section])) {
          totalChecks += parsed.quality_gates[section].length;
        }
      }
    }
  }
  return totalChecks;
}

/**
 * Count story headers per epic in epics-and-stories.md.
 */
function countStoriesPerEpic(content) {
  const counts = {};
  const pattern = /^### Story (E\d+)-S\d+/gm;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const epic = match[1];
    counts[epic] = (counts[epic] || 0) + 1;
  }
  return counts;
}

/**
 * Parse epic overview table from epics-and-stories.md.
 * Returns map of epic -> documented story count.
 */
function parseOverviewTable(content) {
  const counts = {};
  // Match table rows like: | E1 | Framework Core Validation | ... | 8 | P0 |
  const tablePattern = /^\|\s*(E\d+)\s*\|[^|]+\|[^|]+\|\s*(\d+)\s*\|/gm;
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    counts[match[1]] = parseInt(match[2], 10);
  }
  return counts;
}

/**
 * Extract a story section from epics-and-stories.md by story key.
 * Returns the text from "### Story {key}" up to the next story or epic section.
 */
function extractStorySection(content, storyKey) {
  const pattern = new RegExp(`### Story ${storyKey}[\\s\\S]*?(?=### Story \\w|---\\s*\\n## E|$)`);
  const match = content.match(pattern);
  return match ? match[0] : null;
}

describe("E2-S7: Documentation Count Alignment", () => {
  const epicsPath = join(FRAMEWORK_ROOT, "docs/planning-artifacts/epics-and-stories.md");
  const epicsContent = readFileSync(epicsPath, "utf8");

  describe("AC1: Quality gate count accuracy", () => {
    it("E2-S5 description references the correct quality gate count", () => {
      const actualCount = countQualityGateChecks();
      const section = extractStorySection(epicsContent, "E2-S5");
      expect(section, "E2-S5 section not found in epics-and-stories.md").not.toBeNull();
      const countMatch = section.match(/all\s+(\d+)\s+quality\s+gate/i);
      expect(
        countMatch,
        "No 'all N quality gate' pattern found in E2-S5 description"
      ).not.toBeNull();
      const documentedCount = parseInt(countMatch[1], 10);
      expect(documentedCount).toBe(actualCount);
    });
  });

  describe("AC2: Tier path classification", () => {
    it("E2-S5 AC4 has tier classification consistent with ADR-001", () => {
      const section = extractStorySection(epicsContent, "E2-S5");
      expect(section, "E2-S5 section not found in epics-and-stories.md").not.toBeNull();
      expect(section).toMatch(/tier1\/quality-gates\.test\.js/);
      expect(
        section,
        "E2-S5 AC4 should reference ADR-001 or Tier 1 programmatic classification"
      ).toMatch(/[Tt]ier\s*1.*programmatic|programmatic.*[Tt]ier\s*1|ADR-001/);
    });
  });

  describe("AC3: E2-S2 test file path", () => {
    it("E2-S2 Dev Notes include a test file path", () => {
      const section = extractStorySection(epicsContent, "E2-S2");
      expect(section, "E2-S2 section not found in epics-and-stories.md").not.toBeNull();
      expect(section, "E2-S2 Dev Notes should contain a test file path").toMatch(
        /[Tt]est\s*file.*test\//
      );
    });
  });

  describe("AC4: Epic overview story counts", () => {
    it("all epic overview table counts match actual story counts", () => {
      const documentedCounts = parseOverviewTable(epicsContent);
      const actualCounts = countStoriesPerEpic(epicsContent);

      // Ensure we found the table
      expect(Object.keys(documentedCounts).length).toBeGreaterThan(0);

      for (const [epic, documented] of Object.entries(documentedCounts)) {
        const actual = actualCounts[epic] || 0;
        expect(documented, `${epic}: documented ${documented}, actual ${actual}`).toBe(actual);
      }
    });
  });
});
