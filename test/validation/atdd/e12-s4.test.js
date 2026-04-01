import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const INSTRUCTIONS_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/lifecycle/workflows/anytime/brownfield-onboarding/instructions.xml"
);

const TEMPLATES_DIR = resolve(PROJECT_ROOT, "_gaia/lifecycle/templates");

// ─── Helper: read instructions content ──────────────────────

function readInstructions() {
  return readFileSync(INSTRUCTIONS_PATH, "utf-8");
}

// ─── Helper: extract Step 4 content ─────────────────────────

function extractStep4(content) {
  // Match step n="4" through the next step or end of file
  const match = content.match(/<step\s+n="4"[^>]*>([\s\S]*?)(?=<step\s+n="[^4]"|<\/workflow>)/);
  return match ? match[1] : "";
}

// ─── AC1: Application type selects prd-template.md ──────────

describe("AC1: Application type selects standard PRD template", () => {
  it("Step 4 should reference prd-template.md for application project_type", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    expect(step4).toContain("prd-template.md");
    // Should map application -> prd-template.md
    expect(step4).toMatch(/application[\s\S]*?prd-template\.md/);
  });
});

// ─── AC2: Infrastructure type selects infra-prd-template.md ─

describe("AC2: Infrastructure type selects infra PRD template", () => {
  it("Step 4 should reference infra-prd-template.md for infrastructure project_type", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    expect(step4).toContain("infra-prd-template.md");
    // Should map infrastructure -> infra-prd-template.md
    expect(step4).toMatch(/infrastructure[\s\S]*?infra-prd-template\.md/);
  });

  it("Step 4 should reference IR/OR/SR ID scheme for infrastructure", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    // Infrastructure projects should mention IR, OR, SR prefixes
    expect(step4).toMatch(/IR-/);
    expect(step4).toMatch(/OR-/);
    expect(step4).toMatch(/SR-/);
  });
});

// ─── AC3: Platform type selects platform-prd-template.md ────

describe("AC3: Platform type selects platform PRD template", () => {
  it("Step 4 should reference platform-prd-template.md for platform project_type", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    expect(step4).toContain("platform-prd-template.md");
    // Should map platform -> platform-prd-template.md
    expect(step4).toMatch(/platform[\s\S]*?platform-prd-template\.md/);
  });

  it("Step 4 should reference both FR/NFR and IR/OR/SR schemes for platform", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    // Platform projects use both ID scheme families
    expect(step4).toMatch(/FR-/);
    expect(step4).toMatch(/NFR-/);
    expect(step4).toMatch(/IR-/);
  });
});

// ─── AC4: Simple lookup — no template inheritance ───────────

describe("AC4: Template selection is a simple lookup", () => {
  it("Step 4 should contain a project_type-based template mapping", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    // All three mappings must be present in Step 4
    expect(step4).toContain("project_type");
    expect(step4).toContain("prd-template.md");
    expect(step4).toContain("infra-prd-template.md");
    expect(step4).toContain("platform-prd-template.md");
  });

  it("Step 4 should not implement template inheritance or composition", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    // Should not have extends, inherits-from, or compose directives
    expect(step4).not.toMatch(/extends\s*=\s*["']/i);
    expect(step4).not.toMatch(/inherits[-_]from/i);
    expect(step4).not.toMatch(/compose[-_]templates/i);
  });
});

// ─── AC5: Infrastructure uses IR/OR/SR IDs ──────────────────

describe("AC5: Infrastructure requirement ID scheme", () => {
  it("Step 4 should define IR-### for infrastructure requirements", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    expect(step4).toMatch(/IR-###|IR-\d{3}/);
  });

  it("Step 4 should define OR-### for operational requirements", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    expect(step4).toMatch(/OR-###|OR-\d{3}/);
  });

  it("Step 4 should define SR-### for security requirements", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    expect(step4).toMatch(/SR-###|SR-\d{3}/);
  });
});

// ─── AC6: Platform uses both ID schemes ─────────────────────

describe("AC6: Platform dual ID scheme", () => {
  it("Step 4 should specify that platform projects use FR/NFR and IR/OR/SR", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    // Platform section should mention both families
    expect(step4).toMatch(/platform[\s\S]*?FR-/);
    expect(step4).toMatch(/platform[\s\S]*?IR-/);
  });

  it("Step 4 should note IDs are globally unique within a project", () => {
    const content = readInstructions();
    const step4 = extractStep4(content);
    expect(step4).toMatch(/unique|disambiguat/i);
  });
});

// ─── Template files exist at expected paths ─────────────────

describe("Template file existence verification", () => {
  it("prd-template.md should exist", () => {
    expect(existsSync(resolve(TEMPLATES_DIR, "prd-template.md"))).toBe(true);
  });

  it("infra-prd-template.md should exist", () => {
    expect(existsSync(resolve(TEMPLATES_DIR, "infra-prd-template.md"))).toBe(true);
  });

  it("platform-prd-template.md should exist", () => {
    expect(existsSync(resolve(TEMPLATES_DIR, "platform-prd-template.md"))).toBe(true);
  });
});
