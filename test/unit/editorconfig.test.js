import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "../..");
const EDITORCONFIG_PATH = join(PROJECT_ROOT, ".editorconfig");

describe("EditorConfig", () => {
  describe("AC1: File existence and global settings", () => {
    it("should exist at project root", () => {
      expect(existsSync(EDITORCONFIG_PATH)).toBe(true);
    });

    it("should contain indent_style = space in global section", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");
      expect(globalSection).toContain("indent_style = space");
    });

    it("should contain indent_size = 2 in global section", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");
      expect(globalSection).toContain("indent_size = 2");
    });

    it("should contain charset = utf-8 in global section", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");
      expect(globalSection).toContain("charset = utf-8");
    });

    it("should contain end_of_line = lf in global section", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");
      expect(globalSection).toContain("end_of_line = lf");
    });

    it("should contain trim_trailing_whitespace = true in global section", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");
      expect(globalSection).toContain("trim_trailing_whitespace = true");
    });

    it("should contain insert_final_newline = true in global section", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");
      expect(globalSection).toContain("insert_final_newline = true");
    });
  });

  describe("AC2: Prettier alignment", () => {
    it("should not contradict Prettier tabWidth if .prettierrc.json exists", () => {
      const prettierPath = join(PROJECT_ROOT, ".prettierrc.json");
      if (!existsSync(prettierPath)) {
        // E5-S2 not merged yet — document expected alignment
        // EditorConfig indent_size=2 should match Prettier tabWidth=2
        // EditorConfig indent_style=space should match Prettier useTabs=false
        expect(true).toBe(true); // Soft pass — verified after E5-S2
        return;
      }
      const prettierConfig = JSON.parse(readFileSync(prettierPath, "utf-8"));
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");

      if (prettierConfig.tabWidth !== undefined) {
        expect(globalSection).toContain(
          `indent_size = ${prettierConfig.tabWidth}`,
        );
      }
      if (prettierConfig.useTabs !== undefined) {
        const expectedStyle = prettierConfig.useTabs ? "tab" : "space";
        expect(globalSection).toContain(`indent_style = ${expectedStyle}`);
      }
    });
  });

  describe("AC3: Root directive", () => {
    it("should have root = true as the first non-comment, non-empty line", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const lines = content.split("\n");
      const firstSignificantLine = lines.find(
        (line) => line.trim() !== "" && !line.trim().startsWith("#"),
      );
      expect(firstSignificantLine?.trim()).toBe("root = true");
    });
  });

  describe("AC4: Package exclusion", () => {
    it("should not be included in package.json files whitelist", () => {
      const pkgPath = join(PROJECT_ROOT, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      // The files whitelist only includes bin/ and gaia-install.sh
      // .editorconfig should NOT be listed
      const filesField = pkg.files || [];
      const includesEditorconfig = filesField.some(
        (entry) =>
          entry === ".editorconfig" || entry.includes(".editorconfig"),
      );
      expect(includesEditorconfig).toBe(false);
    });
  });

  describe("AC5: Cross-platform line endings", () => {
    it("should enforce LF line endings via end_of_line = lf", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const globalSection = extractSection(content, "[*]");
      expect(globalSection).toContain("end_of_line = lf");
    });
  });

  describe("Markdown exception", () => {
    it("should have trim_trailing_whitespace = false for *.md files", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const mdSection = extractSection(content, "[*.md]");
      expect(mdSection).toContain("trim_trailing_whitespace = false");
    });
  });

  describe("Makefile exception", () => {
    it("should have indent_style = tab for Makefile", () => {
      const content = readFileSync(EDITORCONFIG_PATH, "utf-8");
      const makefileSection = extractSection(content, "[Makefile]");
      expect(makefileSection).toContain("indent_style = tab");
    });
  });
});

/**
 * Extract the content of a specific section from an EditorConfig file.
 * Returns all lines from the section header until the next section header or EOF.
 */
function extractSection(content, sectionHeader) {
  const lines = content.split("\n");
  let inSection = false;
  const sectionLines = [];

  for (const line of lines) {
    if (line.trim() === sectionHeader) {
      inSection = true;
      continue;
    }
    if (inSection && line.trim().startsWith("[")) {
      break;
    }
    if (inSection) {
      sectionLines.push(line);
    }
  }
  return sectionLines.join("\n");
}
