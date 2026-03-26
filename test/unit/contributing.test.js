import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "../..");
const CONTRIBUTING_PATH = join(PROJECT_ROOT, "CONTRIBUTING.md");

/**
 * Helper: read CONTRIBUTING.md content once for reuse.
 */
function getContent() {
  return readFileSync(CONTRIBUTING_PATH, "utf-8");
}

describe("CONTRIBUTING.md", () => {
  // AC1: Prerequisites and setup
  describe("AC1: Prerequisites and Getting Started", () => {
    it("should exist at project root", () => {
      expect(existsSync(CONTRIBUTING_PATH)).toBe(true);
    });

    it("should have a Prerequisites section", () => {
      const content = getContent();
      expect(content).toMatch(/## Prerequisites/i);
    });

    it("should document Node.js >= 20 requirement", () => {
      const content = getContent();
      expect(content).toMatch(/node\.?js.*(?:>=?\s*20|20\s*or\s*higher|version\s*20)/i);
    });

    it("should document node --version check", () => {
      const content = getContent();
      expect(content).toMatch(/node\s+--version/);
    });

    it("should document npm install for local development", () => {
      const content = getContent();
      expect(content).toMatch(/npm install/);
    });

    it("should document npm ci for CI environments", () => {
      const content = getContent();
      expect(content).toMatch(/npm ci/);
    });

    it("should have a Getting Started section", () => {
      const content = getContent();
      expect(content).toMatch(/## Getting Started/i);
    });
  });

  // AC2: Test instructions
  describe("AC2: Test Instructions", () => {
    it("should have a test instructions section", () => {
      const content = getContent();
      expect(content).toMatch(/## (?:Running )?Tests/i);
    });

    it("should document npm test command", () => {
      const content = getContent();
      expect(content).toMatch(/npm test(?:\s|`)/);
    });

    it("should document npm test:unit command", () => {
      const content = getContent();
      expect(content).toMatch(/npm (?:run )?test:unit/);
    });

    it("should document npm test:validation command", () => {
      const content = getContent();
      expect(content).toMatch(/npm (?:run )?test:validation/);
    });

    it("should document npm test:shell command", () => {
      const content = getContent();
      expect(content).toMatch(/npm (?:run )?test:shell/);
    });

    it("should document npm test:coverage command", () => {
      const content = getContent();
      expect(content).toMatch(/npm (?:run )?test:coverage/);
    });

    it("should mention BATS shell tests are macOS/Linux only", () => {
      const content = getContent();
      expect(content).toMatch(/BATS/i);
      expect(content).toMatch(/macOS.*Linux|Linux.*macOS/i);
    });

    it("should mention Tier 1 validation as programmatic checks", () => {
      const content = getContent();
      expect(content).toMatch(/[Tt]ier\s*1/);
      expect(content).toMatch(/programmatic|no\s+LLM/i);
    });

    it("should mention Windows platform limitations", () => {
      const content = getContent();
      expect(content).toMatch(/[Ww]indows/);
    });
  });

  // AC3: ShellCheck installation
  describe("AC3: ShellCheck Installation", () => {
    it("should have a ShellCheck section", () => {
      const content = getContent();
      expect(content).toMatch(/## (?:Installing )?ShellCheck/i);
    });

    it("should document macOS installation with brew", () => {
      const content = getContent();
      expect(content).toMatch(/brew install shellcheck/);
    });

    it("should document Linux installation with apt", () => {
      const content = getContent();
      expect(content).toMatch(/apt-get install shellcheck|apt install shellcheck/);
    });

    it("should include PATH verification step", () => {
      const content = getContent();
      expect(content).toMatch(/shellcheck --version/);
    });
  });

  // AC4: Release process
  describe("AC4: Release Process", () => {
    it("should have a Release Process section", () => {
      const content = getContent();
      expect(content).toMatch(/## Release Process/i);
    });

    it("should document version bump files", () => {
      const content = getContent();
      expect(content).toMatch(/package\.json/);
      expect(content).toMatch(/gaia-install\.sh/);
      expect(content).toMatch(/global\.yaml/);
      expect(content).toMatch(/manifest\.yaml/);
      expect(content).toMatch(/CLAUDE\.md/);
      expect(content).toMatch(/README\.md/);
    });

    it("should document npm publish with --provenance", () => {
      const content = getContent();
      expect(content).toMatch(/npm publish.*--provenance|--provenance/);
    });

    it("should document git tagging with v{x.x.x} format", () => {
      const content = getContent();
      expect(content).toMatch(/git tag/);
      expect(content).toMatch(/v\{?[\dx.]+\}?|v\d+\.\d+\.\d+/i);
    });

    it("should mention Tier 2 staleness check", () => {
      const content = getContent();
      expect(content).toMatch(/[Tt]ier\s*2/);
      expect(content).toMatch(/staleness|stale/i);
    });
  });

  // AC5: Branch protection
  describe("AC5: Branch Protection", () => {
    it("should have a Branch Protection section", () => {
      const content = getContent();
      expect(content).toMatch(/## Branch Protection/i);
    });

    it("should document PR review requirement", () => {
      const content = getContent();
      expect(content).toMatch(/pull request|PR/i);
      expect(content).toMatch(/review/i);
    });

    it("should document CI must pass requirement", () => {
      const content = getContent();
      expect(content).toMatch(/CI.*pass|status.*check/i);
    });

    it("should document no direct push to main", () => {
      const content = getContent();
      expect(content).toMatch(/direct.*push|push.*blocked/i);
    });
  });

  // AC6: Pre-commit hooks placeholder
  describe("AC6: Pre-Commit Hooks Placeholder", () => {
    it("should have a Pre-Commit Hooks section", () => {
      const content = getContent();
      expect(content).toMatch(/## Pre-[Cc]ommit Hooks/i);
    });

    it("should mention hooks are pending E5-S4", () => {
      const content = getContent();
      expect(content).toMatch(/E5-S4/);
    });

    it("should mention hooks are not yet active", () => {
      const content = getContent();
      expect(content).toMatch(/not yet active|pending|will be activated|future/i);
    });

    it("should frame hooks as a security benefit", () => {
      const content = getContent();
      expect(content).toMatch(/secret|credential|security|accidental/i);
    });
  });
});
