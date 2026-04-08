/**
 * ATDD Tests — E13-S10: Design-to-Implementation Fidelity Gate
 *
 * These tests verify that the fidelity check section exists in
 * figma-integration.md and integrates with the code-review workflow.
 *
 * RED PHASE: All tests must fail until E13-S10 is implemented.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const FIGMA_SKILL = resolve(
  PROJECT_ROOT,
  "_gaia/dev/skills/figma-integration.md"
);

const SKILL_INDEX = resolve(
  PROJECT_ROOT,
  "_gaia/dev/skills/_skill-index.yaml"
);

const CODE_REVIEW_INSTRUCTIONS = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/4-implementation/code-review/instructions.xml"
);

// ─── Helpers ─────────────────────────────────────────────────

function readFigmaSkill() {
  return readFileSync(FIGMA_SKILL, "utf-8");
}

function readSkillIndex() {
  return readFileSync(SKILL_INDEX, "utf-8");
}

function readCodeReview() {
  return readFileSync(CODE_REVIEW_INSTRUCTIONS, "utf-8");
}

// ─── AC1: Fidelity comparison engine ─────────────────────────

describe("AC1: Fidelity comparison engine", () => {
  it("figma-integration.md exists", () => {
    expect(existsSync(FIGMA_SKILL)).toBe(true);
  });

  it("has a fidelity section marker", () => {
    const content = readFigmaSkill();
    expect(content).toContain("<!-- SECTION: fidelity -->");
  });

  it("references design-tokens.json as comparison source", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/design-tokens\.json/);
  });

  it("classifies tokens as matched, drifted, or missing", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/matched/i);
    expect(content).toMatch(/drifted/i);
    expect(content).toMatch(/missing/i);
  });

  it("describes token extraction from generated code", () => {
    const content = readFigmaSkill();
    // Must describe extracting token references from code files
    expect(content).toMatch(/token.*extract|extract.*token/i);
  });

  it("describes deep comparison between code values and design-tokens.json", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/compar/i);
  });
});

// ─── AC2: Per-category drift reporting ───────────────────────

describe("AC2: Per-category drift reporting", () => {
  it("groups tokens by W3C DTCG categories", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/color\.\*/);
    expect(content).toMatch(/typography\.\*/);
    expect(content).toMatch(/spacing\.\*/);
    expect(content).toMatch(/border\.\*/);
  });

  it("calculates drift percentage per category", () => {
    const content = readFigmaSkill();
    // Must contain the drift formula
    expect(content).toMatch(
      /\(drifted\s*\+\s*missing\)\s*\/\s*total\s*[x×]\s*100/i
    );
  });

  it("generates per-category breakdown table", () => {
    const content = readFigmaSkill();
    // Must reference a per-category breakdown or table
    expect(content).toMatch(/per-category|category.*breakdown|breakdown.*table/i);
  });
});

// ─── AC3: Threshold-based gating ─────────────────────────────

describe("AC3: Threshold-based gating", () => {
  it("defines 10% warning threshold", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/10%.*warn|warn.*10%/i);
  });

  it("defines 25% block threshold", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/25%.*block|block.*25%/i);
  });

  it("handles N=1 edge case (single-token category)", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/N=1|single.token|one.token/i);
  });

  it("handles empty token categories gracefully", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/empty.*categor|categor.*empty|skip.*empty/i);
  });

  it("handles missing design-tokens.json gracefully", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/design-tokens\.json.*not.*exist|missing.*design-tokens|skip.*graceful/i);
  });
});

// ─── AC4: Report persistence ─────────────────────────────────

describe("AC4: Report persistence", () => {
  it("saves report to reviews/{story_key}/fidelity-report.md", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/reviews\/.*fidelity-report\.md/);
  });

  it("records figma.fidelity_drift_pct in story frontmatter", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/figma\.fidelity_drift_pct|fidelity_drift_pct/);
  });

  it("includes timestamp and story key in report", () => {
    const content = readFigmaSkill();
    expect(content).toMatch(/timestamp/i);
    expect(content).toMatch(/story.key|story_key/i);
  });
});

// ─── AC5: Integration with /gaia-code-review ─────────────────

describe("AC5: Integration with /gaia-code-review", () => {
  it("code-review instructions contain a fidelity check step", () => {
    const content = readCodeReview();
    expect(content).toMatch(/fidelity/i);
  });

  it("fidelity step is conditional on figma block presence", () => {
    const content = readCodeReview();
    expect(content).toMatch(/figma/i);
    expect(content).toMatch(/if=.*figma|story_has_figma/i);
  });

  it("fidelity step loads figma-integration:fidelity section", () => {
    const content = readCodeReview();
    expect(content).toMatch(/figma-integration.*fidelity|fidelity.*section/i);
  });

  it("fidelity results are included in review findings", () => {
    const content = readCodeReview();
    expect(content).toMatch(/fidelity.*finding|fidelity.*result|fidelity.*review/i);
  });
});

// ─── Skill index registration ────────────────────────────────

describe("Skill index: figma-integration entry", () => {
  it("skill-index.yaml contains figma-integration.md entry", () => {
    const content = readSkillIndex();
    expect(content).toContain("figma-integration.md");
  });

  it("skill-index has a fidelity section listed", () => {
    const content = readSkillIndex();
    expect(content).toMatch(/id:\s*fidelity/);
  });
});
