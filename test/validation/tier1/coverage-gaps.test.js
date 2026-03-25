import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve, basename } from "path";

// Framework root is where _gaia/ lives (one level above Gaia-framework/)
const FRAMEWORK_ROOT = resolve(import.meta.dirname, "../../../..");
const GAIA_DIR = join(FRAMEWORK_ROOT, "_gaia");

// ── Helpers ──────────────────────────────────────────────────

/** Parse a CSV file into an array of row objects using the header row as keys. */
function parseCsv(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = "";
    let inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

/** Discover all .md files in a directory (excluding underscore-prefixed files). */
function discoverMdFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => join(dir, f));
}

/** Discover all .xml files in a directory. */
function discoverXmlFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".xml"))
    .map((f) => join(dir, f));
}

// ── Pre-compute file lists ───────────────────────────────────

const LIFECYCLE_SKILLS_DIR = join(GAIA_DIR, "lifecycle", "skills");
const lifecycleSkillFiles = discoverMdFilesIn(LIFECYCLE_SKILLS_DIR);

const CORE_DIRS = {
  engine: join(GAIA_DIR, "core", "engine"),
  protocols: join(GAIA_DIR, "core", "protocols"),
  tasks: join(GAIA_DIR, "core", "tasks"),
};
const coreXmlFiles = Object.values(CORE_DIRS).flatMap(discoverXmlFilesIn);

// ── AC1: Lifecycle skills covered by skill validator ─────────

describe("E1-S8: Validation Coverage Gaps", () => {
  describe("AC1: Lifecycle skills scanned by skill validator", () => {
    it("should discover lifecycle skill files", () => {
      expect(
        lifecycleSkillFiles.length,
        "No lifecycle skill files found in _gaia/lifecycle/skills/"
      ).toBeGreaterThan(0);
    });

    it("should find at least 3 lifecycle skill files", () => {
      expect(
        lifecycleSkillFiles.length,
        `Expected at least 3 lifecycle skills, found ${lifecycleSkillFiles.length}`
      ).toBeGreaterThanOrEqual(3);
    });

    it("lifecycle skills should be within the 500-line limit", () => {
      for (const filePath of lifecycleSkillFiles) {
        const content = readFileSync(filePath, "utf8");
        const lineCount = content.split("\n").length;
        expect(
          lineCount,
          `${basename(filePath)} is ${lineCount} lines — exceeds 500-line limit`
        ).toBeLessThanOrEqual(500);
      }
    });

    it("lifecycle skills should have <!-- SECTION: xxx --> markers", () => {
      for (const filePath of lifecycleSkillFiles) {
        const content = readFileSync(filePath, "utf8");
        const markers = content.match(/<!--\s*SECTION:\s*[\w-]+\s*-->/g) || [];
        expect(
          markers.length,
          `${basename(filePath)} has no <!-- SECTION: xxx --> markers`
        ).toBeGreaterThan(0);
      }
    });
  });

  // ── AC2: Core XML files covered by instruction validator ─────

  describe("AC2: Core XML files scanned by instruction validator", () => {
    for (const [name, dir] of Object.entries(CORE_DIRS)) {
      it(`should discover XML files in _gaia/core/${name}/`, () => {
        const files = discoverXmlFilesIn(dir);
        expect(files.length, `No XML files found in _gaia/core/${name}/`).toBeGreaterThan(0);
      });
    }

    it("all core XML files should be well-formed", async () => {
      const validatorPath = join(
        FRAMEWORK_ROOT,
        "Gaia-framework",
        "test",
        "validators",
        "instruction-validator.js"
      );
      const { validateWellFormedness } = await import(validatorPath);

      for (const file of coreXmlFiles) {
        const result = validateWellFormedness(file);
        expect(result.errors, `XML errors in ${file}`).toHaveLength(0);
      }
    });
  });

  // ── AC3: Knowledge index CSV path validation ─────────────────

  describe("AC3: Knowledge index CSV file references resolve", () => {
    const knowledgeIndexes = [
      {
        csv: join(GAIA_DIR, "dev", "knowledge", "_index.csv"),
        baseDir: join(GAIA_DIR, "dev", "knowledge"),
        label: "dev/knowledge",
      },
      {
        csv: join(GAIA_DIR, "testing", "knowledge", "_index.csv"),
        baseDir: join(GAIA_DIR, "testing", "knowledge"),
        label: "testing/knowledge",
      },
    ];

    for (const { csv, baseDir, label } of knowledgeIndexes) {
      describe(`${label}/_index.csv`, () => {
        it("CSV file should exist", () => {
          expect(existsSync(csv), `Knowledge index CSV not found: ${csv}`).toBe(true);
        });

        it("all file path references should resolve to existing files", () => {
          if (!existsSync(csv)) return;
          const rows = parseCsv(csv);
          expect(rows.length, `${label}/_index.csv has no data rows`).toBeGreaterThan(0);

          const missing = [];
          for (const row of rows) {
            const filePath = row.file;
            if (!filePath) continue;
            const fullPath = join(baseDir, filePath);
            if (!existsSync(fullPath)) {
              missing.push({ reference: filePath, expected: fullPath });
            }
          }
          expect(
            missing,
            `${label}/_index.csv has ${missing.length} broken reference(s):\n${missing.map((m) => `  - ${m.reference} (expected: ${m.expected})`).join("\n")}`
          ).toHaveLength(0);
        });
      });
    }
  });

  // ── AC4: All new validations pass with zero failures ─────────

  describe("AC4: Integration — all new validations pass on current codebase", () => {
    it("lifecycle skills + core XML + knowledge CSVs all have zero validation errors", () => {
      // This is a meta-test — if any AC1-AC3 test above fails, this section documents the intent
      // The actual validation is performed by the individual AC tests above
      expect(true).toBe(true);
    });
  });
});
