import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const CONFIG_PATH = join(PROJECT_ROOT, "_gaia", "_config");

/**
 * Parse lifecycle-sequence.yaml and extract top-level workflow keys in order.
 */
function parseLifecycleSequenceKeys(filePath) {
  const content = readFileSync(filePath, "utf8");
  const keys = [];
  const lines = content.split("\n");
  let inSequence = false;
  for (const line of lines) {
    if (line.match(/^sequence:\s*$/)) {
      inSequence = true;
      continue;
    }
    if (inSequence) {
      const match = line.match(/^ {2}([a-z][a-z0-9-]*):\s*$/);
      if (match) {
        keys.push(match[1]);
      }
    }
  }
  return keys;
}

/**
 * Extract the block for a given workflow key from lifecycle-sequence.yaml.
 * Returns the full text block from the key line until the next top-level key.
 */
function getWorkflowBlock(content, workflowKey) {
  const lines = content.split("\n");
  const startPattern = new RegExp(`^ {2}${workflowKey}:\\s*$`);
  const nextKeyPattern = /^ {2}[a-z][a-z0-9-]*:\s*$/;
  let capturing = false;
  let block = [];

  for (const line of lines) {
    if (!capturing && startPattern.test(line)) {
      capturing = true;
      block.push(line);
      continue;
    }
    if (capturing) {
      if (nextKeyPattern.test(line)) break;
      block.push(line);
    }
  }
  return block.join("\n");
}

/**
 * Extract the 'next' field values for a given workflow key from lifecycle-sequence.yaml.
 */
function getNextValues(content, workflowKey) {
  const block = getWorkflowBlock(content, workflowKey);
  if (!block) return {};

  const result = {};

  const primaryMatch = block.match(/primary:\s*(\S+)/);
  if (primaryMatch) result.primary = primaryMatch[1];

  const onPassMatch = block.match(/on_pass:\s*(\S+)/);
  if (onPassMatch) result.on_pass = onPassMatch[1];

  const onFailMatch = block.match(/on_fail:\s*(\S+)/);
  if (onFailMatch) result.on_fail = onFailMatch[1];

  return result;
}

describe("Lifecycle Order Correction (E10-S8)", () => {
  const sequencePath = join(CONFIG_PATH, "lifecycle-sequence.yaml");
  const content = readFileSync(sequencePath, "utf8");
  const keys = parseLifecycleSequenceKeys(sequencePath);

  // AC1: The order is PRD -> val-validate -> UX -> Architecture
  describe("AC1: Correct lifecycle sequence order", () => {
    it("create-prd should point to /gaia-val-validate as next primary", () => {
      const next = getNextValues(content, "create-prd");
      expect(next.primary).toBe("/gaia-val-validate");
    });

    it("val-validate should exist in Phase 2 and point to /gaia-create-ux on pass", () => {
      // There should be a val-validate entry that routes to create-ux
      expect(content).toMatch(
        /val-validate:[\s\S]*?on_pass:\s*\/gaia-create-ux/
      );
    });

    it("val-validate should point to /gaia-edit-prd on fail", () => {
      expect(content).toMatch(
        /val-validate:[\s\S]*?on_fail:\s*\/gaia-edit-prd/
      );
    });

    it("create-ux-design should appear after val-validate and before create-architecture in key order", () => {
      const valIdx = keys.indexOf("val-validate");
      const uxIdx = keys.indexOf("create-ux-design");
      const archIdx = keys.indexOf("create-architecture");

      expect(valIdx).toBeGreaterThan(-1);
      expect(uxIdx).toBeGreaterThan(-1);
      expect(archIdx).toBeGreaterThan(-1);
      expect(uxIdx).toBeGreaterThan(valIdx);
      expect(archIdx).toBeGreaterThan(uxIdx);
    });
  });

  // AC2: validate-prd is removed from the lifecycle flow
  describe("AC2: validate-prd removed from lifecycle flow", () => {
    it("validate-prd should be marked as standalone (not part of lifecycle flow)", () => {
      const block = getWorkflowBlock(content, "validate-prd");
      expect(block).toMatch(/standalone:\s*true/);
    });

    it("validate-prd should NOT be referenced as a next target by any active workflow", () => {
      // Remove comment lines and the validate-prd block itself, then check for references
      const noComments = content
        .split("\n")
        .filter((l) => !l.match(/^\s*#/))
        .join("\n");
      // Extract all 'primary:', 'on_pass:', 'on_fail:' values — none should reference validate-prd
      const nextTargets = noComments.match(
        /(?:primary|on_pass|on_fail|on_all_passed|on_failures|on_pending):\s*(\S+)/g
      );
      const targetValues = (nextTargets || []).map((m) =>
        m.replace(/^.*:\s*/, "")
      );
      expect(targetValues).not.toContain("/gaia-validate-prd");
    });

    it("no workflow in the Phase 2 planning flow should point to /gaia-validate-prd", () => {
      const prdNext = getNextValues(content, "create-prd");
      const editPrdNext = getNextValues(content, "edit-prd");
      expect(prdNext.primary).not.toBe("/gaia-validate-prd");
      expect(editPrdNext.primary).not.toBe("/gaia-validate-prd");
    });
  });

  // AC3: create-ux is inserted between val-validate and architecture
  describe("AC3: create-ux positioned correctly", () => {
    it("create-ux-design should exist in the sequence", () => {
      expect(keys).toContain("create-ux-design");
    });

    it("create-ux-design should be in Phase 2 (planning)", () => {
      expect(content).toMatch(/create-ux-design:[\s\S]*?phase:\s*2-planning/);
    });

    it("the Phase 2 planning lifecycle flow should include val-validate between create-prd and create-ux-design", () => {
      // Filter keys to only Phase 2 entries by checking their phase field
      const phase2Keys = keys.filter((key) => {
        const block = getWorkflowBlock(content, key);
        return block.match(/phase:\s*2-planning/);
      });
      expect(phase2Keys).toContain("create-prd");
      expect(phase2Keys).toContain("val-validate");
      expect(phase2Keys).toContain("create-ux-design");

      // val-validate should appear between create-prd and create-ux-design in the Phase 2 flow
      const prdIdx = phase2Keys.indexOf("create-prd");
      const valIdx = phase2Keys.indexOf("val-validate");
      const uxIdx = phase2Keys.indexOf("create-ux-design");
      expect(valIdx).toBeGreaterThan(prdIdx);
      expect(uxIdx).toBeGreaterThan(valIdx);
    });
  });

  // AC4: No breaking changes to downstream workflows
  describe("AC4: No breaking references", () => {
    it("edit-prd should still exist in the sequence (still reachable from val-validate on_fail)", () => {
      expect(keys).toContain("edit-prd");
    });

    it("edit-prd next primary should still point to /gaia-val-validate", () => {
      const next = getNextValues(content, "edit-prd");
      expect(next.primary).toBe("/gaia-val-validate");
    });

    it("create-ux-design next should still have /gaia-create-arch as an option", () => {
      // Either primary or alternative should reference architecture
      const uxBlock = getWorkflowBlock(content, "create-ux-design");
      expect(uxBlock).not.toBe("");
      expect(uxBlock).toMatch(/\/gaia-create-arch/);
    });
  });
});
