import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const TEMPLATE_PATH = resolve(PROJECT_ROOT, "_gaia/lifecycle/templates/infra-prd-template.md");

// ─── Helper: parse YAML frontmatter ─────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kv) {
      let val = kv[2].trim().replace(/^['"]|['"]$/g, "");
      fm[kv[1]] = val;
    }
  }
  return fm;
}

// ─── Helper: extract markdown headings ──────────────────────

function extractHeadings(content) {
  const lines = content.split("\n");
  return lines.filter((l) => /^#{1,3}\s/.test(l)).map((l) => l.replace(/^#+\s+/, "").trim());
}

// ─── AC1: All 13 sections present ───────────────────────────

describe("AC1: Infrastructure PRD template contains all 13 sections", () => {
  const REQUIRED_SECTIONS = [
    "Overview & Scope",
    "Goals and Non-Goals",
    "Platform Capabilities",
    "Resource Specifications",
    "Operational SLOs",
    "Security Posture",
    "Environment Strategy & Developer Experience",
    "Dependencies & Provider Constraints",
    "Cost Model",
    "Verification Strategy",
    "Operational Runbooks",
    "Requirements Summary",
    "Open Questions",
  ];

  it("should have the template file at the expected path", () => {
    expect(existsSync(TEMPLATE_PATH), `Template file not found at ${TEMPLATE_PATH}`).toBe(true);
  });

  it("should contain all 13 required section headings", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const headings = extractHeadings(content);

    for (const section of REQUIRED_SECTIONS) {
      const found = headings.some((h) => h.includes(section));
      expect(found, `Missing section: "${section}"`).toBe(true);
    }
  });

  it("should have sections in the correct order", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const headings = extractHeadings(content);

    let lastIndex = -1;
    for (const section of REQUIRED_SECTIONS) {
      const idx = headings.findIndex((h) => h.includes(section));
      expect(idx, `Section "${section}" not found`).toBeGreaterThan(-1);
      expect(
        idx,
        `Section "${section}" is out of order (found at ${idx}, expected after ${lastIndex})`
      ).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });
});

// ─── AC2: YAML frontmatter with template and domain fields ──

describe("AC2: Frontmatter includes template: infra-prd and domain field", () => {
  it("should have YAML frontmatter", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content.startsWith("---"), "File must start with YAML frontmatter delimiter").toBe(true);
    expect(content.includes("\n---"), "Frontmatter must have closing delimiter").toBe(true);
  });

  it("should have template field set to infra-prd", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const fm = parseFrontmatter(content);
    expect(fm.template, "template field must be 'infra-prd'").toBe("infra-prd");
  });

  it("should have a domain field for composability (NFR-025)", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const fm = parseFrontmatter(content);
    expect(
      "domain" in fm,
      "Frontmatter must include a 'domain' field for multi-PRD infrastructure composability"
    ).toBe(true);
  });
});

// ─── AC3: IR/OR/SR requirement ID scheme ────────────────────

describe("AC3: Requirements Summary uses IR-###, OR-###, SR-### ID schemes", () => {
  it("should contain IR-### table entries", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content).toMatch(/IR-\d{3}/);
  });

  it("should contain OR-### table entries", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content).toMatch(/OR-\d{3}/);
  });

  it("should contain SR-### table entries", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    expect(content).toMatch(/SR-\d{3}/);
  });

  it("should have three separate requirement tables", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    // Each table type should have a header row with ID column
    const irTable = content.includes("IR-") && content.match(/\|\s*IR-/);
    const orTable = content.includes("OR-") && content.match(/\|\s*OR-/);
    const srTable = content.includes("SR-") && content.match(/\|\s*SR-/);
    expect(irTable, "IR requirement table must exist").toBeTruthy();
    expect(orTable, "OR requirement table must exist").toBeTruthy();
    expect(srTable, "SR requirement table must exist").toBeTruthy();
  });
});

// ─── AC4: Security Posture section is non-empty with subsections ─

describe("AC4: Security Posture section with required subsections", () => {
  const SECURITY_SUBSECTIONS = [
    "IAM/RBAC",
    "network segmentation",
    "secrets management",
    "image provenance",
    "compliance mapping",
  ];

  it("should have a non-empty Security Posture section", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const secIdx = content.indexOf("Security Posture");
    expect(secIdx, "Security Posture section must exist").toBeGreaterThan(-1);

    // Extract content between Security Posture and next ## heading
    const afterSec = content.slice(secIdx);
    const nextSection = afterSec.indexOf("\n## ", 1);
    const sectionContent = nextSection > 0 ? afterSec.slice(0, nextSection) : afterSec;
    expect(
      sectionContent.trim().length,
      "Security Posture section must not be empty"
    ).toBeGreaterThan(20);
  });

  for (const subsection of SECURITY_SUBSECTIONS) {
    it(`should include ${subsection} subsection`, () => {
      const content = readFileSync(TEMPLATE_PATH, "utf8");
      const lower = content.toLowerCase();
      expect(
        lower.includes(subsection.toLowerCase()),
        `Security Posture must include "${subsection}"`
      ).toBe(true);
    });
  }
});

// ─── AC5: Cost Model section with required elements ─────────

describe("AC5: Cost Model section with per-environment costs, scaling projections, and cost-per-unit", () => {
  it("should include per-environment cost estimates", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const lower = content.toLowerCase();
    expect(
      lower.includes("per-environment") || lower.includes("per environment"),
      "Cost Model must include per-environment resource cost estimates"
    ).toBe(true);
  });

  it("should include scaling cost projections", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const lower = content.toLowerCase();
    expect(
      lower.includes("scaling") && lower.includes("projection"),
      "Cost Model must include scaling cost projections"
    ).toBe(true);
  });

  it("should include cost-per-unit efficiency metrics", () => {
    const content = readFileSync(TEMPLATE_PATH, "utf8");
    const lower = content.toLowerCase();
    expect(
      lower.includes("cost-per-unit") || lower.includes("cost per unit"),
      "Cost Model must include cost-per-unit efficiency metrics"
    ).toBe(true);
  });
});
