/**
 * ATDD: E25-S2 — Java Maven / Gradle Stack Adapter
 *
 * Acceptance tests for the Java stack adapter plugging into the
 * E25-S5 registry. Covers TEB-MS-J01..J06.
 *
 * AC coverage: AC1 (contract + patterns + registry), AC2 (readinessCheck),
 *              AC3 (discoverRunners maven + gradle), AC4 (parseOutput JUnit XML),
 *              AC5 (tier mapping), AC6 (monorepo root-wins),
 *              AC7 (registry init budget).
 *
 * Traces to: FR-309, NFR-047, ADR-028, ADR-038
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const BRIDGE_DIR = join(PROJECT_ROOT, "_gaia", "core", "bridge");
const ADAPTERS_DIR = join(BRIDGE_DIR, "adapters");
const REGISTRY_PATH = join(ADAPTERS_DIR, "index.js");
const JAVA_ADAPTER_PATH = join(ADAPTERS_DIR, "java-adapter.js");

const FIXTURES = join(PROJECT_ROOT, "test", "fixtures", "bridge", "java");

// Fake execFileSync factory — controls whether `mvn -version` / `gradle -version` succeed.
function makeFakeExec({ mvnOk = true, gradleOk = true } = {}) {
  const calls = [];
  function fake(cmd, args /*, opts */) {
    calls.push({ cmd, args });
    if (cmd === "mvn") {
      if (!mvnOk) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return Buffer.from("Apache Maven 3.9.0\n", "utf8");
    }
    if (cmd === "gradle") {
      if (!gradleOk) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return Buffer.from("Gradle 8.5\n", "utf8");
    }
    const err = new Error("unknown command " + cmd);
    err.code = "ENOENT";
    throw err;
  }
  return { fake, calls };
}

// ─── AC1: Contract compliance (TEB-MS-J01) ──────────────────────────────────

describe("E25-S2 AC1: adapter contract and detection patterns", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(JAVA_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("java-adapter.js exists", () => {
    expect(existsSync(JAVA_ADAPTER_PATH)).toBe(true);
  });

  it("exports default object with name 'java'", () => {
    expect(adapter.name).toBe("java");
  });

  it("detectionPatterns contains the five Java build files", () => {
    expect(adapter.detectionPatterns).toEqual([
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
      "settings.gradle",
      "settings.gradle.kts",
    ]);
  });

  it("exports all three StackAdapter contract functions", () => {
    expect(typeof adapter.readinessCheck).toBe("function");
    expect(typeof adapter.discoverRunners).toBe("function");
    expect(typeof adapter.parseOutput).toBe("function");
  });

  it("is registered by the registry immediately after the python adapter", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const names = reg.listAdapters().map((a) => a.name);
    expect(names).toContain("java");
    expect(names.indexOf("java")).toBe(names.indexOf("python") + 1);
  });

  it("getAdapter() matches a Maven project", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const picked = reg.getAdapter(join(FIXTURES, "maven-springboot"));
    expect(picked).not.toBeNull();
    expect(picked.name).toBe("java");
  });

  it("getAdapter() matches a Gradle Kotlin project on build.gradle.kts", async () => {
    const reg = await import(REGISTRY_PATH + "?bust=" + Date.now());
    const picked = reg.getAdapter(join(FIXTURES, "gradle-kotlin"));
    expect(picked).not.toBeNull();
    expect(picked.name).toBe("java");
  });
});

// ─── AC2: readinessCheck (TEB-MS-J02) ───────────────────────────────────────

describe("E25-S2 AC2: readinessCheck success and failure modes", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(JAVA_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("Maven project with mvn on PATH returns passed=true", () => {
    const { fake } = makeFakeExec({ mvnOk: true });
    const result = adapter.readinessCheck(join(FIXTURES, "maven-springboot"), {
      _execFile: fake,
    });
    expect(result.passed).toBe(true);
    expect(result.remediation).toBeNull();
  });

  it("Gradle project with wrapper returns passed=true even without system gradle", () => {
    const { fake } = makeFakeExec({ gradleOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "gradle-kotlin"), {
      _execFile: fake,
    });
    expect(result.passed).toBe(true);
    expect(result.remediation).toBeNull();
  });

  it("Gradle project without wrapper falls back to system gradle", () => {
    const { fake } = makeFakeExec({ gradleOk: true });
    const result = adapter.readinessCheck(join(FIXTURES, "gradle-groovy"), {
      _execFile: fake,
    });
    expect(result.passed).toBe(true);
  });

  it("Maven project with mvn missing returns remediation naming Maven install URL", () => {
    const { fake } = makeFakeExec({ mvnOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "maven-springboot"), {
      _execFile: fake,
    });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/Maven/);
    expect(result.remediation).toMatch(/maven\.apache\.org/);
  });

  it("Gradle project with no wrapper and no system gradle returns remediation", () => {
    const { fake } = makeFakeExec({ gradleOk: false });
    const result = adapter.readinessCheck(join(FIXTURES, "gradle-groovy"), {
      _execFile: fake,
    });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/Gradle/);
    expect(result.remediation).toMatch(/gradle\.org\/install/);
  });

  it("No build file present returns build-file remediation", () => {
    const { fake } = makeFakeExec({});
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s2-"));
    const result = adapter.readinessCheck(tmp, { _execFile: fake });
    expect(result.passed).toBe(false);
    expect(result.remediation).toMatch(/pom\.xml/);
    expect(result.remediation).toMatch(/build\.gradle/);
  });
});

// ─── AC3 + AC5: discoverRunners Maven path ──────────────────────────────────

