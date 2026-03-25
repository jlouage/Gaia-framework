const path = require("path");
const fs = require("fs");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const ROOT = path.resolve(__dirname, "../../..");

describe("Prettier Configuration (E5-S2)", () => {
  describe("AC1: .prettierrc.json config file exists with correct settings", () => {
    it("should have .prettierrc.json at project root", () => {
      const configPath = path.join(ROOT, ".prettierrc.json");
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it("should be valid JSON", () => {
      const configPath = path.join(ROOT, ".prettierrc.json");
      const content = fs.readFileSync(configPath, "utf8");
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it("should specify double quotes (matching codebase style)", () => {
      const configPath = path.join(ROOT, ".prettierrc.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(config.singleQuote).toBe(false);
    });

    it("should specify semicolons (matching codebase style)", () => {
      const configPath = path.join(ROOT, ".prettierrc.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(config.semi).toBe(true);
    });

    it("should specify 2-space indentation (matching codebase style)", () => {
      const configPath = path.join(ROOT, ".prettierrc.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(config.tabWidth).toBe(2);
    });

    it("should specify trailing commas (matching codebase style)", () => {
      const configPath = path.join(ROOT, ".prettierrc.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(config.trailingComma).toBe("es5");
    });

    it("should specify a reasonable print width", () => {
      const configPath = path.join(ROOT, ".prettierrc.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(config.printWidth).toBeGreaterThanOrEqual(80);
      expect(config.printWidth).toBeLessThanOrEqual(120);
    });
  });

  describe("AC2: format:check npm script", () => {
    it("should have a format:check script in package.json", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.scripts).toHaveProperty("format:check");
    });

    it("should run prettier --check against bin and test JS files", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      const script = pkg.scripts["format:check"];
      expect(script).toContain("prettier");
      expect(script).toContain("--check");
      expect(script).toMatch(/bin/);
      expect(script).toMatch(/test/);
    });

    it("should have a format (write) script in package.json", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.scripts).toHaveProperty("format");
      expect(pkg.scripts.format).toContain("prettier");
      expect(pkg.scripts.format).toContain("--write");
    });
  });

  describe("AC3: CI FORMAT step", () => {
    it("should have npm run format:check in CI workflow", () => {
      const ciPath = path.join(ROOT, ".github/workflows/ci.yml");
      expect(fs.existsSync(ciPath)).toBe(true);
      const ciContent = fs.readFileSync(ciPath, "utf8");
      expect(ciContent).toContain("npm run format:check");
    });

    it("should NOT have continue-on-error on the Prettier step", () => {
      const ciPath = path.join(ROOT, ".github/workflows/ci.yml");
      const ciContent = fs.readFileSync(ciPath, "utf8");
      // Find the Prettier step and ensure it does not have continue-on-error
      const lines = ciContent.split("\n");
      let inPrettierStep = false;
      let prettierStepLines = [];
      for (const line of lines) {
        if (line.includes("Prettier") && line.includes("name:")) {
          inPrettierStep = true;
          prettierStepLines = [];
        } else if (inPrettierStep && line.match(/^\s+-\s+name:/)) {
          break; // next step
        }
        if (inPrettierStep) {
          prettierStepLines.push(line);
        }
      }
      const prettierBlock = prettierStepLines.join("\n");
      expect(prettierBlock).not.toContain("continue-on-error");
    });
  });

  describe("AC4: zero formatting diffs on baseline", () => {
    it("should report zero formatting diffs when running format:check", () => {
      const { execSync } = require("child_process");
      expect(() => {
        execSync('npx prettier --check "bin/**/*.js" "test/**/*.js"', {
          cwd: ROOT,
          stdio: "pipe",
        });
      }).not.toThrow();
    });
  });

  describe("AC5: .prettierrc.json excluded from published package", () => {
    it("should not include .prettierrc.json in npm pack output", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      // The files whitelist in package.json should only include bin/ and gaia-install.sh
      // .prettierrc.json is automatically excluded
      expect(pkg.files).toBeDefined();
      expect(pkg.files).not.toContain(".prettierrc.json");
      // Verify the whitelist approach — only bin/ and gaia-install.sh
      const hasOnlyExpected = pkg.files.every((f) => f === "bin/" || f === "gaia-install.sh");
      expect(hasOnlyExpected).toBe(true);
    });
  });

  describe("AC6: prettier in devDependencies only", () => {
    it("should have prettier in devDependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.devDependencies).toHaveProperty("prettier");
    });

    it("should NOT have prettier in dependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      const deps = pkg.dependencies || {};
      expect(deps).not.toHaveProperty("prettier");
    });
  });

  describe("ESLint interop: eslint-config-prettier", () => {
    it("should have eslint-config-prettier in devDependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.devDependencies).toHaveProperty("eslint-config-prettier");
    });

    it("should include eslint-config-prettier in ESLint config", () => {
      const configPath = path.join(ROOT, "eslint.config.js");
      const content = fs.readFileSync(configPath, "utf8");
      expect(content).toContain("eslint-config-prettier");
    });
  });

  describe(".prettierignore file", () => {
    it("should have .prettierignore at project root", () => {
      const ignorePath = path.join(ROOT, ".prettierignore");
      expect(fs.existsSync(ignorePath)).toBe(true);
    });

    it("should exclude node_modules", () => {
      const ignorePath = path.join(ROOT, ".prettierignore");
      const content = fs.readFileSync(ignorePath, "utf8");
      expect(content).toContain("node_modules");
    });

    it("should exclude coverage directory", () => {
      const ignorePath = path.join(ROOT, ".prettierignore");
      const content = fs.readFileSync(ignorePath, "utf8");
      expect(content).toContain("coverage");
    });
  });
});
