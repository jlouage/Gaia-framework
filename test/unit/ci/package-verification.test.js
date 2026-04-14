const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

/** Read a file relative to project root */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

describe("E4-S3: Package Content Verification", () => {
  // Shared constants — target whitelist per architecture Section 10.6
  // lib/ added in E3-S11 to ship the extracted copy_gaia_files library (lib/copy-lib.sh)
  const TARGET_WHITELIST = [
    "bin/",
    "lib/",
    "src/",
    "gaia-install.sh",
    "_gaia/",
    ".claude/",
    "CLAUDE.md",
    "README.md",
    "LICENSE",
  ];

  // Full exclusion matrix per architecture Section 10.6 and E4-S3 story
  const EXCLUDED_PATTERNS = [
    { pattern: "test/", description: "test directory" },
    { pattern: ".github/", description: ".github directory" },
    { pattern: ".eslintrc", description: ".eslintrc config" },
    { pattern: ".prettierrc", description: ".prettierrc config" },
    { pattern: ".editorconfig", description: ".editorconfig" },
    { pattern: ".husky/", description: ".husky directory" },
    { pattern: "docs/", description: "docs directory" },
  ];

  // --- Task 0: package.json files field ---

  describe("package.json files field (AC2 pre-condition)", () => {
    let packageJson;

    beforeAll(() => {
      packageJson = JSON.parse(readProjectFile("package.json"));
    });

    it("should have a files field defined", () => {
      expect(packageJson.files).toBeDefined();
      expect(Array.isArray(packageJson.files)).toBe(true);
    });

    it("should include all target whitelist entries per architecture Section 10.6", () => {
      for (const entry of TARGET_WHITELIST) {
        expect(packageJson.files).toContain(entry);
      }
    });

    it("should not include test/, docs/, or .github/ in the files field", () => {
      for (const excluded of ["test/", "docs/", ".github/"]) {
        expect(packageJson.files).not.toContain(excluded);
      }
    });
  });

  // --- Task 1: npm pack --json verification (AC1, AC2, AC3, AC4) ---
  // Uses structured JSON output instead of text parsing to avoid
  // continuation-line confusion from long paths (E5-S8 AC3)

  describe("npm pack --json output (AC1, AC2, AC3, AC4)", () => {
    let packEntries;
    let packFiles;

    beforeAll(() => {
      const rawOutput = execSync("npm pack --json", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, HUSKY: "0" },
        timeout: 60000,
      });
      // npm pack --json may include non-JSON lines (e.g., Husky messages) before the array
      const jsonStart = rawOutput.indexOf("[");
      const jsonOutput = jsonStart >= 0 ? rawOutput.slice(jsonStart) : rawOutput;
      packEntries = JSON.parse(jsonOutput);
      // npm pack --json returns an array; extract the files list from the first entry
      packFiles = packEntries[0].files.map((f) => f.path);
    }, 60000);

    it("AC1: should run npm pack --json and produce structured output", () => {
      expect(packEntries).toBeTruthy();
      expect(Array.isArray(packEntries)).toBe(true);
      expect(packEntries.length).toBeGreaterThan(0);
      expect(packEntries[0].files).toBeDefined();
      expect(packFiles.length).toBeGreaterThan(0);
    });

    it("AC2: should only contain files matching the whitelist", () => {
      const allowedPrefixes = [...TARGET_WHITELIST, "package.json"];
      for (const filePath of packFiles) {
        const matchesWhitelist = allowedPrefixes.some((prefix) => filePath.startsWith(prefix));
        expect(matchesWhitelist, `Unexpected file in pack output: ${filePath}`).toBe(true);
      }
    });

    for (const { pattern, description } of EXCLUDED_PATTERNS) {
      it(`AC3: should NOT contain ${description} (${pattern})`, () => {
        const violations = packFiles.filter((f) => f.includes(pattern));
        expect(violations).toEqual([]);
      });
    }

    it("AC4: should produce clear error messages for violations (verification script logic)", () => {
      const ciYml = readProjectFile(".github/workflows/ci.yml");

      // CI must check for the full exclusion matrix
      for (const { pattern } of EXCLUDED_PATTERNS) {
        expect(ciYml).toContain(pattern);
      }

      // Must produce clear error messages (AC4)
      expect(ciYml).toMatch(/::error::/);
    });
  });

  // --- Task 2: .npmignore guard (AC5) ---

  describe(".npmignore guard (AC5)", () => {
    it("AC5: should NOT have a .npmignore file in the repository root", () => {
      expect(fs.existsSync(path.join(PROJECT_ROOT, ".npmignore"))).toBe(false);
    });

    it("AC5: CI workflow should include .npmignore guard check", () => {
      const ciYml = readProjectFile(".github/workflows/ci.yml");
      expect(ciYml).toMatch(/\.npmignore/);
      expect(ciYml).toMatch(/files.*field|package\.json.*files|Remove.*\.npmignore/i);
    });
  });

  // --- Task 3: Integration with E4-S1 CI workflow (AC1, AC3) ---

  describe("CI integration (AC1, AC3)", () => {
    let ciYml;

    beforeAll(() => {
      ciYml = readProjectFile(".github/workflows/ci.yml");
    });

    it("AC1: package validation step should exist in CI workflow", () => {
      expect(ciYml).toMatch(/package:/);
      expect(ciYml).toMatch(/npm pack --dry-run/);
    });

    it("AC3: CI should exit with code 1 on violations", () => {
      expect(ciYml).toMatch(/exit 1/);
    });

    it("package validation should run after test stage (needs: test)", () => {
      expect(ciYml).toMatch(/needs:.*test/);
    });
  });
});
