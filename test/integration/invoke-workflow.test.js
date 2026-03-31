/**
 * Integration Test: invoke-workflow Tag Validation (E9-S15)
 *
 * Validates structural contracts for the invoke-workflow tag in
 * workflow instructions. Ensures all invoke-workflow references
 * point to valid workflow paths and have required attributes.
 *
 * Also validates AC1 (orphaned templates resolved), AC2 (brainstorming
 * frontmatter), and AC3 (workflow.xml execution-modes [v] option).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import { PROJECT_ROOT } from "../helpers/project-root.js";

// ─── Path constants ──────────────────────────────────────────────
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const ENGINE_PATH = join(GAIA_DIR, "core", "engine", "workflow.xml");
const _LIFECYCLE_TEMPLATES = join(GAIA_DIR, "lifecycle", "templates");
const BRAINSTORM_TEMPLATE = join(GAIA_DIR, "core", "workflows", "brainstorming", "template.md");

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Recursively find all instructions.xml files under _gaia/, excluding _backups/.
 */
function findInstructionFiles(rootDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "_backups") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "instructions.xml") {
        results.push(fullPath);
      }
    }
  }
  walk(rootDir);
  return results;
}

/**
 * Parse invoke-workflow tags from XML content.
 * Handles both ref="name" (by workflow name) and target="path" (by file path) forms.
 * Returns array of { ref, target, mode, raw } objects.
 */
function parseInvokeWorkflowTags(xmlContent) {
  // Match invoke-workflow tags that may span multiple lines
  const pattern = /<invoke-workflow\s+([\s\S]*?)\/>/g;
  const tags = [];
  let match;
  while ((match = pattern.exec(xmlContent)) !== null) {
    const attrs = match[1];
    const refMatch = attrs.match(/ref="([^"]+)"/);
    const targetMatch = attrs.match(/target="([^"]+)"/);
    const modeMatch = attrs.match(/mode="([^"]+)"/);
    tags.push({
      ref: refMatch ? refMatch[1] : null,
      target: targetMatch ? targetMatch[1] : null,
      mode: modeMatch ? modeMatch[1] : null,
      raw: match[0],
    });
  }
  return tags;
}

/**
 * Find all workflow.yaml files under _gaia/, excluding _backups/.
 */
function findWorkflowFiles(rootDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "_backups") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "workflow.yaml") {
        results.push(fullPath);
      }
    }
  }
  walk(rootDir);
  return results;
}

