import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const CONFIG_PATH = join(PROJECT_ROOT, "_gaia", "_config");

/**
 * Parse a CSV file into an array of objects.
 */
function parseCSV(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse lifecycle-sequence.yaml and extract top-level workflow keys.
 * Uses simple regex since js-yaml is a devDep and may not be available.
 */
function parseLifecycleSequenceKeys(filePath) {
  const content = readFileSync(filePath, "utf8");
  const keys = [];
  // Match top-level keys under `sequence:` — lines with exactly 2 spaces + key + ':'
  const lines = content.split("\n");
  let inSequence = false;
  for (const line of lines) {
    if (line.match(/^sequence:\s*$/)) {
      inSequence = true;
      continue;
    }
    if (inSequence) {
      const match = line.match(/^  ([a-z][a-z0-9-]*):\s*$/);
      if (match) {
        keys.push(match[1]);
      }
    }
  }
  return keys;
}

describe("Manifest and Config Gap Cleanup (E9-S14)", () => {
  // AC1: All 4 workflows present in workflow-manifest.csv
  describe("AC1: Missing workflows in workflow-manifest.csv", () => {
    const manifest = parseCSV(join(CONFIG_PATH, "workflow-manifest.csv"));
    const workflowNames = manifest.map((w) => w.name);

    it("should have check-dod in workflow-manifest.csv", () => {
      expect(workflowNames).toContain("check-dod");
    });

    it("should have check-review-gate in workflow-manifest.csv", () => {
      expect(workflowNames).toContain("check-review-gate");
    });

    it("should have run-all-reviews in workflow-manifest.csv", () => {
      expect(workflowNames).toContain("run-all-reviews");
    });

    it("should have memory-hygiene in workflow-manifest.csv", () => {
      expect(workflowNames).toContain("memory-hygiene");
    });

    it("check-dod should have correct command field", () => {
      const entry = manifest.find((w) => w.name === "check-dod");
      expect(entry.command).toBe("gaia-check-dod");
    });

    it("check-review-gate should have correct command field", () => {
      const entry = manifest.find((w) => w.name === "check-review-gate");
      expect(entry.command).toBe("gaia-check-review-gate");
    });

    it("run-all-reviews should have correct command field", () => {
      const entry = manifest.find((w) => w.name === "run-all-reviews");
      expect(entry.command).toBe("gaia-run-all-reviews");
    });

    it("memory-hygiene should have correct command field", () => {
      const entry = manifest.find((w) => w.name === "memory-hygiene");
      expect(entry.command).toBe("gaia-memory-hygiene");
    });
  });

  // AC2: Single val_integration block in global.yaml, no stale commented-out duplicates
  describe("AC2: val_integration consolidation in global.yaml", () => {
    const globalContent = readFileSync(join(CONFIG_PATH, "global.yaml"), "utf8");

    it("should have exactly one val_integration key (no commented-out duplicates)", () => {
      // Count lines that have commented-out val_integration
      const commentedOutLines = globalContent
        .split("\n")
        .filter((line) => line.match(/^\s*#\s*val_integration\s*:/));
      expect(
        commentedOutLines,
        `Found stale commented-out val_integration lines: ${commentedOutLines.join(", ")}`
      ).toHaveLength(0);
    });

    it("should have an active val_integration block", () => {
      const activeLines = globalContent
        .split("\n")
        .filter((line) => line.match(/^val_integration:\s*$/));
      expect(activeLines).toHaveLength(1);
    });

    it("should have template_output_review under val_integration", () => {
      expect(globalContent).toMatch(/val_integration:\s*\n\s+template_output_review:\s*true/);
    });
  });

  // AC3: lifecycle-sequence.yaml has entry for val-refresh-ground-truth
  describe("AC3: lifecycle-sequence.yaml entries", () => {
    const sequenceKeys = parseLifecycleSequenceKeys(join(CONFIG_PATH, "lifecycle-sequence.yaml"));

    it("should have val-refresh-ground-truth in lifecycle-sequence.yaml", () => {
      expect(sequenceKeys).toContain("val-refresh-ground-truth");
    });

    it("val-refresh-ground-truth entry should have a command field", () => {
      const content = readFileSync(join(CONFIG_PATH, "lifecycle-sequence.yaml"), "utf8");
      expect(content).toMatch(
        /val-refresh-ground-truth:[\s\S]*?command:\s*\/gaia-refresh-ground-truth/
      );
    });

    it("val-refresh-ground-truth entry should have a next field", () => {
      const content = readFileSync(join(CONFIG_PATH, "lifecycle-sequence.yaml"), "utf8");
      expect(content).toMatch(/val-refresh-ground-truth:[\s\S]*?next:/);
    });
  });

  // Cross-manifest consistency: every workflow-manifest entry should have a lifecycle-sequence entry
  describe("Cross-manifest consistency", () => {
    const manifest = parseCSV(join(CONFIG_PATH, "workflow-manifest.csv"));
    const sequenceKeys = parseLifecycleSequenceKeys(join(CONFIG_PATH, "lifecycle-sequence.yaml"));
    const sequenceSet = new Set(sequenceKeys);

    const missingFromSequence = manifest
      .map((w) => w.name)
      .filter((name) => !sequenceSet.has(name));

    it("every workflow in workflow-manifest.csv should have a lifecycle-sequence.yaml entry", () => {
      expect(
        missingFromSequence,
        `Workflows in manifest but missing from lifecycle-sequence.yaml: ${missingFromSequence.join(", ")}`
      ).toHaveLength(0);
    });
  });
});