describe("E25-S2 AC3/AC5: discoverRunners — Maven", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(JAVA_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("returns primary command `mvn test` mapped to unit tier", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "maven-springboot"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("mvn test");
    expect(result.primary.tier).toBe("unit");
    expect(result.primary.runner_name).toBe("maven-surefire");
  });

  it("emits a secondary `mvn verify` runner mapped to integration tier when Failsafe is present", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "maven-springboot"), {});
    const runners = result.manifest.runners;
    const failsafe = runners.find((r) => r.runner_name === "maven-failsafe");
    expect(failsafe).toBeDefined();
    expect(failsafe.command).toBe("mvn verify");
    expect(failsafe.tier).toBe("integration");
  });

  it("defaults to `mvn test` when pom.xml does not explicitly declare Surefire", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "maven-no-failsafe"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("mvn test");
    // No failsafe runner in this fixture
    const failsafe = result.manifest.runners.find((r) => r.runner_name === "maven-failsafe");
    expect(failsafe).toBeUndefined();
  });
});

// ─── AC3 + AC5: discoverRunners Gradle path ─────────────────────────────────

describe("E25-S2 AC3/AC5: discoverRunners — Gradle", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(JAVA_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("prefers ./gradlew when wrapper is present", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "gradle-kotlin"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("./gradlew test");
    expect(result.manifest.wrapper).toBe(true);
  });

  it("emits a secondary `./gradlew integrationTest` runner when the task is declared", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "gradle-kotlin"), {});
    const integ = result.manifest.runners.find((r) => r.runner_name === "gradle-integration-test");
    expect(integ).toBeDefined();
    expect(integ.command).toBe("./gradlew integrationTest");
    expect(integ.tier).toBe("integration");
  });

  it("falls back to `gradle test` when no wrapper is present", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "gradle-groovy"), {});
    expect(result.primary.command).toBe("gradle test");
    expect(result.manifest.wrapper).toBe(false);
  });
});

// ─── AC4: parseOutput (TEB-MS-J05) ──────────────────────────────────────────

describe("E25-S2 AC4: parseOutput JUnit XML", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(JAVA_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("parses Maven Surefire reports from target/surefire-reports/*.xml", () => {
    const result = adapter.parseOutput("", "", 1, {
      _projectPath: join(FIXTURES, "maven-springboot"),
    });
    expect(result.summary).toEqual({ total: 3, passed: 1, failed: 1, skipped: 1 });
    expect(result.tests).toHaveLength(3);
    const failed = result.tests.find((t) => t.status === "failed");
    expect(failed).toBeDefined();
    expect(failed.failure_message).toMatch(/expected/);
  });

  it("parses Gradle reports from build/test-results/test/*.xml", () => {
    const result = adapter.parseOutput("", "", 0, {
      _projectPath: join(FIXTURES, "gradle-kotlin"),
    });
    expect(result.summary).toEqual({ total: 2, passed: 2, failed: 0, skipped: 0 });
  });

  it("returns parse_error=true with stderr snippet when XML is missing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s2-parse-"));
    writeFileSync(join(tmp, "pom.xml"), "<project/>\n");
    const stderr = "FATAL: maven crashed\n" + "x".repeat(5000);
    const result = adapter.parseOutput("", stderr, 2, { _projectPath: tmp });
    expect(result.parse_error).toBe(true);
    expect(typeof result.stderr_snippet).toBe("string");
    expect(result.stderr_snippet.length).toBeLessThanOrEqual(2048);
    expect(result.stderr_snippet).toContain("FATAL: maven crashed");
  });

  it("truncates failure stacktraces to 2KB", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gaia-e25s2-stack-"));
    writeFileSync(join(tmp, "pom.xml"), "<project/>\n");
    const reportsDir = join(tmp, "target", "surefire-reports");
    mkdirSync(reportsDir, { recursive: true });
    const huge = "y".repeat(5000);
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<testsuite name="com.example.Big" tests="1" failures="1" errors="0" skipped="0">\n' +
      '  <testcase classname="com.example.Big" name="bigFail" time="0.001">\n' +
      `    <failure message="huge">${huge}</failure>\n` +
      "  </testcase>\n" +
      "</testsuite>\n";
    writeFileSync(join(reportsDir, "TEST-com.example.Big.xml"), xml);
    const result = adapter.parseOutput("", "", 1, { _projectPath: tmp });
    const failed = result.tests.find((t) => t.status === "failed");
    expect(failed).toBeDefined();
    expect(failed.failure_message.length).toBeLessThanOrEqual(2048);
  });
});

// ─── AC6: Monorepo root-wins rule ───────────────────────────────────────────

describe("E25-S2 AC6: monorepo root-wins", () => {
  let adapter;

  beforeAll(async () => {
    const mod = await import(JAVA_ADAPTER_PATH + "?bust=" + Date.now());
    adapter = mod.default ?? mod;
  });

  it("root pom.xml wins over a subdirectory build.gradle", async () => {
    const result = await adapter.discoverRunners(join(FIXTURES, "monorepo-root-maven"), {});
    expect(result.status).toBe("ok");
    expect(result.primary.command).toBe("mvn test");
    expect(result.manifest.build_tool).toBe("maven");
  });
});

// ─── AC7: Registry init performance budget (TEB-MS-J06) ─────────────────────

describe("E25-S2 AC7: registry init stays within NFR-047 50ms budget", () => {
  it("registry listAdapters() p95 under 50ms over 100 warm runs with java adapter registered", async () => {
    const { listAdapters } = await import(REGISTRY_PATH + "?bust=warmup-" + Date.now());
    listAdapters();

    const timings = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      listAdapters();
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});
