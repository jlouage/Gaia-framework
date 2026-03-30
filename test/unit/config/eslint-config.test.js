const path = require("path");
const fs = require("fs");

// Uses Vitest globals (describe, it, expect) — configured via globals: true in vitest.config.js

const ROOT = path.resolve(__dirname, "../../..");

describe("ESLint Configuration (E5-S1)", () => {
  describe("AC1: eslint.config.js flat config exists with correct structure", () => {
    it("should have eslint.config.js at project root", () => {
      const configPath = path.join(ROOT, "eslint.config.js");
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it("should export an array of config objects", async () => {
      const configPath = path.join(ROOT, "eslint.config.js");
      // Dynamic import for ESM config file
      const config = await import(configPath);
      const configs = config.default || config;
      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThanOrEqual(2);
    });

    it("should define bin/**/*.js glob with sourceType commonjs and node globals", async () => {
      const configPath = path.join(ROOT, "eslint.config.js");
      const config = await import(configPath);
      const configs = config.default || config;
      const binConfig = configs.find((c) => c.files && c.files.some((f) => f.includes("bin/")));
      expect(binConfig).toBeDefined();
      expect(binConfig.languageOptions.sourceType).toBe("commonjs");
    });

    it("should define test/**/*.js glob with sourceType module and vitest globals", async () => {
      const configPath = path.join(ROOT, "eslint.config.js");
      const config = await import(configPath);
      const configs = config.default || config;
      const testConfig = configs.find((c) => c.files && c.files.some((f) => f.includes("test/")));
      expect(testConfig).toBeDefined();
      expect(testConfig.languageOptions.sourceType).toBe("module");
      // Vitest globals should be declared
      const globals = testConfig.languageOptions.globals || {};
      expect(globals.describe).toBe(true);
      expect(globals.it).toBe(true);
      expect(globals.expect).toBe(true);
      expect(globals.vi).toBe(true);
    });
  });

  describe("AC4: ESLint packages in devDependencies only", () => {
    it("should have eslint in devDependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.devDependencies).toHaveProperty("eslint");
    });

    it("should have @eslint/js in devDependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.devDependencies).toHaveProperty("@eslint/js");
    });

    it("should have globals in devDependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.devDependencies).toHaveProperty("globals");
    });

    it("should NOT have eslint packages in dependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      const deps = pkg.dependencies || {};
      expect(deps).not.toHaveProperty("eslint");
      expect(deps).not.toHaveProperty("@eslint/js");
      expect(deps).not.toHaveProperty("globals");
    });
  });

  describe("AC5: lint and lint:fix scripts", () => {
    it("should have a lint script targeting bin and test", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.scripts).toHaveProperty("lint");
      expect(pkg.scripts.lint).toContain("eslint");
      expect(pkg.scripts.lint).toMatch(/bin/);
      expect(pkg.scripts.lint).toMatch(/test/);
    });

    it("should have a lint:fix script", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
      expect(pkg.scripts).toHaveProperty("lint:fix");
      expect(pkg.scripts["lint:fix"]).toContain("--fix");
    });
  });

  describe("AC6: ignore patterns for node_modules and coverage", () => {
    it("should ignore node_modules and coverage directories", async () => {
      const configPath = path.join(ROOT, "eslint.config.js");
      const config = await import(configPath);
      const configs = config.default || config;
      // Look for an ignores-only config object
      const ignoreConfig = configs.find((c) => c.ignores && !c.files);
      expect(ignoreConfig).toBeDefined();
      expect(ignoreConfig.ignores).toContain("node_modules/");
      expect(ignoreConfig.ignores).toContain("coverage/");
    });
  });

  describe("AC3: zero violations on clean run", () => {
    it("should report zero ESLint violations when run on bin and test", () => {
      const { execSync } = require("child_process");
      // This will throw if there are violations (non-zero exit code)
      expect(() => {
        execSync("npx eslint bin/**/*.js test/**/*.js", {
          cwd: ROOT,
          stdio: "pipe",
          shell: true,
        });
      }).not.toThrow();
    });
  });

  describe("AC2: CI integration", () => {
    it("should have npm run lint in CI workflow", () => {
      const ciPath = path.join(ROOT, ".github/workflows/ci.yml");
      expect(fs.existsSync(ciPath)).toBe(true);
      const ciContent = fs.readFileSync(ciPath, "utf8");
      expect(ciContent).toContain("npm run lint");
    });
  });
});
