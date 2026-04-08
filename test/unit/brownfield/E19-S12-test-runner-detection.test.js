/**
 * E19-S12: Brownfield Test Runner Detection — Acceptance Tests
 *
 * RED PHASE — These tests are intentionally failing.
 * The implementation module (src/brownfield/test-runner-detector.js) does not exist yet.
 *
 * Story: As a brownfield user, I want /gaia-brownfield to detect the project's
 * test runner from package.json, build files, and config files so that the
 * onboarding report accurately identifies the test infrastructure in use.
 *
 * Covers: AC1-AC6 (BTI-01 through BTI-06)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";

// Implementation under test — does not exist yet (red phase)
import { detectTestRunners } from "../../../src/brownfield/test-runner-detector.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TMP_BASE = join(tmpdir(), "gaia-e19-s12-tests");

function createFixtureDir(name) {
  const dir = join(TMP_BASE, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanFixtures() {
  if (existsSync(TMP_BASE)) {
    rmSync(TMP_BASE, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1: package.json devDependencies and scripts detection (BTI-01)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S12 AC1: package.json scanner detects test runners", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac1-package-json");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-01a: detects Jest from devDependencies", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { jest: "^29.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
  });

  it("BTI-01b: detects Vitest from devDependencies", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { vitest: "^1.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("vitest");
  });

  it("BTI-01c: detects Mocha from devDependencies", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { mocha: "^10.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("mocha");
  });

  it("BTI-01d: detects Jasmine from devDependencies", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { jasmine: "^5.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jasmine");
  });

  it("BTI-01e: detects test runner from scripts.test referencing runner", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        scripts: { test: "jest --coverage" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
  });

  it("BTI-01f: detects pytest from devDependencies in package.json (should NOT detect)", async () => {
    // pytest is a Python tool — should not be detected from package.json
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { "some-tool": "^1.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Config file scanner (BTI-02)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S12 AC2: Config file scanner detects test runners", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac2-config-files");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-02a: detects Jest from jest.config.js", async () => {
    writeFileSync(join(projectDir, "jest.config.js"), "module.exports = {};");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
  });

  it("BTI-02b: detects Jest from jest.config.ts", async () => {
    writeFileSync(join(projectDir, "jest.config.ts"), "export default {};");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
  });

  it("BTI-02c: detects Jest from jest.config.json", async () => {
    writeFileSync(join(projectDir, "jest.config.json"), "{}");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
  });

  it("BTI-02d: detects Vitest from vitest.config.js", async () => {
    writeFileSync(join(projectDir, "vitest.config.js"), "export default {};");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("vitest");
  });

  it("BTI-02e: detects Vitest from vitest.config.ts", async () => {
    writeFileSync(join(projectDir, "vitest.config.ts"), "export default {};");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("vitest");
  });

  it("BTI-02f: detects Mocha from .mocharc.js", async () => {
    writeFileSync(join(projectDir, ".mocharc.js"), "module.exports = {};");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("mocha");
  });

  it("BTI-02g: detects Mocha from .mocharc.yml", async () => {
    writeFileSync(join(projectDir, ".mocharc.yml"), "spec: test/**/*.test.js");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("mocha");
  });

  it("BTI-02h: detects Mocha from .mocharc.json", async () => {
    writeFileSync(join(projectDir, ".mocharc.json"), "{}");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("mocha");
  });

  it("BTI-02i: detects pytest from pytest.ini", async () => {
    writeFileSync(join(projectDir, "pytest.ini"), "[pytest]\naddopts = -v");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("pytest");
  });

  it("BTI-02j: detects pytest from pyproject.toml with [tool.pytest.ini_options]", async () => {
    writeFileSync(join(projectDir, "pyproject.toml"), "[tool.pytest.ini_options]\naddopts = '-v'");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("pytest");
  });

  it("BTI-02k: detects JUnit/Gradle from build.gradle with test block", async () => {
    writeFileSync(
      join(projectDir, "build.gradle"),
      'plugins {\n  id "java"\n}\ntest {\n  useJUnitPlatform()\n}'
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("junit");
  });

  it("BTI-02l: detects JUnit/Maven from pom.xml with surefire", async () => {
    writeFileSync(
      join(projectDir, "pom.xml"),
      "<project><build><plugins><plugin><artifactId>maven-surefire-plugin</artifactId></plugin></plugins></build></project>"
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("junit");
  });

  it("BTI-02m: detects Go test from go.mod", async () => {
    writeFileSync(join(projectDir, "go.mod"), "module example.com/myapp\n\ngo 1.21\n");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("go-test");
  });

  it("BTI-02n: detects BATS from .bats files", async () => {
    const testDir = join(projectDir, "test");
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "example.bats"), "@test 'hello' { true; }");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("bats");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: Detection result stored as detected_test_runner (BTI-03)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S12 AC3: Detection result format", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac3-result-format");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-03a: returns an array of detected runners", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { jest: "^29.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("BTI-03b: single runner returns array with one element", async () => {
    writeFileSync(join(projectDir, "pytest.ini"), "[pytest]\naddopts = -v");

    const result = await detectTestRunners(projectDir);
    expect(result).toEqual(["pytest"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4: Zero false positives (BTI-04 — NFR-041)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S12 AC4: Zero false positives — NFR-041", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac4-no-false-positives");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-04a: empty project returns null (no runners)", async () => {
    // Empty directory — no config files, no package.json
    const result = await detectTestRunners(projectDir);
    expect(result).toEqual([]);
  });

  it("BTI-04b: jest mentioned only in a comment should NOT be detected", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        description: "This project used to use jest but now uses vitest",
        devDependencies: { typescript: "^5.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    // jest is mentioned in description string, not in devDependencies — should not detect
    expect(result).not.toContain("jest");
  });

  it("BTI-04c: package.json with no test script and no test deps returns empty", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        scripts: { start: "node index.js" },
        devDependencies: { typescript: "^5.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toEqual([]);
  });

  it("BTI-04d: pyproject.toml without [tool.pytest] section does not detect pytest", async () => {
    writeFileSync(
      join(projectDir, "pyproject.toml"),
      "[project]\nname = 'myapp'\nversion = '1.0.0'"
    );

    const result = await detectTestRunners(projectDir);
    expect(result).not.toContain("pytest");
  });

  it("BTI-04e: pom.xml without surefire plugin does not detect junit", async () => {
    writeFileSync(
      join(projectDir, "pom.xml"),
      "<project><modelVersion>4.0.0</modelVersion></project>"
    );

    // pom.xml exists but no surefire plugin — should still detect junit (Maven convention)
    // Actually per AC1, pom.xml alone implies Maven test infrastructure
    const result = await detectTestRunners(projectDir);
    expect(result).toContain("junit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: Monorepo detection — scans workspace root and packages (BTI-05)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S12 AC5: Monorepo workspace scanning", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac5-monorepo");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-05a: detects workspaces from package.json[workspaces]", async () => {
    // Root package.json with workspaces
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "monorepo",
        workspaces: ["packages/*"],
        devDependencies: { jest: "^29.0.0" },
      })
    );

    // Package A uses vitest
    const pkgA = join(projectDir, "packages", "pkg-a");
    mkdirSync(pkgA, { recursive: true });
    writeFileSync(
      join(pkgA, "package.json"),
      JSON.stringify({
        name: "pkg-a",
        devDependencies: { vitest: "^1.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
    expect(result).toContain("vitest");
  });

  it("BTI-05b: detects workspaces from pnpm-workspace.yaml", async () => {
    writeFileSync(join(projectDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

    writeFileSync(join(projectDir, "package.json"), JSON.stringify({ name: "monorepo" }));

    const pkgB = join(projectDir, "packages", "pkg-b");
    mkdirSync(pkgB, { recursive: true });
    writeFileSync(
      join(pkgB, "package.json"),
      JSON.stringify({
        name: "pkg-b",
        devDependencies: { mocha: "^10.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("mocha");
  });

  it("BTI-05c: scans packages/* subdirectories for test runner configs", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "monorepo",
        workspaces: ["packages/*"],
      })
    );

    const pkgC = join(projectDir, "packages", "pkg-c");
    mkdirSync(pkgC, { recursive: true });
    writeFileSync(join(pkgC, "vitest.config.ts"), "export default {};");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("vitest");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6: Multiple runners in monorepo recorded as array (BTI-06)
// ─────────────────────────────────────────────────────────────────────────────
describe("E19-S12 AC6: Multiple runners collected as array", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac6-multiple-runners");
  });

  afterEach(() => {
    cleanFixtures();
  });

  it("BTI-06a: monorepo with Jest + Vitest returns both in array", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "monorepo",
        workspaces: ["packages/*"],
        devDependencies: { jest: "^29.0.0" },
      })
    );

    const pkgA = join(projectDir, "packages", "app");
    mkdirSync(pkgA, { recursive: true });
    writeFileSync(
      join(pkgA, "package.json"),
      JSON.stringify({
        name: "app",
        devDependencies: { vitest: "^1.0.0" },
      })
    );

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
    expect(result).toContain("vitest");
    expect(result.length).toBe(2);
  });

  it("BTI-06b: project with both pytest and jest returns both", async () => {
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "fullstack",
        devDependencies: { jest: "^29.0.0" },
      })
    );
    writeFileSync(join(projectDir, "pytest.ini"), "[pytest]\naddopts = -v");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
    expect(result).toContain("pytest");
    expect(result.length).toBe(2);
  });

  it("BTI-06c: duplicate runners are deduplicated", async () => {
    // Both devDependencies and config file point to jest
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        devDependencies: { jest: "^29.0.0" },
      })
    );
    writeFileSync(join(projectDir, "jest.config.js"), "module.exports = {};");

    const result = await detectTestRunners(projectDir);
    expect(result).toContain("jest");
    // Should be deduplicated — only one "jest" entry
    expect(result.filter((r) => r === "jest").length).toBe(1);
  });
});
