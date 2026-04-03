import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

// ─── Helpers ─────────────────────────────────────────────────

function readFile(relativePath) {
  return readFileSync(join(PROJECT_ROOT, relativePath), "utf8");
}

function fileExists(relativePath) {
  return existsSync(join(PROJECT_ROOT, relativePath));
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

// ─── AC1: Workflow registration and structure ────────────────

describe("AC1: Workflow scaffolding and registration", () => {
  const workflowDir =
    "_gaia/lifecycle/workflows/4-implementation/create-stakeholder";

  it("workflow.yaml exists", () => {
    expect(fileExists(`${workflowDir}/workflow.yaml`)).toBe(true);
  });

  it("instructions.xml exists", () => {
    expect(fileExists(`${workflowDir}/instructions.xml`)).toBe(true);
  });

  it("checklist.md exists", () => {
    expect(fileExists(`${workflowDir}/checklist.md`)).toBe(true);
  });

  it("workflow.yaml declares agent as orchestrator", () => {
    const content = readFile(`${workflowDir}/workflow.yaml`);
    expect(content).toMatch(/agent:\s*orchestrator/);
  });

  it("workflow.yaml declares instructions reference", () => {
    const content = readFile(`${workflowDir}/workflow.yaml`);
    expect(content).toMatch(/instructions:/);
  });

  it("is registered in workflow-manifest.csv", () => {
    const rows = parseCSV("_gaia/_config/workflow-manifest.csv");
    const entry = rows.find((r) => r.name === "create-stakeholder");
    expect(entry).toBeDefined();
    expect(entry.command).toBe("gaia-create-stakeholder");
    expect(entry.agent).toBe("orchestrator");
  });

  it("slash command file exists", () => {
    expect(fileExists(".claude/commands/gaia-create-stakeholder.md")).toBe(
      true
    );
  });

  it("slash command references correct workflow.yaml", () => {
    const content = readFile(".claude/commands/gaia-create-stakeholder.md");
    expect(content).toContain("create-stakeholder/workflow.yaml");
  });
});

// ─── AC2: Input collection ───────────────────────────────────

describe("AC2: Required and optional field prompts", () => {
  const instructionsPath =
    "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml";

  it("instructions ask for name (required)", () => {
    const content = readFile(instructionsPath);
    expect(content.toLowerCase()).toContain("name");
  });

  it("instructions ask for role (required)", () => {
    const content = readFile(instructionsPath);
    expect(content.toLowerCase()).toContain("role");
  });

  it("instructions ask for expertise (required)", () => {
    const content = readFile(instructionsPath);
    expect(content.toLowerCase()).toContain("expertise");
  });

  it("instructions ask for personality (required)", () => {
    const content = readFile(instructionsPath);
    expect(content.toLowerCase()).toContain("personality");
  });

  it("instructions mention perspective (optional)", () => {
    const content = readFile(instructionsPath);
    expect(content.toLowerCase()).toContain("perspective");
  });

  it("instructions mention tags (optional)", () => {
    const content = readFile(instructionsPath);
    expect(content.toLowerCase()).toContain("tags");
  });
});

// ─── AC3: 50-file cap enforcement ───────────────────────────

describe("AC3: 50-file cap", () => {
  it("instructions contain 50-file cap check", () => {
    const content = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    expect(content).toMatch(/50/);
    // Should reference cap/limit logic
    expect(content.toLowerCase()).toMatch(/cap|limit|maximum|count/);
  });
});

// ─── AC4: 100-line limit ─────────────────────────────────────

describe("AC4: 100-line file limit", () => {
  it("workflow.yaml or instructions enforce 100-line limit", () => {
    const workflow = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/workflow.yaml"
    );
    const instructions = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    const combined = workflow + instructions;
    expect(combined).toMatch(/100/);
    expect(combined.toLowerCase()).toMatch(/line/);
  });
});

// ─── AC5: Kebab-case slug generation ─────────────────────────

describe("AC5: Filename slug generation", () => {
  it("instructions describe kebab-case slug conversion", () => {
    const content = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    const lower = content.toLowerCase();
    // Should mention slug or kebab-case conversion
    expect(lower).toMatch(/slug|kebab/);
    // Should mention lowercase
    expect(lower).toMatch(/lowercase|lower.case/);
  });
});

// ─── AC6: Output file structure ──────────────────────────────

describe("AC6: File written to custom/stakeholders/ with correct frontmatter", () => {
  it("instructions reference custom/stakeholders/ output path", () => {
    const content = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    expect(content).toContain("custom/stakeholders/");
  });

  it("instructions reference YAML frontmatter generation", () => {
    const content = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    const lower = content.toLowerCase();
    expect(lower).toMatch(/frontmatter|yaml/);
  });
});

// ─── AC7: Duplicate name detection ──────────────────────────

describe("AC7: Duplicate stakeholder name detection", () => {
  it("instructions include case-insensitive duplicate name check", () => {
    const content = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    const lower = content.toLowerCase();
    expect(lower).toMatch(/duplicate|collision|already exists/);
    expect(lower).toMatch(/case.insensitive|case-insensitive/);
  });
});

// ─── AC8: Directory auto-creation ────────────────────────────

describe("AC8: Directory auto-creation", () => {
  it("instructions handle missing custom/stakeholders/ directory", () => {
    const content = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    const lower = content.toLowerCase();
    expect(lower).toMatch(/create.*director|mkdir|directory.*exist/);
  });
});

// ─── Structural: Sequential step numbering ───────────────────

describe("Structural: instructions.xml step numbering", () => {
  it("has sequential step numbers with no gaps", () => {
    const content = readFile(
      "_gaia/lifecycle/workflows/4-implementation/create-stakeholder/instructions.xml"
    );
    const stepMatches = [...content.matchAll(/step\s+n="(\d+)"/g)];
    expect(stepMatches.length).toBeGreaterThan(0);
    const stepNumbers = stepMatches.map((m) => parseInt(m[1], 10));
    for (let i = 0; i < stepNumbers.length; i++) {
      expect(stepNumbers[i]).toBe(i + 1);
    }
  });
});
