/**
 * E6-S8: CRLF Line Ending Regression Tests
 *
 * Validates that frontmatter regex patterns handle both LF and CRLF line endings.
 * These tests cover the three distinct pattern shapes used across the codebase:
 *   1. match(/^---\r?\n([\s\S]*?)\r?\n---/) — frontmatter extraction
 *   2. replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "") — frontmatter stripping
 *   3. toMatch(/^---\r?\n/) — frontmatter assertion
 */

import { describe, it, expect } from "vitest";

// Pattern shapes under test (these mirror the actual patterns in the codebase)
const EXTRACT_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;
const STRIP_PATTERN = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const ASSERT_PATTERN = /^---\r?\n/;

describe("E6-S8: CRLF frontmatter regex patterns", () => {
  describe("Frontmatter extraction (match pattern)", () => {
    it("should extract frontmatter from LF-only content", () => {
      const content = "---\nkey: value\ntitle: test\n---\nBody text";
      const match = content.match(EXTRACT_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toContain("key: value");
    });

    it("should extract frontmatter from CRLF content", () => {
      const content = "---\r\nkey: value\r\ntitle: test\r\n---\r\nBody text";
      const match = content.match(EXTRACT_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toContain("key: value");
    });

    it("should extract frontmatter from mixed line endings (CRLF delimiters, LF body)", () => {
      const content = "---\r\nkey: value\ntitle: test\r\n---\r\nBody text";
      const match = content.match(EXTRACT_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toContain("key: value");
    });
  });

  describe("Frontmatter stripping (replace pattern)", () => {
    it("should strip frontmatter from LF-only content", () => {
      const content = "---\nkey: value\n---\nBody text";
      const result = content.replace(STRIP_PATTERN, "");
      expect(result).toBe("Body text");
    });

    it("should strip frontmatter from CRLF content", () => {
      const content = "---\r\nkey: value\r\n---\r\nBody text";
      const result = content.replace(STRIP_PATTERN, "");
      expect(result).toBe("Body text");
    });

    it("should strip frontmatter with trailing CRLF after closing delimiter", () => {
      const content = "---\r\nkey: value\r\n---\r\nBody text";
      const result = content.replace(STRIP_PATTERN, "");
      expect(result).toBe("Body text");
    });

    it("should strip frontmatter without trailing newline after closing delimiter", () => {
      const content = "---\nkey: value\n---";
      const result = content.replace(STRIP_PATTERN, "");
      expect(result).toBe("");
    });
  });

  describe("Frontmatter assertion (toMatch pattern)", () => {
    it("should match LF frontmatter delimiter", () => {
      const content = "---\nkey: value\n---\n";
      expect(content).toMatch(ASSERT_PATTERN);
    });

    it("should match CRLF frontmatter delimiter", () => {
      const content = "---\r\nkey: value\r\n---\r\n";
      expect(content).toMatch(ASSERT_PATTERN);
    });
  });

  describe("No regression on LF-only files", () => {
    it("should still match standard YAML frontmatter with LF", () => {
      const content =
        "---\ntemplate: story\nversion: 1.0\nused_by: [create-story]\n---\n# Title\nBody";
      const match = content.match(EXTRACT_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toContain("template: story");

      const stripped = content.replace(STRIP_PATTERN, "");
      expect(stripped).toBe("# Title\nBody");

      expect(content).toMatch(ASSERT_PATTERN);
    });
  });
});
