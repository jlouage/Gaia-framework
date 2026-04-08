import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const DEV_SKILLS_DIR = join(PROJECT_ROOT, "_gaia", "dev", "skills");
const SKILL_FILE = join(DEV_SKILLS_DIR, "figma-integration.md");
const SKILL_INDEX = join(DEV_SKILLS_DIR, "_skill-index.yaml");
const BASE_DEV = join(PROJECT_ROOT, "_gaia", "dev", "agents", "_base-dev.md");

/** Read file content or return null if missing. */
function safeRead(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** Parse YAML frontmatter from markdown. */
function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split("\n")) {
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kvMatch) {
      let value = kvMatch[2].trim();
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

/** Extract section markers from content. */
function extractSections(content) {
  const markers = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/<!--\s*SECTION:\s*([\w-]+)\s*-->/);
    if (match) markers.push({ id: match[1], line: i + 1 });
  }
  return markers;
}

describe("E13-S1: Figma MCP Detection Probe", () => {
  // --- AC4: Detection code lives in detection section ---
  describe("AC4: Skill file structure", () => {
    it("should exist at _gaia/dev/skills/figma-integration.md", () => {
      expect(existsSync(SKILL_FILE), "figma-integration.md does not exist").toBe(true);
    });

    it("should have a <!-- SECTION: detection --> marker", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      const sections = extractSections(content);
      const detectionSection = sections.find((s) => s.id === "detection");
      expect(detectionSection, "No <!-- SECTION: detection --> marker found").toBeTruthy();
    });

    it("should have placeholder markers for future sections (tokens, components, frames, assets, export)", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      const sections = extractSections(content);
      const sectionIds = sections.map((s) => s.id);
      for (const expected of ["tokens", "components", "frames", "assets", "export"]) {
        expect(sectionIds, `Missing placeholder section: ${expected}`).toContain(expected);
      }
    });
  });

  // --- AC1: Detection probe uses figma/get_user_info with 5s timeout ---
  describe("AC1: Detection probe logic", () => {
    it("should reference figma/get_user_info as the probe call", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/figma\/get_user_info/);
    });

    it("should specify a 5-second hard timeout", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/5[- ]?second/i);
    });
  });

  // --- AC2: Mode selection on success ---
  describe("AC2: Mode selection on successful detection", () => {
    it("should define Generate / Import / Skip mode options", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/Generate/);
      expect(content).toMatch(/Import/);
      expect(content).toMatch(/Skip/);
    });
  });

  // --- AC3: Silent fallback when absent ---
  describe("AC3: Silent fallback when MCP absent", () => {
    it("should specify silent fallback behavior (no error, no warning)", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      // Should mention markdown-only fallback
      expect(content).toMatch(/markdown[- ]only/i);
    });
  });

  // --- AC5/AC6: Not installed / not running fallback ---
  describe("AC5/AC6: Graceful fallback for not-installed and not-running", () => {
    it("should handle MCP not installed scenario", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/not installed|not available|tool not found/i);
    });

    it("should handle MCP not running scenario", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/not running|connection refused|connection error/i);
    });
  });

  // --- AC7: Token expired warning ---
  describe("AC7: Token expired handling", () => {
    it("should warn about expired token with specific message", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/[Tt]oken expired/);
      expect(content).toMatch(/falling back to markdown/i);
    });
  });

  // --- AC8: Rate limited (429) retry ---
  describe("AC8: Rate limited retry", () => {
    it("should handle 429 responses with a single retry", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/429/);
      expect(content).toMatch(/retry/i);
    });
  });

  // --- AC9: Timeout handling ---
  describe("AC9: Timeout handling", () => {
    it("should handle timeout exceeding 5 seconds", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      expect(content).toMatch(/timeout/i);
    });
  });

  // --- Skill registration ---
  describe("Skill registration", () => {
    it("should be registered in _skill-index.yaml", () => {
      const content = safeRead(SKILL_INDEX);
      expect(content).not.toBeNull();
      expect(content).toMatch(/figma-integration\.md/);
    });

    it("should have detection section listed in _skill-index.yaml", () => {
      const content = safeRead(SKILL_INDEX);
      expect(content).not.toBeNull();
      expect(content).toMatch(/id:\s*detection/);
    });

    it("should be registered in _base-dev.md skill-registry", () => {
      const content = safeRead(BASE_DEV);
      expect(content).not.toBeNull();
      expect(content).toMatch(/figma-integration/);
    });
  });

  // --- Frontmatter ---
  describe("Frontmatter validation", () => {
    it("should have valid YAML frontmatter with required fields", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      const fm = parseFrontmatter(content);
      expect(fm, "No frontmatter found").not.toBeNull();
      expect(fm.name).toBe("figma-integration");
      expect(fm.version).toBeTruthy();
      expect(fm.applicable_agents).toBeTruthy();
    });

    it("should list all 6 dev agents in applicable_agents", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      const fm = parseFrontmatter(content);
      expect(fm).not.toBeNull();
      const agents = Array.isArray(fm.applicable_agents)
        ? fm.applicable_agents
        : [fm.applicable_agents];
      for (const agent of [
        "typescript-dev",
        "angular-dev",
        "flutter-dev",
        "java-dev",
        "python-dev",
        "mobile-dev",
      ]) {
        expect(agents, `Missing agent: ${agent}`).toContain(agent);
      }
    });
  });

  // --- File size constraint ---
  describe("File size constraint (FR-133)", () => {
    it("should be under 300 lines total", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      const lineCount = content.replace(/\r\n/g, "\n").split("\n").length;
      expect(lineCount, `File is ${lineCount} lines — exceeds 300-line limit`).toBeLessThanOrEqual(
        300
      );
    });
  });

  // --- Security: no tokens or credentials ---
  describe("Security: no credentials", () => {
    it("should not contain any API tokens, keys, or credentials", () => {
      const content = safeRead(SKILL_FILE);
      expect(content).not.toBeNull();
      // Check for common credential patterns
      expect(content).not.toMatch(/figd_[A-Za-z0-9]{20,}/); // Figma personal access token pattern
      expect(content).not.toMatch(/sk-[A-Za-z0-9]{20,}/); // Generic secret key pattern
      expect(content).not.toMatch(/Bearer [A-Za-z0-9]{20,}/); // Bearer token
    });
  });
});
