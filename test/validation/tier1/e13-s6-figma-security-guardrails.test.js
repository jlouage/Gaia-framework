import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const SKILL_PATH = resolve(
  PROJECT_ROOT,
  "_gaia/dev/skills/figma-integration.md",
);
const GITIGNORE_PATH = resolve(PROJECT_ROOT, ".gitignore");

/**
 * E13-S6 — Security and Reliability Guardrails for Figma MCP Integration
 *
 * Validates:
 * - AC1: No Figma API tokens in GAIA output files
 * - AC2: .figma-cache/ in .gitignore
 * - AC3: Error messages contain only status codes, no sensitive data
 * - AC4: Minimum API scopes documented
 * - AC5: Detection-only mandate — no install/configure commands
 */

// --- Helper: recursively collect all files in a directory ---
function collectFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        collectFiles(full, files);
      } else if (stat.isFile()) {
        files.push(full);
      }
    } catch {
      // skip inaccessible files
    }
  }
  return files;
}

// Figma token patterns: figd_ (design), figr_ (refresh) with 40+ char suffix
const TOKEN_PATTERN = /\b(figd_[A-Za-z0-9_-]{22,}|figr_[A-Za-z0-9_-]{22,})\b/;

describe("E13-S6 — Figma Security Guardrails", () => {
  // ────────────────────────────────────────────────────
  // AC1: No Figma tokens in GAIA output directories
  // ────────────────────────────────────────────────────
  describe("AC1 — Token leakage prevention", () => {
    it("skill file exists at _gaia/dev/skills/figma-integration.md", () => {
      expect(existsSync(SKILL_PATH)).toBe(true);
    });

    it("skill file contains 'NEVER persist tokens' rule in detection section", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const detectionSection = content.split("<!-- SECTION: detection -->")[1];
      expect(detectionSection).toBeDefined();
      expect(detectionSection.toLowerCase()).toContain("never persist");
      expect(detectionSection.toLowerCase()).toContain("token");
    });

    it("each skill section contains a token safety mandate", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const sections = [
        "detection",
        "tokens",
        "components",
        "frames",
        "assets",
        "export",
      ];

      for (const section of sections) {
        const marker = `<!-- SECTION: ${section} -->`;
        const idx = content.indexOf(marker);
        expect(idx, `Section marker for '${section}' not found`).toBeGreaterThan(-1);

        // Get content from this section to the next section or end
        const nextMarkerIdx = content.indexOf("<!-- SECTION:", idx + marker.length);
        const sectionContent =
          nextMarkerIdx > -1
            ? content.slice(idx, nextMarkerIdx)
            : content.slice(idx);

        // Each section must mention that MCP auth is handled by MCP server
        expect(
          sectionContent.toLowerCase(),
          `Section '${section}' missing MCP auth boundary reminder`,
        ).toMatch(/mcp.*(server|protocol).*handle.*auth|auth.*handle.*mcp|mcp auth/i);
      }
    });

    it("no test fixtures contain real-looking Figma tokens", () => {
      const fixturesDir = resolve(PROJECT_ROOT, "test/fixtures");
      if (!existsSync(fixturesDir)) return; // skip if no fixtures dir
      const files = collectFiles(fixturesDir);
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        expect(
          content,
          `Fixture file ${file} contains a Figma token pattern`,
        ).not.toMatch(TOKEN_PATTERN);
      }
    });
  });

  // ────────────────────────────────────────────────────
  // AC2: .figma-cache/ in .gitignore
  // ────────────────────────────────────────────────────
  describe("AC2 — Cache isolation via .gitignore", () => {
    it(".gitignore exists", () => {
      expect(existsSync(GITIGNORE_PATH)).toBe(true);
    });

    it(".gitignore contains .figma-cache/ entry", () => {
      const content = readFileSync(GITIGNORE_PATH, "utf8");
      expect(content).toMatch(/\.figma-cache\//);
    });
  });

  // ────────────────────────────────────────────────────
  // AC3: Error message sanitization rules
  // ────────────────────────────────────────────────────
  describe("AC3 — Error message sanitization", () => {
    it("detection section documents error sanitization rules", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const detectionSection = content.split("<!-- SECTION: detection -->")[1];
      expect(detectionSection).toBeDefined();
      // Must mention sanitization or safe error handling
      expect(detectionSection.toLowerCase()).toMatch(/error.*sanitiz|sanitiz.*error|safe.*error/);
    });

    it("detection section lists disallowed error content", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const detectionSection = content.split("<!-- SECTION: detection -->")[1];
      expect(detectionSection).toBeDefined();
      // Must explicitly list what NOT to include in errors
      expect(detectionSection.toLowerCase()).toContain("file key");
      expect(detectionSection.toLowerCase()).toContain("node id");
      expect(detectionSection.toLowerCase()).toContain("url");
    });

    it("error message template contains only status codes and generic descriptions", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      // Must contain the canonical error format
      expect(content).toMatch(
        /Figma MCP error:.*\{?status.code\}?.*Falling back to markdown-only/i,
      );
    });

    it("skill file contains no URL patterns or file key placeholders in error examples", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      // Look for error-related sections — they must not contain figma.com URLs or file key patterns
      const errorRelatedLines = content
        .split("\n")
        .filter((line) => line.toLowerCase().includes("error"));
      for (const line of errorRelatedLines) {
        expect(line, `Error line contains Figma URL: ${line}`).not.toMatch(
          /https?:\/\/[^\s]*figma\.com/,
        );
        expect(line, `Error line contains file key pattern: ${line}`).not.toMatch(
          /[A-Za-z0-9]{22,}(?![\w-])/,
        );
      }
    });
  });

  // ────────────────────────────────────────────────────
  // AC4: Minimum API scopes documented
  // ────────────────────────────────────────────────────
  describe("AC4 — API scope documentation", () => {
    it("detection section contains minimum API scopes subsection", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const detectionSection = content.split("<!-- SECTION: detection -->")[1];
      expect(detectionSection).toBeDefined();
      expect(detectionSection.toLowerCase()).toContain("minimum");
      expect(detectionSection.toLowerCase()).toContain("scope");
    });

    it("documents default scopes: files:read and file_content:read", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      expect(content).toContain("files:read");
      expect(content).toContain("file_content:read");
    });

    it("documents Generate mode additional scope: files:write", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      expect(content).toContain("files:write");
    });

    it("notes that scope enforcement is the MCP server's responsibility", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      expect(content.toLowerCase()).toMatch(
        /scope.*enforcement.*mcp.*server|mcp.*server.*enforce.*scope/,
      );
    });
  });

  // ────────────────────────────────────────────────────
  // AC5: Detection-only mandate
  // ────────────────────────────────────────────────────
  describe("AC5 — Detection-only mandate (no install/configure)", () => {
    it("skill file documents that GAIA never installs or configures MCP server", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      expect(content.toLowerCase()).toMatch(/never.*install/);
      expect(content.toLowerCase()).toMatch(/never.*configure|never.*modify/);
    });

    it("no npm install, brew install, or config-write commands in any section", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      expect(content).not.toMatch(/npm\s+install\b/);
      expect(content).not.toMatch(/brew\s+install\b/);
      expect(content).not.toMatch(/pip\s+install\b/);
      // Ensure no MCP server config writing
      expect(content).not.toMatch(/mcp_servers\.json/);
    });

    it("detection uses read-only probe via figma/get_user_info or similar", () => {
      const content = readFileSync(SKILL_PATH, "utf8");
      const detectionSection = content.split("<!-- SECTION: detection -->")[1];
      expect(detectionSection).toBeDefined();
      expect(detectionSection.toLowerCase()).toMatch(/read.only|read-only/);
    });
  });
});