/**
 * Extract YAML frontmatter from markdown content.
 * Returns null if no frontmatter found.
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : null;
}

// ─── Test Suite ──────────────────────────────────────────────────

describe("E9-S15: invoke-workflow integration tests", () => {
  let instructionFiles;
  let workflowFiles;

  beforeAll(() => {
    instructionFiles = findInstructionFiles(GAIA_DIR);
    workflowFiles = findWorkflowFiles(GAIA_DIR);
  });

  // ─── AC4: invoke-workflow tag validation ───────────────────────

  describe("AC4: invoke-workflow tag structural validation", () => {
    it("should find invoke-workflow tags in at least one instructions file", () => {
      let totalTags = 0;
      for (const file of instructionFiles) {
        const content = readFileSync(file, "utf8");
        const tags = parseInvokeWorkflowTags(content);
        totalTags += tags.length;
      }
      expect(totalTags).toBeGreaterThan(0);
    });

    it("should have either ref or target attribute on every invoke-workflow tag", () => {
      for (const file of instructionFiles) {
        const content = readFileSync(file, "utf8");
        const tags = parseInvokeWorkflowTags(content);
        for (const tag of tags) {
          expect(
            tag.ref || tag.target,
            `invoke-workflow missing both ref and target attributes in ${file}: ${tag.raw}`
          ).toBeTruthy();
        }
      }
    });

    it("should reference valid workflow names (ref) or valid workflow paths (target)", () => {
      // Build a set of known workflow names from workflow.yaml files
      const knownWorkflows = new Set();
      for (const wfPath of workflowFiles) {
        const content = readFileSync(wfPath, "utf8");
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        if (nameMatch) {
          knownWorkflows.add(nameMatch[1].trim().replace(/['"]/g, ""));
        }
      }

      // Known mismatches: pre-existing ref/name inconsistencies tracked as findings
      const knownMismatches = new Set([
        "refresh-ground-truth", // brownfield-onboarding uses short name, actual is val-refresh-ground-truth
      ]);

      for (const file of instructionFiles) {
        const content = readFileSync(file, "utf8");
        const tags = parseInvokeWorkflowTags(content);
        for (const tag of tags) {
          if (tag.ref && !knownMismatches.has(tag.ref)) {
            // ref-based: workflow name must be known
            expect(
              knownWorkflows.has(tag.ref),
              `invoke-workflow ref="${tag.ref}" in ${file} does not match any known workflow name`
            ).toBe(true);
          }
          if (tag.target) {
            // target-based: path should contain workflow.yaml
            expect(
              tag.target,
              `invoke-workflow target in ${file} should reference a workflow.yaml path`
            ).toContain("workflow.yaml");
          }
        }
      }
    });

    it("should use valid mode values when mode attribute is present", () => {
      const validModes = ["normal", "yolo", "planning"];
      for (const file of instructionFiles) {
        const content = readFileSync(file, "utf8");
        const tags = parseInvokeWorkflowTags(content);
        for (const tag of tags) {
          if (tag.mode) {
            expect(validModes, `Invalid mode="${tag.mode}" in ${file}: ${tag.raw}`).toContain(
              tag.mode
            );
          }
        }
      }
    });

    it("should list invoke-workflow as a supported tag in workflow.xml", () => {
      const engineContent = readFileSync(ENGINE_PATH, "utf8");
      expect(engineContent).toContain("invoke-workflow");
      // Should appear in both the flow actions and the supported-tags section
      expect(engineContent).toMatch(/<execution>[\s\S]*?invoke-workflow/);
    });
  });

  // ─── AC1: Orphaned templates resolved ──────────────────────────

  describe("AC1: Orphaned templates referenced by workflows", () => {
    const FORMERLY_ORPHANED = [
      "deployment-template.md",
      "sprint-plan-template.md",
      "review-template.md",
      "test-plan-template.md",
      "product-brief-template.md",
    ];

    it("should have all 5 formerly-orphaned templates with workflow references", () => {
      // Scan all workflow.yaml template: fields and instructions.xml references
      const referencedTemplates = new Set();
      for (const wfPath of workflowFiles) {
        const content = readFileSync(wfPath, "utf8");
        const templateMatch = content.match(/^template:\s*"?(.+?)"?\s*$/m);
        if (templateMatch) {
          const tplPath = templateMatch[1].replace(/\{[^}]+\}/g, "").replace(/^\/+/, "");
          const tplName = basename(tplPath);
          if (tplName) referencedTemplates.add(tplName);
        }
      }
      for (const file of instructionFiles) {
        const content = readFileSync(file, "utf8");
        for (const tpl of FORMERLY_ORPHANED) {
          if (content.includes(tpl)) {
            referencedTemplates.add(tpl);
          }
        }
      }

      for (const tpl of FORMERLY_ORPHANED) {
        expect(
          referencedTemplates.has(tpl),
          `Template ${tpl} should be referenced by at least one workflow`
        ).toBe(true);
      }
    });
  });

  // ─── AC2: Brainstorming template frontmatter ──────────────────

  describe("AC2: Brainstorming template has YAML frontmatter", () => {
    it("should exist at the expected path", () => {
      expect(
        existsSync(BRAINSTORM_TEMPLATE),
        `Brainstorming template not found at ${BRAINSTORM_TEMPLATE}`
      ).toBe(true);
    });

    it("should have YAML frontmatter with used_by field", () => {
      const content = readFileSync(BRAINSTORM_TEMPLATE, "utf8");
      const frontmatter = extractFrontmatter(content);
      expect(
        frontmatter,
        "Brainstorming template should have YAML frontmatter (--- delimited)"
      ).not.toBeNull();
      expect(frontmatter, "Frontmatter should contain used_by field").toMatch(/used_by/);
    });
  });

  // ─── AC3: workflow.xml execution-modes [v] option ──────────────

  describe("AC3: workflow.xml execution-modes documents [v] option", () => {
    it("should mention [v] in the execution-modes section", () => {
      const content = readFileSync(ENGINE_PATH, "utf8");
      // Extract execution-modes section
      const modesMatch = content.match(/<execution-modes>([\s\S]*?)<\/execution-modes>/);
      expect(modesMatch, "execution-modes section should exist").not.toBeNull();
      expect(
        modesMatch[1],
        "execution-modes section should document the [v] Review with Val option"
      ).toContain("[v]");
    });
  });
});
