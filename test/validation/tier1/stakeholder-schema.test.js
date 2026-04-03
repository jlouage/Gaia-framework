import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const CUSTOM_STAKEHOLDERS_DIR = join(PROJECT_ROOT, "custom", "stakeholders");

// Required frontmatter fields per Architecture 10.18.1 and PRD 4.18.1
const REQUIRED_FIELDS = ["name", "role", "expertise", "personality"];
const OPTIONAL_FIELDS = ["perspective", "tags"];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Constraints from FR-164, NFR-029
const MAX_LINES_PER_FILE = 100;
const MAX_FILES_IN_DIR = 50;

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns an object with the parsed key-value pairs.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fields = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const kvMatch = line.match(/^(\w+):\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();
      // Handle quoted strings
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Handle arrays (tags)
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      }
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Discover all .md stakeholder files (excluding README.md).
 */
function discoverStakeholderFiles() {
  if (!existsSync(CUSTOM_STAKEHOLDERS_DIR)) return [];
  return readdirSync(CUSTOM_STAKEHOLDERS_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => join(CUSTOM_STAKEHOLDERS_DIR, f));
}

// ─── STK-05: Directory Convention ──────────────────────────────────────────

describe("Stakeholder directory convention (STK-05)", () => {
  it("custom/stakeholders/ directory exists", () => {
    expect(existsSync(CUSTOM_STAKEHOLDERS_DIR)).toBe(true);
  });

  it("custom/stakeholders/README.md exists with schema documentation", () => {
    const readmePath = join(CUSTOM_STAKEHOLDERS_DIR, "README.md");
    expect(existsSync(readmePath)).toBe(true);

    const content = readFileSync(readmePath, "utf8");
    // README should document required fields
    for (const field of REQUIRED_FIELDS) {
      expect(content).toContain(field);
    }
    // README should document optional fields
    for (const field of OPTIONAL_FIELDS) {
      expect(content).toContain(field);
    }
    // README should mention constraints
    expect(content).toMatch(/100\s*lines/i);
    expect(content).toMatch(/50\s*files/i);
  });

  it("README documents that stakeholders have NO agent-manifest entry, NO memory sidecars, NO activation protocols, NO workflow integration", () => {
    const readmePath = join(CUSTOM_STAKEHOLDERS_DIR, "README.md");
    const content = readFileSync(readmePath, "utf8");
    expect(content).toMatch(/agent.manifest/i);
    expect(content).toMatch(/memory\s*sidecar/i);
    expect(content).toMatch(/activation\s*protocol/i);
    expect(content).toMatch(/workflow\s*integration/i);
  });
});

// ─── STK-01: Valid stakeholder file with all fields ────────────────────────

describe("Stakeholder file schema (STK-01, STK-02)", () => {
  const stakeholderFiles = discoverStakeholderFiles();

  it("at least one example stakeholder file exists (STK-03/AC3)", () => {
    expect(stakeholderFiles.length).toBeGreaterThan(0);
  });

  it.each(stakeholderFiles.map((f) => [basename(f), f]))(
    "%s has valid YAML frontmatter with required fields",
    (_name, filePath) => {
      const content = readFileSync(filePath, "utf8");
      const frontmatter = parseFrontmatter(content);

      expect(frontmatter).not.toBeNull();
      for (const field of REQUIRED_FIELDS) {
        expect(frontmatter).toHaveProperty(field);
        expect(frontmatter[field]).toBeTruthy();
      }
    }
  );

  it.each(stakeholderFiles.map((f) => [basename(f), f]))(
    "%s contains only recognized schema fields",
    (_name, filePath) => {
      const content = readFileSync(filePath, "utf8");
      const frontmatter = parseFrontmatter(content);

      expect(frontmatter).not.toBeNull();
      for (const key of Object.keys(frontmatter)) {
        expect(ALL_FIELDS).toContain(key);
      }
    }
  );

  it.each(stakeholderFiles.map((f) => [basename(f), f]))(
    "%s has string type for required fields",
    (_name, filePath) => {
      const content = readFileSync(filePath, "utf8");
      const frontmatter = parseFrontmatter(content);

      expect(frontmatter).not.toBeNull();
      for (const field of REQUIRED_FIELDS) {
        expect(typeof frontmatter[field]).toBe("string");
      }
    }
  );

  it.each(stakeholderFiles.map((f) => [basename(f), f]))(
    "%s has array type for tags if present",
    (_name, filePath) => {
      const content = readFileSync(filePath, "utf8");
      const frontmatter = parseFrontmatter(content);

      if (frontmatter && frontmatter.tags) {
        expect(Array.isArray(frontmatter.tags)).toBe(true);
      }
    }
  );
});

// ─── STK-04: File constraints (FR-164) ─────────────────────────────────────

describe("Stakeholder file constraints (STK-04, FR-164)", () => {
  const stakeholderFiles = discoverStakeholderFiles();

  it.each(stakeholderFiles.map((f) => [basename(f), f]))(
    "%s does not exceed 100 lines",
    (_name, filePath) => {
      const content = readFileSync(filePath, "utf8");
      const lineCount = content.split("\n").length;
      expect(lineCount).toBeLessThanOrEqual(MAX_LINES_PER_FILE);
    }
  );

  it("total stakeholder files do not exceed 50", () => {
    expect(stakeholderFiles.length).toBeLessThanOrEqual(MAX_FILES_IN_DIR);
  });
});

// ─── Installer integration ─────────────────────────────────────────────────

describe("Installer stakeholder directory support", () => {
  it("gaia-install.sh references custom/stakeholders/ in init", () => {
    const installerPath = join(PROJECT_ROOT, "gaia-install.sh");
    expect(existsSync(installerPath)).toBe(true);

    const content = readFileSync(installerPath, "utf8");
    expect(content).toContain("stakeholders");
  });

  it("gaia-install.sh validates custom/stakeholders/ exists", () => {
    const installerPath = join(PROJECT_ROOT, "gaia-install.sh");
    const content = readFileSync(installerPath, "utf8");
    expect(content).toMatch(/custom\/stakeholders/);
  });
});

// ─── Schema alignment (STK-04.1, STK-04.2) ────────────────────────────────

describe("Schema alignment with documentation", () => {
  it("example stakeholder file demonstrates all required AND optional fields", () => {
    const stakeholderFiles = discoverStakeholderFiles();
    // At least one file must have ALL fields (required + optional)
    const hasCompleteExample = stakeholderFiles.some((filePath) => {
      const content = readFileSync(filePath, "utf8");
      const frontmatter = parseFrontmatter(content);
      if (!frontmatter) return false;
      return ALL_FIELDS.every((field) => field in frontmatter);
    });
    expect(hasCompleteExample).toBe(true);
  });

  it("example stakeholder file has a free-form markdown body", () => {
    const stakeholderFiles = discoverStakeholderFiles();
    // At least one file must have content after frontmatter
    const hasBody = stakeholderFiles.some((filePath) => {
      const content = readFileSync(filePath, "utf8");
      const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]+)/);
      return bodyMatch && bodyMatch[1].trim().length > 0;
    });
    expect(hasBody).toBe(true);
  });
});
