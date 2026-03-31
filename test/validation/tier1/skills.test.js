import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve, basename } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const DEV_SKILLS_DIR = join(PROJECT_ROOT, "_gaia", "dev", "skills");
const LIFECYCLE_SKILLS_DIR = join(PROJECT_ROOT, "_gaia", "lifecycle", "skills");
const SKILLS_DIR = DEV_SKILLS_DIR; // backward-compat alias for index tests
const SKILL_INDEX_PATH = join(DEV_SKILLS_DIR, "_skill-index.yaml");

/** All skill directories to scan — E1-S8 extends coverage to lifecycle skills. */
const ALL_SKILL_DIRS = [DEV_SKILLS_DIR, LIFECYCLE_SKILLS_DIR];

/** Cache file contents to avoid repeated reads. */
const fileContentCache = new Map();
function readCached(filePath) {
  if (!fileContentCache.has(filePath)) {
    fileContentCache.set(filePath, readFileSync(filePath, "utf8"));
  }
  return fileContentCache.get(filePath);
}

/**
 * Return lines from content that are outside fenced code blocks.
 * Each entry is { text, lineNum } where lineNum is 1-based.
 */
function getProseLines(content) {
  // Normalize CRLF to LF for cross-platform compatibility (Windows)
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const result = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^```/)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) result.push({ text: lines[i], lineNum: i + 1 });
  }
  return result;
}

/**
 * Discover all skill .md files across all skill directories (E1-S8: includes lifecycle skills).
 * Excludes _skill-index.yaml and any non-.md files.
 */
function discoverSkillFiles() {
  const files = [];
  for (const dir of ALL_SKILL_DIRS) {
    if (!existsSync(dir)) continue;
    const found = readdirSync(dir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
      .map((f) => join(dir, f));
    files.push(...found);
  }
  return files;
}

/**
 * Discover skill files in a single directory only.
 * Used for index-specific validation that only applies to directories with _skill-index.yaml.
 */
function _discoverSkillFilesInDir(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => join(dir, f));
}

/**
 * Discover all agent directories under _gaia/ (dev/agents/, lifecycle/agents/, etc.).
 */
function discoverAllAgentDirs() {
  const gaiaDir = join(PROJECT_ROOT, "_gaia");
  const dirs = [];
  for (const module of readdirSync(gaiaDir)) {
    const agentsDir = join(gaiaDir, module, "agents");
    if (existsSync(agentsDir)) {
      dirs.push(agentsDir);
    }
  }
  return dirs;
}

/**
 * Check if an agent ID exists in any agent directory.
 * Recognizes "all" as a valid wildcard (used by lifecycle skills like memory-management).
 */
function agentExists(agentId) {
  if (agentId === "all") return true;
  for (const dir of discoverAllAgentDirs()) {
    if (existsSync(join(dir, `${agentId}.md`))) return true;
  }
  return false;
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns an object with key-value pairs, or null if no frontmatter.
 */
function parseFrontmatter(content) {
  // Normalize CRLF to LF for cross-platform compatibility (Windows)
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    // Handle simple key: value
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kvMatch) {
      let value = kvMatch[2].trim();
      // Parse array syntax [a, b, c]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      } else {
        value = value.replace(/^['"]|['"]$/g, "");
      }
      fm[kvMatch[1]] = value;
    }
  }
  return Object.keys(fm).length > 0 ? fm : null;
}

/**
 * Parse _skill-index.yaml into structured data.
 * Minimal parser for the known format.
 */
function parseSkillIndex(content) {
  const entries = [];
  let current = null;
  let inSections = false;
  // Normalize CRLF to LF for cross-platform compatibility (Windows)
  const normalized = content.replace(/\r\n/g, "\n");
  for (const line of normalized.split("\n")) {
    const fileMatch = line.match(/^\s*-\s*file:\s*(.+)$/);
    if (fileMatch) {
      if (current) entries.push(current);
      current = { file: fileMatch[1].trim(), sections: [] };
      inSections = false;
      continue;
    }
    if (line.match(/^\s*sections:\s*$/)) {
      inSections = true;
      continue;
    }
    if (inSections && current) {
      const sectionMatch = line.match(
        /^\s*-\s*\{\s*id:\s*([\w-]+)\s*,\s*line_range:\s*\[(\d+)\s*,\s*(\d+)\]\s*,\s*description:\s*"([^"]*)"\s*\}/
      );
      if (sectionMatch) {
        current.sections.push({
          id: sectionMatch[1],
          line_range: [parseInt(sectionMatch[2]), parseInt(sectionMatch[3])],
          description: sectionMatch[4],
        });
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * Extract all H2 headings from markdown content, skipping those inside fenced code blocks.
 */
function extractH2Headings(content) {
  return getProseLines(content)
    .filter((l) => l.text.match(/^## /))
    .map((l) => ({ text: l.text.replace(/^## /, "").trim(), line: l.lineNum }));
}

/**
 * Extract all <!-- SECTION: xxx --> markers from content.
 */
function extractSectionMarkers(content) {
  const markers = [];
  // Normalize CRLF to LF for cross-platform compatibility (Windows)
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/<!--\s*SECTION:\s*([\w-]+)\s*-->/);
    if (match) {
      markers.push({ id: match[1], line: i + 1 });
    }
  }
  return markers;
}

/**
 * Scan for cross-references to other skill files.
 */
function findCrossReferences(content, filename) {
  const refs = [];
  // Markdown links to other skill files
  const linkPattern = /\[([^\]]*)\]\(([^)]*\.md(?:#[\w-]*)?)\)/g;
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const target = match[2];
    // Only count references to other skill files, not self-references
    if (!target.includes(filename)) {
      refs.push({ text: match[1], target });
    }
  }
  return refs;
}

// --- Test Suites ---

const skillFiles = discoverSkillFiles();

describe("Skill File Validation (E1-S3, FR-32)", () => {
  // AC1: Line count validation
  describe("AC1: Line count within 500-line limit", () => {
    it("should discover skill files via glob (auto-discovery)", () => {
      expect(skillFiles.length, "No skill files discovered in _gaia/dev/skills/").toBeGreaterThan(
        0
      );
    });

    describe.each(skillFiles)("%s", (filePath) => {
      it("should be within the 500-line limit", () => {
        const content = readCached(filePath);
        const lineCount = content.replace(/\r\n/g, "\n").split("\n").length;
        expect(
          lineCount,
          `${basename(filePath)} is ${lineCount} lines — exceeds 500-line limit`
        ).toBeLessThanOrEqual(500);
      });
    });
  });

  // AC2: Heading structure and section markers
  describe("AC2: Heading hierarchy and section markers", () => {
    describe.each(skillFiles)("%s", (filePath) => {
      const content = readCached(filePath);
      const headings = extractH2Headings(content);
      const rawLines = content.replace(/\r\n/g, "\n").split("\n");

      it("should have proper markdown heading hierarchy (H2 for sections, H3 for subsections)", () => {
        expect(headings.length, `${basename(filePath)} has no H2 sections`).toBeGreaterThan(0);

        const firstH2Line = headings[0]?.line ?? Infinity;
        for (const { text, lineNum } of getProseLines(content)) {
          if (text.match(/^### /)) {
            expect(
              lineNum,
              `${basename(filePath)}: H3 at line ${lineNum} appears before first H2 at line ${firstH2Line}`
            ).toBeGreaterThan(firstH2Line);
          }
        }
      });

      it("should have a <!-- SECTION: xxx --> comment marker above each H2", () => {
        for (const heading of headings) {
          const markerLine = heading.line - 2; // 0-indexed line above the H2
          if (markerLine >= 0) {
            expect(
              rawLines[markerLine],
              `${basename(filePath)}: H2 "${heading.text}" at line ${heading.line} has no <!-- SECTION: xxx --> marker on line ${markerLine + 1}`
            ).toMatch(/<!--\s*SECTION:\s*[\w-]+\s*-->/);
          }
        }
      });
    });
  });

  // AC3: Cross-reference validation
  describe("AC3: Cross-reference integrity", () => {
    describe.each(skillFiles)("%s", (filePath) => {
      it("should have no broken cross-references to other skill files", () => {
        const content = readCached(filePath);
        const refs = findCrossReferences(content, basename(filePath));

        for (const ref of refs) {
          // Resolve relative path from skill file location
          const targetPath = resolve(SKILLS_DIR, ref.target.split("#")[0]);
          expect(
            existsSync(targetPath),
            `${basename(filePath)}: broken cross-reference to "${ref.target}" (link text: "${ref.text}")`
          ).toBe(true);

          // If section reference, verify section exists in target
          if (ref.target.includes("#")) {
            const sectionId = ref.target.split("#")[1];
            const targetContent = readCached(targetPath);
            const targetMarkers = extractSectionMarkers(targetContent);
            const targetHeadings = extractH2Headings(targetContent);
            const sectionExists =
              targetMarkers.some((m) => m.id === sectionId) ||
              targetHeadings.some((h) => h.text.toLowerCase().replace(/\s+/g, "-") === sectionId);
            expect(
              sectionExists,
              `${basename(filePath)}: broken section reference "${sectionId}" in ${basename(targetPath)}`
            ).toBe(true);
          }
        }
      });
    });
  });

  // AC5: Empty file or no H2 sections detection
  describe("AC5: Empty or no-H2-section detection", () => {
    describe.each(skillFiles)("%s", (filePath) => {
      it("should not be empty", () => {
        const content = readCached(filePath);
        expect(content.trim().length, `${basename(filePath)} is empty`).toBeGreaterThan(0);
      });

      it("should contain at least one H2 section", () => {
        const content = readCached(filePath);
        const headings = extractH2Headings(content);
        expect(
          headings.length,
          `${basename(filePath)} has no H2 sections — no loadable sections for JIT extraction`
        ).toBeGreaterThan(0);
      });
    });
  });

  // AC6: Duplicate H2 section name detection
  describe("AC6: Duplicate H2 section names", () => {
    describe.each(skillFiles)("%s", (filePath) => {
      it("should not have duplicate H2 section names", () => {
        const content = readCached(filePath);
        const headings = extractH2Headings(content);
        const names = headings.map((h) => h.text);
        const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
        expect(
          duplicates,
          `${basename(filePath)} has duplicate H2 sections: ${duplicates.join(", ")} — breaks sectioned loading by name`
        ).toHaveLength(0);
      });
    });
  });

  // AC7: Skill-index cross-validation
  describe("AC7: _skill-index.yaml cross-validation", () => {
    const indexContent = readCached(SKILL_INDEX_PATH);
    const indexEntries = parseSkillIndex(indexContent);

    it("should have entries in _skill-index.yaml", () => {
      expect(indexEntries.length, "_skill-index.yaml has no entries").toBeGreaterThan(0);
    });

    describe.each(indexEntries)("Index entry: $file", (entry) => {
      const entryPath = join(SKILLS_DIR, entry.file);

      it("should reference an existing skill file", () => {
        expect(existsSync(entryPath), `Index references non-existent file: ${entry.file}`).toBe(
          true
        );
      });

      it("should have section IDs matching actual <!-- SECTION: xxx --> markers", () => {
        if (!existsSync(entryPath)) return;
        const content = readCached(entryPath);
        const markers = extractSectionMarkers(content);
        const markerIds = markers.map((m) => m.id);

        for (const section of entry.sections) {
          expect(
            markerIds,
            `Index section "${section.id}" not found as <!-- SECTION: ${section.id} --> in ${entry.file}. Available markers: ${markerIds.join(", ")}`
          ).toContain(section.id);
        }
      });

      it("should have accurate line ranges for each section", () => {
        if (!existsSync(entryPath)) return;
        const content = readCached(entryPath);
        const lines = content.replace(/\r\n/g, "\n").split("\n");
        const markers = extractSectionMarkers(content);

        for (const section of entry.sections) {
          const marker = markers.find((m) => m.id === section.id);
          if (!marker) continue; // Already caught by previous test

          const [declaredStart, declaredEnd] = section.line_range;

          // Verify the section marker is at or near the declared start line
          expect(
            marker.line,
            `Index declares section "${section.id}" starts at line ${declaredStart}, but <!-- SECTION: ${section.id} --> is at line ${marker.line} in ${entry.file}`
          ).toBe(declaredStart);

          // Verify the declared end line is within the file
          expect(
            declaredEnd,
            `Index declares section "${section.id}" ends at line ${declaredEnd}, but ${entry.file} only has ${lines.length} lines`
          ).toBeLessThanOrEqual(lines.length);

          // Verify content actually exists at the declared range
          const rangeContent = lines
            .slice(declaredStart - 1, declaredEnd)
            .join("\n")
            .trim();
          expect(
            rangeContent.length,
            `Index declares section "${section.id}" at lines [${declaredStart}, ${declaredEnd}] in ${entry.file}, but that range is empty`
          ).toBeGreaterThan(0);
        }
      });
    });

    // Detect orphaned sections (in file but not in index)
    describe("Orphaned section detection", () => {
      describe.each(skillFiles)("%s", (filePath) => {
        it("should have all section markers listed in _skill-index.yaml", () => {
          const content = readCached(filePath);
          const markers = extractSectionMarkers(content);
          const filename = basename(filePath);
          const indexEntry = indexEntries.find((e) => e.file === filename);

          if (!indexEntry) {
            // File not in index at all — caught by other tests
            return;
          }

          const indexedIds = indexEntry.sections.map((s) => s.id);
          for (const marker of markers) {
            expect(
              indexedIds,
              `Orphaned section: <!-- SECTION: ${marker.id} --> in ${filename} is not listed in _skill-index.yaml`
            ).toContain(marker.id);
          }
        });
      });
    });
  });

  // AC8: Frontmatter validation
  describe("AC8: YAML frontmatter validation", () => {
    describe.each(skillFiles)("%s", (filePath) => {
      const content = readCached(filePath);
      const frontmatter = parseFrontmatter(content);
      const filename = basename(filePath, ".md");

      it("should have YAML frontmatter", () => {
        expect(frontmatter, `${basename(filePath)} has no YAML frontmatter`).not.toBeNull();
      });

      it("should have required field: name", () => {
        expect(
          frontmatter?.name,
          `${basename(filePath)} frontmatter missing 'name' field`
        ).toBeTruthy();
      });

      it("should have required field: version", () => {
        expect(
          frontmatter?.version,
          `${basename(filePath)} frontmatter missing 'version' field`
        ).toBeTruthy();
      });

      it("should have required field: applicable_agents", () => {
        expect(
          frontmatter?.applicable_agents,
          `${basename(filePath)} frontmatter missing 'applicable_agents' field`
        ).toBeTruthy();
      });

      it("should have 'name' matching the filename stem", () => {
        if (!frontmatter?.name) return;
        expect(
          frontmatter.name,
          `${basename(filePath)}: frontmatter name "${frontmatter.name}" doesn't match filename stem "${filename}"`
        ).toBe(filename);
      });

      it("should reference valid agent IDs in applicable_agents", () => {
        if (!frontmatter?.applicable_agents) return;
        const agents = Array.isArray(frontmatter.applicable_agents)
          ? frontmatter.applicable_agents
          : [frontmatter.applicable_agents];

        for (const agentId of agents) {
          expect(
            agentExists(agentId),
            `${basename(filePath)}: applicable_agents references "${agentId}" but ${agentId}.md not found in any _gaia/*/agents/ directory`
          ).toBe(true);
        }
      });
    });
  });
});
