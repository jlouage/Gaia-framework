/**
 * E19-S16: Auto-Generate test-environment.yaml — Unit Tests
 *
 * Covers the generator module that aggregates brownfield detection
 * results (E19-S12–S15) into a test-environment.yaml compatible with
 * the E17-S7 schema.
 *
 * Traces to: FR-235, ADR-030 §10.22
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";

import {
  generateTestEnvironmentYaml,
  serializeTestEnvironmentYaml,
  mergeTestEnvironmentYaml,
  writeTestEnvironmentYaml,
  hasDetectedInfrastructure,
} from "../../../src/brownfield/test-environment-generator.js";

import { validateTestEnvironment } from "../../../_gaia/core/validators/test-environment-validator.js";

const TMP_BASE = join(tmpdir(), "gaia-e19-s16-tests");

function cleanTmp() {
  if (existsSync(TMP_BASE)) {
    rmSync(TMP_BASE, { recursive: true, force: true });
  }
}

function makeTmpDir(name) {
  const dir = join(TMP_BASE, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─────────────────────────────────────────────────────────────────────────
// AC1/AC2: Aggregation + schema fields
// ─────────────────────────────────────────────────────────────────────────
describe("E19-S16 AC1/AC2: generateTestEnvironmentYaml aggregates all four detectors", () => {
  it("includes all 6 story-required metadata fields", () => {
    const doc = generateTestEnvironmentYaml({
      testRunners: ["jest"],
      ciTestExecution: { ci_test_execution: "github-actions", test_commands: ["npm test"] },
      dockerTestConfig: {
        compose_file: "docker-compose.test.yml",
        service_name: "test",
        test_command: "npm test",
      },
      browserMatrix: {
        browser_matrix: [{ name: "chromium", config_source: "playwright.config.ts" }],
        build_target_only: null,
      },
      generatedDate: "2026-04-09",
    });

    expect(doc).toHaveProperty("test_runner", ["jest"]);
    expect(doc).toHaveProperty("ci_provider", "github-actions");
    expect(doc.docker_test_config).toMatchObject({
      compose_file: "docker-compose.test.yml",
      service_name: "test",
    });
    expect(doc.browser_matrix).toEqual([
      { name: "chromium", config_source: "playwright.config.ts" },
    ]);
    expect(doc).toHaveProperty("generated_by", "brownfield");
    expect(doc).toHaveProperty("generated_date", "2026-04-09");
  });

  it("emits null fields when a detector returned nothing", () => {
    const doc = generateTestEnvironmentYaml({
      testRunners: [],
      ciTestExecution: { ci_test_execution: null, test_commands: [] },
      dockerTestConfig: null,
      browserMatrix: null,
    });

    expect(doc.test_runner).toBeNull();
    expect(doc.ci_provider).toBeNull();
    expect(doc.docker_test_config).toBeNull();
    expect(doc.browser_matrix).toBeNull();
    expect(doc.generated_by).toBe("brownfield");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// AC5: E17-S7 schema compatibility
// ─────────────────────────────────────────────────────────────────────────
describe("E19-S16 AC5: generated file passes E17-S7 schema validation", () => {
  it("serialized output validates cleanly with no warnings", () => {
    const doc = generateTestEnvironmentYaml({
      testRunners: ["jest"],
      ciTestExecution: { ci_test_execution: "github-actions", test_commands: ["npm test"] },
      dockerTestConfig: null,
      browserMatrix: null,
      generatedDate: "2026-04-09",
    });
    const yaml = serializeTestEnvironmentYaml(doc);

    const result = validateTestEnvironment(yaml);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("stub (no detections) still produces a schema-valid document", () => {
    const doc = generateTestEnvironmentYaml({
      testRunners: null,
      ciTestExecution: null,
      dockerTestConfig: null,
      browserMatrix: null,
    });
    const yaml = serializeTestEnvironmentYaml(doc);

    const result = validateTestEnvironment(yaml);
    expect(result.valid).toBe(true);
  });

  it("version field is integer 2 (E17-S7 v2 schema)", () => {
    const doc = generateTestEnvironmentYaml({});
    expect(doc.version).toBe(2);
  });

  it("runners list has at least one entry with required fields", () => {
    const doc = generateTestEnvironmentYaml({ testRunners: ["vitest", "pytest"] });
    expect(Array.isArray(doc.runners)).toBe(true);
    expect(doc.runners.length).toBe(2);
    for (const runner of doc.runners) {
      expect(runner).toHaveProperty("name");
      expect(runner).toHaveProperty("command");
      expect(runner).toHaveProperty("tier");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// AC3/AC4: merge logic — HIGH RISK, critical path
// ─────────────────────────────────────────────────────────────────────────
describe("E19-S16 AC3/AC4: mergeTestEnvironmentYaml preserves user fields", () => {
  const detectedDoc = generateTestEnvironmentYaml({
    testRunners: ["jest"],
    ciTestExecution: { ci_test_execution: "github-actions", test_commands: ["npm test"] },
    dockerTestConfig: {
      compose_file: "docker-compose.test.yml",
      service_name: "test",
      test_command: "npm test",
    },
    browserMatrix: null,
    generatedDate: "2026-04-09",
  });

  it("preserves every non-null user field (never overwrites)", () => {
    const existing = [
      "version: 2",
      "runners:",
      "  - name: my-unit",
      "    command: custom-runner",
      "    tier: 1",
      "ci_provider: custom-ci",
      "test_runner: custom-jest",
      "",
    ].join("\n");

    const merged = mergeTestEnvironmentYaml(existing, detectedDoc);

    // User values untouched
    expect(merged).toContain("ci_provider: custom-ci");
    expect(merged).toContain("test_runner: custom-jest");
    expect(merged).toContain("my-unit");
    // And must NOT add a duplicate detected ci_provider line
    expect(merged.match(/^ci_provider:/gm)?.length).toBe(1);
    expect(merged.match(/^test_runner:/gm)?.length).toBe(1);
  });

  it("fills null fields with detected values", () => {
    const existing = [
      "version: 2",
      "runners:",
      "  - name: unit",
      "    command: npm test",
      "    tier: 1",
      "ci_provider: null",
      "docker_test_config: null",
      "",
    ].join("\n");

    const merged = mergeTestEnvironmentYaml(existing, detectedDoc);

    // Original user runners preserved
    expect(merged).toContain("name: unit");
    // Detected fields appended
    expect(merged).toContain("github-actions");
    expect(merged).toContain("docker-compose.test.yml");
    // Merge marker present
    expect(merged).toContain("Auto-merged by /gaia-brownfield");
  });

  it("is a no-op when the user has already set every field", () => {
    const existing = [
      "version: 2",
      "runners:",
      "  - name: unit",
      "    command: npm test",
      "    tier: 1",
      "test_runner: jest",
      "ci_provider: circleci",
      "docker_test_config: custom",
      "browser_matrix: chromium",
      "generated_by: user",
      "generated_date: 2020-01-01",
      "",
    ].join("\n");

    const merged = mergeTestEnvironmentYaml(existing, detectedDoc);
    expect(merged).toBe(existing);
  });

  it("treats missing file content as a fresh write", () => {
    const merged = mergeTestEnvironmentYaml("", detectedDoc);
    expect(merged).toContain("generated_by: brownfield");
    expect(merged).toContain("version: 2");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// writeTestEnvironmentYaml — end-to-end mode behavior
// ─────────────────────────────────────────────────────────────────────────
describe("E19-S16: writeTestEnvironmentYaml honors conflict mode", () => {
  beforeEach(() => cleanTmp());
  afterEach(() => cleanTmp());

  it("creates the file when it does not exist", () => {
    const dir = makeTmpDir("create");
    const path = join(dir, "test-environment.yaml");
    const doc = generateTestEnvironmentYaml({ testRunners: ["jest"] });

    const result = writeTestEnvironmentYaml(path, doc, "merge");

    expect(result.action).toBe("created");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf8");
    expect(content).toContain("jest");
  });

  it("merges into an existing file without overwriting user fields", () => {
    const dir = makeTmpDir("merge");
    const path = join(dir, "test-environment.yaml");
    writeFileSync(
      path,
      [
        "version: 2",
        "runners:",
        "  - name: unit",
        "    command: npm test",
        "    tier: 1",
        "ci_provider: null",
        "",
      ].join("\n"),
      "utf8"
    );
    const doc = generateTestEnvironmentYaml({
      testRunners: ["jest"],
      ciTestExecution: { ci_test_execution: "github-actions", test_commands: [] },
    });

    const result = writeTestEnvironmentYaml(path, doc, "merge");

    expect(result.action).toBe("merged");
    const content = readFileSync(path, "utf8");
    expect(content).toContain("name: unit"); // user entry preserved
    expect(content).toContain("github-actions"); // detected ci filled in
  });

  it("skip leaves the file untouched", () => {
    const dir = makeTmpDir("skip");
    const path = join(dir, "test-environment.yaml");
    const original = "version: 2\nrunners: []\n";
    writeFileSync(path, original, "utf8");
    const doc = generateTestEnvironmentYaml({ testRunners: ["jest"] });

    const result = writeTestEnvironmentYaml(path, doc, "skip");

    expect(result.action).toBe("skipped");
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("overwrite replaces the entire file", () => {
    const dir = makeTmpDir("overwrite");
    const path = join(dir, "test-environment.yaml");
    writeFileSync(path, "# user wrote this\nversion: 1\n", "utf8");
    const doc = generateTestEnvironmentYaml({ testRunners: ["jest"] });

    const result = writeTestEnvironmentYaml(path, doc, "overwrite");

    expect(result.action).toBe("overwritten");
    const content = readFileSync(path, "utf8");
    expect(content).not.toContain("# user wrote this");
    expect(content).toContain("version: 2");
    expect(content).toContain("generated_by: brownfield");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// AC6: hasDetectedInfrastructure — quality gate predicate
// ─────────────────────────────────────────────────────────────────────────
describe("E19-S16 AC6: hasDetectedInfrastructure predicate", () => {
  it("returns false when all detectors are empty", () => {
    expect(
      hasDetectedInfrastructure({
        testRunners: [],
        ciTestExecution: { ci_test_execution: null, test_commands: [] },
        dockerTestConfig: null,
        browserMatrix: null,
      })
    ).toBe(false);
  });

  it("returns true when any test runner is detected", () => {
    expect(hasDetectedInfrastructure({ testRunners: ["jest"] })).toBe(true);
  });

  it("returns true when CI test execution is detected", () => {
    expect(
      hasDetectedInfrastructure({
        ciTestExecution: { ci_test_execution: "github-actions", test_commands: [] },
      })
    ).toBe(true);
  });

  it("returns true when docker test config is detected", () => {
    expect(
      hasDetectedInfrastructure({
        dockerTestConfig: {
          compose_file: "docker-compose.test.yml",
          service_name: "t",
          test_command: null,
        },
      })
    ).toBe(true);
  });

  it("returns true when browser matrix is detected", () => {
    expect(
      hasDetectedInfrastructure({
        browserMatrix: {
          browser_matrix: [{ name: "chromium", config_source: "playwright.config.ts" }],
          build_target_only: null,
        },
      })
    ).toBe(true);
  });
});
