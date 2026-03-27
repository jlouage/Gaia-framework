import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

// ─── Helpers ─────────────────────────────────────────────────

function readFile(relativePath) {
  return readFileSync(join(PROJECT_ROOT, relativePath), "utf8");
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

function parseCSV(relativePath) {
  const content = readFile(relativePath);
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

// ─── AC1: PM agent menu no longer lists validate-prd ─────────

describe("AC1: PM agent menu", () => {
  it("should not contain validate-prd menu item", () => {
    const pmContent = readFile("_gaia/lifecycle/agents/pm.md");
    // Should not have a menu item referencing validate-prd workflow
    const menuItemMatch = pmContent.match(/<item[^>]*workflow="[^"]*validate-prd[^"]*"[^>]*\/>/);
    expect(menuItemMatch).toBeNull();
  });
});

// ─── AC2: Slash command redirects to /gaia-val-validate ──────

describe("AC2: Slash command redirect", () => {
  const cmdPath = join(PROJECT_ROOT, ".claude", "commands", "gaia-validate-prd.md");

  it("slash command file should exist", () => {
    expect(existsSync(cmdPath)).toBe(true);
  });

  it("should contain redirect to /gaia-val-validate", () => {
    const content = readFileSync(cmdPath, "utf8");
    expect(content).toContain("/gaia-val-validate");
  });

  it("should contain deprecation guidance message", () => {
    const content = readFileSync(cmdPath, "utf8");
    expect(content.toLowerCase()).toContain("deprecated");
  });

  it("should NOT invoke the old validate-prd workflow", () => {
    const content = readFileSync(cmdPath, "utf8");
    expect(content).not.toContain("validate-prd/workflow.yaml");
  });
});

// ─── AC3: workflow-manifest.csv shows deprecated ─────────────

describe("AC3: workflow-manifest.csv", () => {
  it("validate-prd entry should be marked as deprecated", () => {
    const rows = parseCSV("_gaia/_config/workflow-manifest.csv");
    const entry = rows.find((r) => r.name === "validate-prd" || r.workflow === "validate-prd");
    expect(entry).toBeDefined();
    // Check that the row contains "deprecated" somewhere
    const rowValues = Object.values(entry).join(" ").toLowerCase();
    expect(rowValues).toContain("deprecated");
  });
});

// ─── AC4: lifecycle-sequence.yaml has validate-prd removed from active flow ──

describe("AC4: lifecycle-sequence.yaml", () => {
  it("validate-prd entry should be marked as deprecated", () => {
    const content = readFile("_gaia/_config/lifecycle-sequence.yaml");
    // The entry should exist but be marked deprecated
    const block = content.match(/validate-prd:[\s\S]*?(?=\n\s{2}\w|\n$)/);
    expect(block).not.toBeNull();
    expect(block[0]).toContain("deprecated: true");
  });

  it("no other entry should reference /gaia-validate-prd as a next step", () => {
    const content = readFile("_gaia/_config/lifecycle-sequence.yaml");
    // Remove the validate-prd block itself, then check no remaining content references it
    const withoutBlock = content.replace(/\s{2}validate-prd:[\s\S]*?(?=\n\s{2}\w|\n$)/, "");
    expect(withoutBlock).not.toContain("/gaia-validate-prd");
  });

  it("create-prd next should not reference /gaia-validate-prd", () => {
    const content = readFile("_gaia/_config/lifecycle-sequence.yaml");
    const createPrdBlock = content.match(/create-prd:[\s\S]*?(?=\n\s{2}\w|\n$)/);
    if (createPrdBlock) {
      expect(createPrdBlock[0]).not.toContain("/gaia-validate-prd");
    }
  });

  it("edit-prd next should not reference /gaia-validate-prd", () => {
    const content = readFile("_gaia/_config/lifecycle-sequence.yaml");
    const editPrdBlock = content.match(/edit-prd:[\s\S]*?(?=\n\s{2}\w|\n$)/);
    if (editPrdBlock) {
      expect(editPrdBlock[0]).not.toContain("/gaia-validate-prd");
    }
  });
});

// ─── AC5: Workflow files preserved ───────────────────────────

describe("AC5: Workflow files preserved", () => {
  const workflowDir = join(
    PROJECT_ROOT,
    "_gaia",
    "lifecycle",
    "workflows",
    "2-planning",
    "validate-prd"
  );

  it("validate-prd directory should still exist", () => {
    expect(existsSync(workflowDir)).toBe(true);
  });

  it("workflow.yaml should still exist", () => {
    expect(existsSync(join(workflowDir, "workflow.yaml"))).toBe(true);
  });

  it("instructions.xml should still exist", () => {
    expect(existsSync(join(workflowDir, "instructions.xml"))).toBe(true);
  });

  it("checklist.md should still exist", () => {
    expect(existsSync(join(workflowDir, "checklist.md"))).toBe(true);
  });
});
