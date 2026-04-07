import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const WORKFLOW_YAML = join(
  PROJECT_ROOT,
  "_gaia",
  "creative",
  "workflows",
  "problem-solving",
  "workflow.yaml"
);
const INSTRUCTIONS_XML = join(
  PROJECT_ROOT,
  "_gaia",
  "creative",
  "workflows",
  "problem-solving",
  "instructions.xml"
);
const GLOBAL_YAML = join(PROJECT_ROOT, "_gaia", "_config", "global.yaml");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E16-S1: Context Gathering Protocol (Step 0)", () => {
  // AC1: New Step 0 (Context Gathering) is inserted before existing Step 1
  describe("AC1: Step 0 inserted before existing Step 1", () => {
    it("instructions.xml contains a context gathering step before the first analysis step", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // A step dedicated to context gathering must exist
      expect(content).toMatch(/step\s+n=["']?\d+["']?\s+title=["'][^"']*[Cc]ontext\s*[Gg]ather/);
    });

    it("context gathering step number precedes the first analysis step", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Extract step numbers and titles
      const steps = [...content.matchAll(/step\s+n=["']?(\d+)["']?\s+title=["']([^"']+)["']/g)];
      const contextStep = steps.find((s) => /context.?gather/i.test(s[2]));
      // Context gathering step must exist
      expect(contextStep).toBeDefined();
      // Its step number must be less than or equal to 2 (Step 0 or Step 1 position —
      // the key requirement is it comes BEFORE the original analysis steps)
      expect(Number(contextStep[1])).toBeLessThanOrEqual(2);
    });
  });

  // AC2: Keyword extraction parses problem statement for file names, module names,
  // error signatures, and domain terms (FR-179)
  describe("AC2: Keyword extraction from problem statement", () => {
    it("instructions.xml references keyword extraction from the problem statement", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must mention extracting/parsing keywords from the problem statement
      expect(content).toMatch(/keyword/i);
      expect(content).toMatch(/extract|pars/i);
    });

    it("keyword extraction covers file names, module names, error signatures, and domain terms", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference the four categories of extracted terms
      // (can be in any order, across multiple lines)
      expect(content).toMatch(/file\s*name/i);
      expect(content).toMatch(/module\s*name/i);
      expect(content).toMatch(/error\s*signature/i);
      expect(content).toMatch(/domain\s*term/i);
    });
  });

  // AC3: Two-tier artifact scan — Tier 1 scans planning artifacts,
  // Tier 2 scans source code matching extracted keywords (FR-180)
  describe("AC3: Two-tier artifact scan", () => {
    it("instructions.xml defines a Tier 1 scan of planning artifacts", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference Tier 1 scanning planning artifacts (PRD, architecture, epics)
      expect(content).toMatch(/[Tt]ier\s*1/);
      expect(content).toMatch(/planning.?artifact|prd|architecture|epic/i);
    });

    it("instructions.xml defines a Tier 2 scan of source code files", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference Tier 2 scanning source code / codebase
      expect(content).toMatch(/[Tt]ier\s*2/);
      expect(content).toMatch(/source\s*code|codebase|{project.?path}/i);
    });
  });

  // AC4: Token budget enforcement from global.yaml with configurable limit,
  // default 8K tokens, prioritized by relevance score (FR-181)
  describe("AC4: Token budget enforcement from global.yaml", () => {
    it("workflow.yaml declares context_budget configuration", () => {
      const content = loadFile(WORKFLOW_YAML);
      expect(content).not.toBeNull();
      // Must have a context_budget field
      expect(content).toMatch(/context_budget/);
    });

    it("instructions.xml enforces a token budget cap on gathered context", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference token budget enforcement or cap
      expect(content).toMatch(/token\s*budget|budget.*cap|budget.*enforce/i);
      // Must mention prioritization by relevance
      expect(content).toMatch(/relevance|prioriti/i);
    });
  });

  // AC5: Context Brief generated as structured summary with required sections:
  // matched artifacts with excerpts, matched source files with snippets,
  // keyword hit counts, and token usage (FR-182)
  describe("AC5: Context Brief with required sections", () => {
    it("instructions.xml generates a Context Brief with structured sections", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference generating a "Context Brief"
      expect(content).toMatch(/[Cc]ontext\s*[Bb]rief/);
      // Must include artifact excerpts/matches
      expect(content).toMatch(/artifact|excerpt|snippet/i);
    });

    it("Context Brief includes keyword hit counts and token usage", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must track keyword hit counts
      expect(content).toMatch(/keyword.*hit|hit.*count|keyword.*count/i);
      // Must report token usage
      expect(content).toMatch(/token\s*usage/i);
    });
  });

  // AC6: Context Brief persisted to workflow checkpoint for subsequent steps (FR-183)
  describe("AC6: Context Brief persisted to checkpoint", () => {
    it("instructions.xml persists Context Brief to checkpoint or makes it available to subsequent steps", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference persisting the context brief to checkpoint or passing it to later steps
      // The key behavior: subsequent steps can access the gathered context
      expect(content).toMatch(
        /[Cc]ontext\s*[Bb]rief.*(?:checkpoint|subsequent|later|next|step|persist|save)|(?:checkpoint|persist|save).*[Cc]ontext\s*[Bb]rief/
      );
    });
  });

  // AC7: When no relevant context is found, workflow proceeds gracefully
  // with empty Context Brief and logs info-level note
  describe("AC7: Graceful handling when no context found", () => {
    it("instructions.xml handles empty context gracefully with an info-level note", () => {
      const content = loadFile(INSTRUCTIONS_XML);
      expect(content).not.toBeNull();
      // Must reference the no-context / empty scenario
      expect(content).toMatch(
        /no.*(?:relevant|matching).*context|empty.*[Cc]ontext\s*[Bb]rief|no.*context.*found/i
      );
      // Must proceed gracefully (not halt/error)
      expect(content).toMatch(/proceed|graceful|continue|info/i);
    });
  });
});
