import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";
import {
  discoverStakeholderFiles,
  parseFrontmatter,
  findMissingFields,
  countLines,
  validateStakeholderFiles,
} from "../../validators/stakeholder-validator.js";

// ─── Test Fixtures ──────────────────────────────────────────

const FIXTURE_DIR = join(PROJECT_ROOT, "test", "fixtures", "stakeholders-e15s7");

function writeFixture(name, content) {
  writeFileSync(join(FIXTURE_DIR, name), content, "utf8");
}

function validStakeholder(overrides = {}) {
  const fields = {
    name: "Test Stakeholder",
    role: "CFO",
    expertise: "Finance",
    personality: "Analytical and detail-oriented",
    ...overrides,
  };
  const yamlLines = Object.entries(fields)
    .map(([k, v]) => `${k}: "${v}"`)
    .join("\n");
  return `---\n${yamlLines}\n---\n\nThis is the stakeholder body content.\n`;
}

// ─── Setup / Teardown ───────────────────────────────────────

beforeAll(() => {
  if (existsSync(FIXTURE_DIR)) {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
  mkdirSync(FIXTURE_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

// ─── STK-01: Stakeholder directory convention ───────────────

describe("STK-01: Stakeholder directory exists at custom/stakeholders/", () => {
  it("custom/stakeholders/ directory exists in the project", () => {
    const dir = join(PROJECT_ROOT, "custom", "stakeholders");
    expect(existsSync(dir), "custom/stakeholders/ directory should exist").toBe(true);
  });
});

// ─── STK-02: Stakeholder file format — YAML frontmatter ────

describe("STK-02: Stakeholder files use YAML frontmatter format", () => {
  it("parses valid YAML frontmatter successfully", () => {
    writeFixture("stk02-valid.md", validStakeholder());
    const result = parseFrontmatter(join(FIXTURE_DIR, "stk02-valid.md"));
    expect(result.success).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns parsed fields from frontmatter", () => {
    writeFixture("stk02-fields.md", validStakeholder());
    const result = parseFrontmatter(join(FIXTURE_DIR, "stk02-fields.md"));
    expect(result.data.name).toBe("Test Stakeholder");
    expect(result.data.role).toBe("CFO");
    expect(result.data.expertise).toBe("Finance");
    expect(result.data.personality).toBe("Analytical and detail-oriented");
  });
});

// ─── STK-03: Required fields validation ─────────────────────

describe("STK-03: Required fields — name, role, expertise, personality", () => {
  it("returns empty array when all required fields present", () => {
    const data = { name: "A", role: "B", expertise: "C", personality: "D" };
    expect(findMissingFields(data)).toHaveLength(0);
  });

  it("detects missing name field", () => {
    const data = { role: "B", expertise: "C", personality: "D" };
    expect(findMissingFields(data)).toContain("name");
  });

  it("detects missing role field", () => {
    const data = { name: "A", expertise: "C", personality: "D" };
    expect(findMissingFields(data)).toContain("role");
  });

  it("detects missing expertise field", () => {
    const data = { name: "A", role: "B", personality: "D" };
    expect(findMissingFields(data)).toContain("expertise");
  });

  it("detects missing personality field", () => {
    const data = { name: "A", role: "B", expertise: "C" };
    expect(findMissingFields(data)).toContain("personality");
  });

  it("detects multiple missing fields", () => {
    const data = { role: "B" };
    const missing = findMissingFields(data);
    expect(missing).toContain("name");
    expect(missing).toContain("expertise");
    expect(missing).toContain("personality");
    expect(missing).toHaveLength(3);
  });
});

// ─── STK-04: File discovery ─────────────────────────────────

describe("STK-04: Stakeholder file discovery via glob", () => {
  it("discovers .md files in the directory", () => {
    writeFixture("stk04-a.md", validStakeholder());
    writeFixture("stk04-b.md", validStakeholder({ name: "B" }));
    const files = discoverStakeholderFiles(FIXTURE_DIR);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it("excludes README.md from discovery", () => {
    writeFixture("README.md", "# Readme\nNot a stakeholder.");
    const files = discoverStakeholderFiles(FIXTURE_DIR);
    const readmeIncluded = files.some((f) => f.endsWith("/README.md"));
    expect(readmeIncluded, "README.md should be excluded from discovery").toBe(false);
  });

  it("returns empty array for non-existent directory", () => {
    const files = discoverStakeholderFiles(join(FIXTURE_DIR, "nonexistent"));
    expect(files).toHaveLength(0);
  });
});

// ─── STK-05: Line count constraint ─────────────────────────

describe("STK-05: Line count validation (FR-164: max 100 lines)", () => {
  it("counts lines correctly for a small file", () => {
    writeFixture("stk05-small.md", "line1\nline2\nline3\n");
    const count = countLines(join(FIXTURE_DIR, "stk05-small.md"));
    expect(count).toBe(4); // 3 lines + trailing newline = 4
  });

  it("counts lines for a file at exactly 100 lines (boundary — valid)", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
    writeFixture("stk05-boundary.md", lines);
    const count = countLines(join(FIXTURE_DIR, "stk05-boundary.md"));
    expect(count).toBe(100);
  });
});

// ─── STK-36: Full validator pipeline — valid files ──────────

describe("STK-36: Validator pipeline produces zero findings for valid files", () => {
  let cleanDir;

  beforeAll(() => {
    cleanDir = join(FIXTURE_DIR, "stk36-clean");
    mkdirSync(cleanDir, { recursive: true });
    writeFileSync(join(cleanDir, "cfo.md"), validStakeholder({ name: "CFO" }), "utf8");
    writeFileSync(
      join(cleanDir, "cto.md"),
      validStakeholder({ name: "CTO", role: "CTO", expertise: "Technology" }),
      "utf8"
    );
  });

  afterAll(() => {
    rmSync(cleanDir, { recursive: true, force: true });
  });

  it("returns zero findings for directory with valid stakeholder files", () => {
    const result = validateStakeholderFiles(cleanDir);
    expect(result.findings).toHaveLength(0);
    expect(result.filesProcessed).toBe(2);
    expect(result.filesSkipped).toBe(0);
  });
});

// ─── STK-37: Validator pipeline — error detection ───────────

describe("STK-37: Validator pipeline detects schema violations", () => {
  let errorDir;

  beforeAll(() => {
    errorDir = join(FIXTURE_DIR, "stk37-errors");
    mkdirSync(errorDir, { recursive: true });

    // Missing personality field
    writeFileSync(
      join(errorDir, "missing-field.md"),
      '---\nname: "A"\nrole: "B"\nexpertise: "C"\n---\n\nBody\n',
      "utf8"
    );

    // File exceeding 100 lines
    const longLines = Array.from({ length: 105 }, (_, i) => `line ${i + 1}`).join("\n");
    writeFileSync(
      join(errorDir, "too-long.md"),
      `---\nname: "Long"\nrole: "R"\nexpertise: "E"\npersonality: "P"\n---\n\n${longLines}\n`,
      "utf8"
    );

    // Malformed YAML
    writeFileSync(
      join(errorDir, "malformed.md"),
      '---\nname: "unclosed\nrole: [broken\n---\n\nBody\n',
      "utf8"
    );
  });

  afterAll(() => {
    rmSync(errorDir, { recursive: true, force: true });
  });

  it("detects missing required fields with CRITICAL severity", () => {
    const result = validateStakeholderFiles(errorDir);
    const criticals = result.findings.filter((f) => f.severity === "CRITICAL");
    expect(criticals.length).toBeGreaterThanOrEqual(1);
    const missingFieldFinding = criticals.find((f) => f.finding.includes("personality"));
    expect(missingFieldFinding).toBeDefined();
    expect(missingFieldFinding.section).toBe("stakeholder-schema");
  });

  it("detects files exceeding 100 lines with WARNING severity", () => {
    const result = validateStakeholderFiles(errorDir);
    const sizeWarnings = result.findings.filter((f) => f.section === "stakeholder-size");
    expect(sizeWarnings.length).toBeGreaterThanOrEqual(1);
    expect(sizeWarnings[0].severity).toBe("WARNING");
    expect(sizeWarnings[0].finding).toMatch(/105|lines/);
  });

  it("skips malformed YAML with WARNING, does not crash", () => {
    const result = validateStakeholderFiles(errorDir);
    const fmWarnings = result.findings.filter((f) => f.section === "stakeholder-frontmatter");
    expect(fmWarnings.length).toBeGreaterThanOrEqual(1);
    expect(fmWarnings[0].severity).toBe("WARNING");
    expect(result.filesSkipped).toBeGreaterThanOrEqual(1);
  });

  it("continues validating after malformed file (no crash)", () => {
    const result = validateStakeholderFiles(errorDir);
    // Should have processed the valid files despite malformed one
    expect(result.filesProcessed + result.filesSkipped).toBe(3);
  });
});

// ─── STK-38: Directory cap validation ───────────────────────

describe("STK-38: Directory file count cap (FR-164: max 50 files)", () => {
  let capDir;

  beforeAll(() => {
    capDir = join(FIXTURE_DIR, "stk38-cap");
    mkdirSync(capDir, { recursive: true });
    // Create 51 files to exceed the 50-file cap
    for (let i = 1; i <= 51; i++) {
      writeFileSync(
        join(capDir, `stakeholder-${String(i).padStart(3, "0")}.md`),
        validStakeholder({ name: `Stakeholder ${i}` }),
        "utf8"
      );
    }
  });

  afterAll(() => {
    rmSync(capDir, { recursive: true, force: true });
  });

  it("flags directories exceeding 50 files with WARNING", () => {
    const result = validateStakeholderFiles(capDir);
    const capWarnings = result.findings.filter((f) => f.section === "stakeholder-directory");
    expect(capWarnings).toHaveLength(1);
    expect(capWarnings[0].severity).toBe("WARNING");
    expect(capWarnings[0].finding).toMatch(/51/);
  });

  it("exactly 50 files produces no directory cap finding", () => {
    const exactDir = join(FIXTURE_DIR, "stk38-exact");
    mkdirSync(exactDir, { recursive: true });
    for (let i = 1; i <= 50; i++) {
      writeFileSync(
        join(exactDir, `stakeholder-${String(i).padStart(3, "0")}.md`),
        validStakeholder({ name: `Stakeholder ${i}` }),
        "utf8"
      );
    }
    const result = validateStakeholderFiles(exactDir);
    const capWarnings = result.findings.filter((f) => f.section === "stakeholder-directory");
    expect(capWarnings).toHaveLength(0);
    rmSync(exactDir, { recursive: true, force: true });
  });
});

// ─── Edge Cases ─────────────────────────────────────────────

describe("Edge cases: stakeholder validation", () => {
  it("handles empty file (0 bytes) with WARNING", () => {
    writeFixture("empty.md", "");
    const result = parseFrontmatter(join(FIXTURE_DIR, "empty.md"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/[Ee]mpty/);
  });

  it("handles file with no frontmatter delimiters with WARNING", () => {
    writeFixture("no-delimiters.md", "Just plain markdown\nNo frontmatter here.\n");
    const result = parseFrontmatter(join(FIXTURE_DIR, "no-delimiters.md"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/delimiter/i);
  });

  it("handles frontmatter-only file (no body)", () => {
    writeFixture(
      "fm-only.md",
      '---\nname: "A"\nrole: "B"\nexpertise: "C"\npersonality: "D"\n---\n'
    );
    const result = parseFrontmatter(join(FIXTURE_DIR, "fm-only.md"));
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("A");
  });

  it("handles unicode field values", () => {
    writeFixture(
      "unicode.md",
      '---\nname: "日本語テスト"\nrole: "Rôle spécial"\nexpertise: "Éxpèrtise"\npersonality: "Persönlichkeit"\n---\n\nBody.\n'
    );
    const result = parseFrontmatter(join(FIXTURE_DIR, "unicode.md"));
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("日本語テスト");
  });

  it("allows optional fields without findings (perspective, tags)", () => {
    const content = validStakeholder({
      perspective: "Business growth",
      tags: "finance, strategy",
    });
    writeFixture("optional.md", content);
    const result = parseFrontmatter(join(FIXTURE_DIR, "optional.md"));
    expect(result.success).toBe(true);
    const missing = findMissingFields(result.data);
    expect(missing).toHaveLength(0);
  });

  it("allows unknown extra fields without findings (permissive schema)", () => {
    const content = validStakeholder({ foo: "bar", baz: "qux" });
    writeFixture("extra.md", content);
    const result = parseFrontmatter(join(FIXTURE_DIR, "extra.md"));
    expect(result.success).toBe(true);
    const missing = findMissingFields(result.data);
    expect(missing).toHaveLength(0);
  });

  it("file at exactly 100 lines produces no line count finding", () => {
    const header = '---\nname: "A"\nrole: "B"\nexpertise: "C"\npersonality: "D"\n---';
    const headerLines = header.split("\n").length; // 6
    const bodyLines = 100 - headerLines;
    const body = Array.from({ length: bodyLines }, (_, i) => `line ${i + 1}`).join("\n");
    writeFixture("exact-100.md", `${header}\n${body}`);
    const count = countLines(join(FIXTURE_DIR, "exact-100.md"));
    expect(count).toBe(100);
  });

  it("file at 101 lines exceeds limit", () => {
    const lines = Array.from({ length: 101 }, (_, i) => `line ${i + 1}`).join("\n");
    writeFixture("exact-101.md", lines);
    const count = countLines(join(FIXTURE_DIR, "exact-101.md"));
    expect(count).toBe(101);
    expect(count).toBeGreaterThan(100);
  });
});

// ─── Finding Format ─────────────────────────────────────────

describe("Findings use Val-compatible structured format", () => {
  it("each finding has severity, section, claim, finding, evidence", () => {
    const errorDir = join(FIXTURE_DIR, "stk-format");
    mkdirSync(errorDir, { recursive: true });
    writeFileSync(join(errorDir, "bad.md"), "---\nname: A\n---\n\nBody\n", "utf8");
    const result = validateStakeholderFiles(errorDir);
    expect(result.findings.length).toBeGreaterThan(0);
    for (const f of result.findings) {
      expect(f).toHaveProperty("severity");
      expect(f).toHaveProperty("section");
      expect(f).toHaveProperty("claim");
      expect(f).toHaveProperty("finding");
      expect(f).toHaveProperty("evidence");
      expect(["CRITICAL", "WARNING"]).toContain(f.severity);
    }
    rmSync(errorDir, { recursive: true, force: true });
  });
});
