import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

function readFile(relativePath) {
  return readFileSync(join(PROJECT_ROOT, relativePath), "utf8");
}

function fileExists(relativePath) {
  return existsSync(join(PROJECT_ROOT, relativePath));
}

const STEP_FILE =
  "_gaia/core/workflows/party-mode/steps/step-01-agent-loading.md";

function getStepContent() {
  return readFile(STEP_FILE);
}

// ─── AC1: Stakeholder glob discovery alongside agent-manifest.csv ────

describe("AC1: Stakeholder glob discovery in Step 1", () => {
  it("step file exists", () => {
    expect(fileExists(STEP_FILE)).toBe(true);
  });

  it("references agent-manifest.csv for GAIA agent discovery (Source 1)", () => {
    const content = getStepContent();
    expect(content).toContain("agent-manifest.csv");
  });

  it("globs custom/stakeholders/*.md for stakeholder discovery (Source 2)", () => {
    const content = getStepContent();
    expect(content).toContain("custom/stakeholders/*.md");
  });

  it("parses YAML frontmatter only during discovery", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(/frontmatter/);
    expect(content).toMatch(/name/);
    expect(content).toMatch(/role/);
  });

  it("enforces 50-file cap on stakeholder discovery", () => {
    const content = getStepContent();
    expect(content).toMatch(/50/);
    expect(content.toLowerCase()).toMatch(/cap|limit|maximum|truncat/);
  });
});

// ─── AC2: [S] marker for stakeholders in invite list ─────────────────

describe("AC2: Stakeholder [S] marker in invite list", () => {
  it("marks stakeholders with [S] in the invite list", () => {
    const content = getStepContent();
    expect(content).toContain("[S]");
  });

  it("distinguishes stakeholders from GAIA agents", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(/stakeholder/);
    expect(content).toMatch(/gaia.*agent|agent.*manifest/i);
  });
});

// ─── AC3: Name disambiguation with [Stakeholder] prefix ─────────────

describe("AC3: Name collision disambiguation", () => {
  it("prefixes colliding stakeholders with [Stakeholder]", () => {
    const content = getStepContent();
    expect(content).toContain("[Stakeholder]");
  });

  it("GAIA agents retain original name on collision", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(
      /gaia.*precedence|agent.*original|agent.*unchanged|agents.*take.*precedence/
    );
  });
});

// ─── AC4: Stakeholder-only party is valid ────────────────────────────

describe("AC4: Stakeholder-only party (zero GAIA agents)", () => {
  it("allows party with zero GAIA agents and one+ stakeholders", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(
      /zero.*gaia.*agent|stakeholder.only|no.*gaia.*agent/
    );
    expect(content).toMatch(/valid/);
  });

  it("includes Option D for stakeholders-only selection", () => {
    const content = getStepContent();
    expect(content).toMatch(/Option D/);
  });
});

// ─── AC5: JIT loading — frontmatter at discovery, full file at participation ──

describe("AC5: JIT full-file loading", () => {
  it("loads only frontmatter during discovery", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(/frontmatter.*only|only.*frontmatter/);
  });

  it("loads full file content JIT when stakeholder participates", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(/jit|just.in.time|participation|full.*file.*load/);
  });
});

// ─── AC6: 5K token budget for discovery (NFR-029) ───────────────────

describe("AC6: Token budget enforcement (NFR-029)", () => {
  it("references 5K token budget for discovery", () => {
    const content = getStepContent();
    expect(content).toMatch(/5K|5,000|5000/);
    expect(content.toLowerCase()).toMatch(/token.*budget|budget.*token/);
  });
});

// ─── Invitation Options ─────────────────────────────────────────────

describe("Merged invitation options", () => {
  it("includes Option A: All agents", () => {
    const content = getStepContent();
    expect(content).toMatch(/Option A/);
  });

  it("includes Option B: By module", () => {
    const content = getStepContent();
    expect(content).toMatch(/Option B/);
  });

  it("includes Option C: Specific agents (combined list)", () => {
    const content = getStepContent();
    expect(content).toMatch(/Option C/);
  });

  it("includes Option D: Stakeholders only", () => {
    const content = getStepContent();
    expect(content).toMatch(/Option D/);
  });

  it("includes Option E: By tag", () => {
    const content = getStepContent();
    expect(content).toMatch(/Option E/);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("Edge case handling", () => {
  it("handles missing custom/stakeholders/ directory silently", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(
      /directory.*not exist|does not exist|no.*directory|silently/
    );
  });

  it("handles empty stakeholder files (0 bytes)", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(/empty.*file|0.*byte|zero.*byte|skip.*empty/);
  });

  it("handles malformed YAML frontmatter", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(/malformed|invalid.*yaml|bad.*frontmatter/);
  });

  it("warns when stakeholder file exceeds 100 lines", () => {
    const content = getStepContent();
    expect(content).toMatch(/100/);
    expect(content.toLowerCase()).toMatch(/line/);
  });

  it("halts on zero agents + zero stakeholders", () => {
    const content = getStepContent().toLowerCase();
    expect(content).toMatch(
      /zero.*agent.*zero.*stakeholder|no.*agent.*no.*stakeholder|invalid.*party/
    );
  });
});

// ─── Structural checks ─────────────────────────────────────────────

describe("Structural: step file integrity", () => {
  it("step file is non-empty and has reasonable length", () => {
    const content = getStepContent();
    const lines = content.split("\n");
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.length).toBeLessThan(200);
  });

  it("contains a title heading", () => {
    const content = getStepContent();
    expect(content).toMatch(/^# /m);
  });
});
