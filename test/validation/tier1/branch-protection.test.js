import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const CODEOWNERS_PATH = resolve(PROJECT_ROOT, ".github/CODEOWNERS");
const CONTRIBUTING_PATH = resolve(PROJECT_ROOT, "CONTRIBUTING.md");

describe("Branch Protection Configuration (E4-S5)", () => {
  // AC2: CODEOWNERS file
  describe("AC2 — CODEOWNERS file", () => {
    it("CODEOWNERS file should exist at .github/CODEOWNERS", () => {
      expect(existsSync(CODEOWNERS_PATH)).toBe(true);
    });

    it("should require maintainer review for .github/workflows/", () => {
      const content = readFileSync(CODEOWNERS_PATH, "utf8");
      expect(content).toMatch(/.github\/workflows\/\s+@gaia-framework\/maintainers/);
    });

    it("should require maintainer review for package.json", () => {
      const content = readFileSync(CODEOWNERS_PATH, "utf8");
      expect(content).toMatch(/package\.json\s+@gaia-framework\/maintainers/);
    });

    it("should require maintainer review for package-lock.json", () => {
      const content = readFileSync(CODEOWNERS_PATH, "utf8");
      expect(content).toMatch(/package-lock\.json\s+@gaia-framework\/maintainers/);
    });

    it("should require maintainer review for gaia-install.sh", () => {
      const content = readFileSync(CODEOWNERS_PATH, "utf8");
      expect(content).toMatch(/gaia-install\.sh\s+@gaia-framework\/maintainers/);
    });

    it("should require maintainer review for bin/", () => {
      const content = readFileSync(CODEOWNERS_PATH, "utf8");
      expect(content).toMatch(/bin\/\s+@gaia-framework\/maintainers/);
    });
  });

  // AC3: CONTRIBUTING.md with branch protection section
  describe("AC3 — CONTRIBUTING.md", () => {
    it("CONTRIBUTING.md should exist at project root", () => {
      expect(existsSync(CONTRIBUTING_PATH)).toBe(true);
    });

    it("should contain a branch protection section", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf8");
      expect(content.toLowerCase()).toMatch(/branch protection/);
    });

    it("should document required reviews", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf8");
      expect(content.toLowerCase()).toMatch(/required.*review|review.*required/);
    });

    it("should document required CI checks", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf8");
      expect(content.toLowerCase()).toMatch(/status check|ci check/);
    });

    it("should document no direct push policy", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf8");
      expect(content.toLowerCase()).toMatch(
        /no direct push|direct push.*blocked|pull request.*required/
      );
    });

    it("should document CODEOWNERS requirement", () => {
      const content = readFileSync(CONTRIBUTING_PATH, "utf8");
      expect(content).toMatch(/CODEOWNERS/);
    });
  });
});
