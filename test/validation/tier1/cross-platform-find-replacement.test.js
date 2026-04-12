import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

// ─── E6-S10: Verify Unix find commands replaced with walkFiles() ─────

const TARGET_FILES = [
  {
    path: join(PROJECT_ROOT, "test", "validation", "tier1", "slash-commands.test.js"),
    label: "slash-commands.test.js",
    expectedWalkFilesImport: "../helpers/fs-walk.js",
    functions: ["findCommandFiles", "buildAgentCommandMap"],
  },
  {
    path: join(PROJECT_ROOT, "test", "validators", "template-validator.js"),
    label: "template-validator.js",
    expectedWalkFilesImport: "../validation/helpers/fs-walk.js",
    functions: ["discoverTemplates", "scanReferences"],
  },
];

describe("E6-S10: Cross-Platform find Replacement Verification", () => {
  describe.each(TARGET_FILES)("$label", ({ path, expectedWalkFilesImport, functions }) => {
    const content = readFileSync(path, "utf8");

    // AC1/AC2: walkFiles() is imported and used instead of execSync("find ...")
    it("should import walkFiles from fs-walk.js", () => {
      const importPattern = new RegExp(
        `import\\s*\\{[^}]*walkFiles[^}]*\\}\\s*from\\s*["']${expectedWalkFilesImport.replace(/\//g, "\\/")}["']`
      );
      expect(content).toMatch(importPattern);
    });

    it("should NOT import execSync from child_process", () => {
      // Must not contain execSync import (any form)
      expect(content).not.toMatch(/import\s*\{[^}]*execSync[^}]*\}\s*from\s*["']child_process["']/);
      expect(content).not.toMatch(/require\s*\(\s*["']child_process["']\s*\)/);
    });

    it("should NOT contain any execSync('find') or execSync(\"find\") calls", () => {
      // Must not contain execSync("find ...") or execSync('find ...') invocations
      expect(content).not.toMatch(/execSync\s*\(\s*["'`]find\s/);
    });

    it("should use walkFiles() in file-discovery functions", () => {
      // Verify walkFiles is actually called (not just imported)
      expect(content).toMatch(/walkFiles\s*\(/);
    });

    // Verify each expected function exists and uses walkFiles
    for (const fn of functions) {
      it(`should have function ${fn} that uses walkFiles()`, () => {
        // Extract the function body (simplified: find function declaration and check walkFiles within next ~20 lines)
        const fnPattern = new RegExp(
          `(?:function\\s+${fn}|(?:const|let)\\s+${fn}\\s*=)[\\s\\S]*?walkFiles\\s*\\(`
        );
        expect(content).toMatch(fnPattern);
      });
    }
  });

  // AC3: Full test suite passes — verified by running npm test (integration check)
  // AC4: Windows CI — verified on CI runners (best-effort per ADR-004)
});
