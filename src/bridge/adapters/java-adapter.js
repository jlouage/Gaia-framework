/**
 * E25-S2: Java Maven / Gradle Stack Adapter
 *
 * Plugs into the E25-S5 adapter registry and satisfies the StackAdapter
 * contract (architecture §10.20.11.1). A single adapter handles both Maven
 * and Gradle because both produce JUnit-format XML reports and both belong
 * to the same "Java" detection namespace. Internally the adapter branches
 * on detection result (Maven vs Gradle) but exposes a single StackAdapter
 * object to the registry.
 *
 * Responsibilities:
 *   - Layer 0: readinessCheck — detect build tool (mvn / gradle / ./gradlew)
 *   - Layer 1: discoverRunners — parse pom.xml / build.gradle and emit runner manifest
 *   - Layer 3: parseOutput — read Surefire / Gradle JUnit XML and build evidence record
 *
 * Detection semantics are OR across the five supported build files.
 * No new runtime dependencies — JUnit XML parsing uses the existing
 * fast-xml-parser devDependency shared with python-adapter.
 *
 * Traces to: FR-309, NFR-047, ADR-028, ADR-038, architecture §10.20.11
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { execFileSync as realExecFileSync } from "child_process";
import { XMLParser } from "fast-xml-parser";

// ─── Constants ──────────────────────────────────────────────────────────────

const DETECTION_PATTERNS = [
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
];

const MAVEN_FILES = ["pom.xml"];
const GRADLE_FILES = ["build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"];

const SUREFIRE_REPORT_REL = join("target", "surefire-reports");
const FAILSAFE_REPORT_REL = join("target", "failsafe-reports");
const GRADLE_REPORT_REL = join("build", "test-results", "test");
const GRADLE_INTEGRATION_REPORT_REL = join("build", "test-results", "integrationTest");

const STACKTRACE_SNIPPET_MAX = 2048;
const STDERR_SNIPPET_MAX = 2048;

const REMEDIATION = {
  missingBuildFile:
    "No Java build file detected. Expected at least one of: pom.xml, build.gradle, build.gradle.kts, settings.gradle, settings.gradle.kts in the project root.",
  missingMaven:
    "Maven not found — install from https://maven.apache.org/install.html or ensure `mvn` is on PATH.",
  missingGradle:
    "Gradle not found — install from https://gradle.org/install/ or add a ./gradlew wrapper to the project root.",
  missingBoth:
    "Neither Maven nor Gradle could be detected. Install Maven (https://maven.apache.org/install.html) or Gradle (https://gradle.org/install/), or add a ./gradlew wrapper.",
};

// ─── Detection helpers ──────────────────────────────────────────────────────

function hasAny(projectPath, files) {
  return files.some((f) => existsSync(join(projectPath, f)));
}

function detectBuildTool(projectPath) {
  const hasMaven = hasAny(projectPath, MAVEN_FILES);
  const hasGradle = hasAny(projectPath, GRADLE_FILES);
  // Monorepo rule (AC6): root pom.xml wins by default.
  if (hasMaven) return "maven";
  if (hasGradle) return "gradle";
  return null;
}

function hasGradleWrapper(projectPath) {
  // A wrapper requires both ./gradlew and gradle/wrapper/gradle-wrapper.properties,
  // but for detection purposes we only need the executable script.
  const scriptName = process.platform === "win32" ? "gradlew.bat" : "gradlew";
  return existsSync(join(projectPath, scriptName));
}

function toolAvailable(cmd, execFile) {
  try {
    execFile(cmd, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── Layer 0: readinessCheck ────────────────────────────────────────────────

/**
 * Readiness check for Java Maven / Gradle projects (AC2).
 *
 * @param {string} projectPath
 * @param {object} [options]
 * @param {function} [options._execFile] - execFileSync override (tests only)
 * @returns {object}
 */
function readinessCheck(projectPath, options = {}) {
  const started = Date.now();
  const execFile = options._execFile || realExecFileSync;

  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("readinessCheck: projectPath is required");
  }

  // NFR-035 bridge_enabled guard (parity with js/python adapters)
  if (options?.test_execution_bridge?.bridge_enabled === false) {
    return {
      passed: true,
      remediation: null,
      ready: true,
      skipped: true,
      checks: [],
      remediations: [],
      report: "",
      elapsedMs: Date.now() - started,
    };
  }

  const checks = [];
  const tool = detectBuildTool(projectPath);

  if (!tool) {
    checks.push({
      name: "build-file",
      passed: false,
      remediation: REMEDIATION.missingBuildFile,
    });
    const elapsedMs = Date.now() - started;
    return {
      passed: false,
      remediation: REMEDIATION.missingBuildFile,
      ready: false,
      skipped: false,
      checks,
      remediations: [REMEDIATION.missingBuildFile],
      report: buildReport(checks, false, elapsedMs),
      elapsedMs,
    };
  }

  checks.push({ name: "build-file", passed: true, detected: tool });

  let toolOk = false;
  let remediation = null;

  if (tool === "maven") {
    toolOk = toolAvailable("mvn", execFile);
    checks.push({
      name: "maven-available",
      passed: toolOk,
      detected: toolOk ? "mvn" : null,
      remediation: toolOk ? null : REMEDIATION.missingMaven,
    });
    if (!toolOk) remediation = REMEDIATION.missingMaven;
  } else {
    // Gradle — prefer wrapper, then fall back to system gradle
    const wrapperOk = hasGradleWrapper(projectPath);
    const systemOk = wrapperOk ? true : toolAvailable("gradle", execFile);
    toolOk = wrapperOk || systemOk;
    checks.push({
      name: "gradle-available",
      passed: toolOk,
      detected: wrapperOk ? "./gradlew" : systemOk ? "gradle" : null,
      remediation: toolOk ? null : REMEDIATION.missingGradle,
    });
    if (!toolOk) remediation = REMEDIATION.missingGradle;
  }

  const passed = toolOk;
  const elapsedMs = Date.now() - started;
  const remediations = checks.filter((c) => !c.passed && c.remediation).map((c) => c.remediation);

  return {
    passed,
    remediation,
    ready: passed,
    skipped: false,
    checks,
    remediations,
    report: buildReport(checks, passed, elapsedMs),
    elapsedMs,
  };
}

function buildReport(checks, ready, elapsedMs) {
  const rows = checks.map((c) => {
    const status = c.passed ? "PASS" : "FAIL";
    const detail = c.detected || "";
    return `  ${status.padEnd(4)}  ${c.name.padEnd(24)}  ${detail}`;
  });
  return (
    "Bridge Layer 0 — Java Readiness\n" +
    "──────────────────────────────────────\n" +
    rows.join("\n") +
    `\n──────────────────────────────────────\n  Overall: ${ready ? "READY" : "NOT READY"}  (${elapsedMs}ms)`
  );
}

// ─── Layer 1: discoverRunners ───────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: true,
});

/**
 * Scan a parsed pom.xml for plugin artifactIds matching `target`.
 * Returns true if any <plugin><artifactId>target</artifactId></plugin> is found.
 */
function pomHasPlugin(pomDoc, target) {
  const project = pomDoc?.project;
  if (!project) return false;
  // Collect all <build><plugins><plugin> nodes (direct and in pluginManagement).
  const plugins = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (node.plugin !== undefined) {
      const p = node.plugin;
      if (Array.isArray(p)) plugins.push(...p);
      else plugins.push(p);
    }
    for (const key of Object.keys(node)) {
      if (key === "plugin") continue;
      walk(node[key]);
    }
  };
  walk(project);
  return plugins.some((p) => p && String(p.artifactId || "").trim() === target);
}

function parsePomSafe(projectPath) {
  const p = join(projectPath, "pom.xml");
  if (!existsSync(p)) return null;
  try {
    const text = readFileSync(p, "utf8");
    return xmlParser.parse(text);
  } catch {
    return null;
  }
}

function readGradleBuildText(projectPath) {
  for (const f of ["build.gradle.kts", "build.gradle"]) {
    const p = join(projectPath, f);
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf8");
      } catch {
        return "";
      }
    }
  }
  return "";
}

/**
 * Discover Java runners (AC3, AC5, AC6).
 *
 * @param {string} projectPath
 * @param {object} [manifest]
 * @returns {Promise<object>}
 */
async function discoverRunners(projectPath /*, manifest */) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("discoverRunners: projectPath is required");
  }

  const tool = detectBuildTool(projectPath);
  if (!tool) {
    return {
      status: "error",
      message:
        "No Java build file detected. Expected pom.xml, build.gradle, or build.gradle.kts at the project root.",
    };
  }

  const runners = [];

  if (tool === "maven") {
    const pom = parsePomSafe(projectPath);
    // Surefire is bound to Maven's `test` phase by default even without
    // an explicit <plugin> declaration — default to `mvn test`.
    const primary = {
      runner_name: "maven-surefire",
      command: "mvn test",
      source: "pom.xml",
      tier_mapping: { tier: "unit", gates: [] },
      tier: "unit",
    };
    runners.push(primary);

    if (pom && pomHasPlugin(pom, "maven-failsafe-plugin")) {
      runners.push({
        runner_name: "maven-failsafe",
        command: "mvn verify",
        source: "pom.xml",
        tier_mapping: { tier: "integration", gates: [] },
        tier: "integration",
      });
    }

    return {
      status: "ok",
      primary,
      manifest: {
        build_tool: "maven",
        primary_runner: primary,
        runners,
        tiers: { unit: { description: "Surefire unit tests" } },
      },
    };
  }

  // Gradle
  const wrapperPreferred = hasGradleWrapper(projectPath);
  const gradleCmd = wrapperPreferred ? "./gradlew" : "gradle";
  const buildText = readGradleBuildText(projectPath);

  const primary = {
    runner_name: "gradle-test",
    command: `${gradleCmd} test`,
    source: wrapperPreferred ? "./gradlew" : "gradle",
    tier_mapping: { tier: "unit", gates: [] },
    tier: "unit",
  };
  runners.push(primary);

  // Detect an `integrationTest` task via a lightweight scan. Matches:
  //   task integrationTest(...)          (Groovy)
  //   tasks.register("integrationTest")  (Groovy/Kotlin)
  //   val integrationTest by tasks       (Kotlin DSL)
  const integrationTestRe =
    /(?:tasks\.register\(\s*["']integrationTest["']|\btask\s+integrationTest\b|\bval\s+integrationTest\s+by\s+tasks)/;
  if (integrationTestRe.test(buildText)) {
    runners.push({
      runner_name: "gradle-integration-test",
      command: `${gradleCmd} integrationTest`,
      source: wrapperPreferred ? "./gradlew" : "gradle",
      tier_mapping: { tier: "integration", gates: [] },
      tier: "integration",
    });
  }

  return {
    status: "ok",
    primary,
    manifest: {
      build_tool: "gradle",
      wrapper: wrapperPreferred,
      primary_runner: primary,
      runners,
      tiers: { unit: { description: "Gradle unit tests" } },
    },
  };
}

// ─── Layer 3: parseOutput ───────────────────────────────────────────────────

function listXmlFiles(dir) {
  if (!existsSync(dir)) return [];
  try {
    const st = statSync(dir);
    if (!st.isDirectory()) return [];
  } catch {
    return [];
  }
  try {
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".xml"))
      .map((f) => join(dir, f))
      .sort();
  } catch {
    return [];
  }
}

function extractFailureText(node) {
  if (node === null || node === undefined) return undefined;
  if (typeof node === "string") return node;
  if (typeof node === "object") {
    const message = node["@_message"];
    const body = node["#text"];
    const parts = [];
    if (message) parts.push(String(message));
    if (body) parts.push(String(body));
    if (parts.length > 0) return parts.join("\n");
    try {
      return JSON.stringify(node);
    } catch {
      return undefined;
    }
  }
  return String(node);
}

function truncateStack(text) {
  if (typeof text !== "string") return text;
  return text.length > STACKTRACE_SNIPPET_MAX ? text.slice(0, STACKTRACE_SNIPPET_MAX) : text;
}

function normalizeTestCases(rawCases) {
  if (!rawCases) return [];
  const arr = Array.isArray(rawCases) ? rawCases : [rawCases];
  return arr.map((tc) => {
    const classname = tc["@_classname"] || "";
    const name = tc["@_name"] || "unnamed";
    const fullName = classname ? `${classname}.${name}` : name;
    const time = typeof tc["@_time"] === "number" ? tc["@_time"] : parseFloat(tc["@_time"] || "0");
    const durationMs = Math.round((isNaN(time) ? 0 : time) * 1000);

    let status = "passed";
    let failureMessage;
    if (tc.failure !== undefined || tc.error !== undefined) {
      status = "failed";
      failureMessage = extractFailureText(tc.failure ?? tc.error);
    } else if (tc.skipped !== undefined) {
      status = "skipped";
    }
    const entry = { name: fullName, status, duration_ms: durationMs };
    if (failureMessage !== undefined) {
      entry.failure_message = truncateStack(String(failureMessage).trim());
    }
    return entry;
  });
}

function parseJUnitXml(xmlText) {
  let doc;
  try {
    doc = xmlParser.parse(xmlText);
  } catch {
    return null;
  }
  let suites = [];
  if (doc.testsuites) {
    const ts = doc.testsuites.testsuite;
    suites = Array.isArray(ts) ? ts : ts ? [ts] : [];
  } else if (doc.testsuite) {
    suites = Array.isArray(doc.testsuite) ? doc.testsuite : [doc.testsuite];
  } else {
    return null;
  }
  const tests = [];
  for (const suite of suites) {
    if (!suite) continue;
    tests.push(...normalizeTestCases(suite.testcase));
  }
  return tests;
}

function collectReportDirs(projectPath, tool) {
  const dirs = [];
  if (tool === "maven" || tool === null) {
    dirs.push(join(projectPath, SUREFIRE_REPORT_REL));
    dirs.push(join(projectPath, FAILSAFE_REPORT_REL));
  }
  if (tool === "gradle" || tool === null) {
    dirs.push(join(projectPath, GRADLE_REPORT_REL));
    dirs.push(join(projectPath, GRADLE_INTEGRATION_REPORT_REL));
  }
  return dirs;
}

/**
 * Parse Maven Surefire / Failsafe or Gradle test XML into evidence (AC4).
 *
 * @param {string} stdout
 * @param {string} stderr
 * @param {number} exitCode
 * @param {object} [options]
 * @param {string} [options._projectPath]
 * @returns {object}
 */
function parseOutput(stdout, stderr, exitCode, options = {}) {
  const stderrStr = typeof stderr === "string" ? stderr : "";
  const projectPath = options._projectPath || process.cwd();
  const tool = detectBuildTool(projectPath);

  const dirs = collectReportDirs(projectPath, tool);
  const allTests = [];
  let anyFound = false;

  for (const dir of dirs) {
    const files = listXmlFiles(dir);
    for (const file of files) {
      try {
        const text = readFileSync(file, "utf8");
        const tests = parseJUnitXml(text);
        if (tests && tests.length >= 0) {
          anyFound = true;
          allTests.push(...tests);
        }
      } catch {
        // skip individual broken files
      }
    }
  }

  if (!anyFound) {
    return {
      parse_error: true,
      stderr_snippet: stderrStr.slice(0, STDERR_SNIPPET_MAX),
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      tests: [],
      exit_code: exitCode,
    };
  }

  const summary = {
    total: allTests.length,
    passed: allTests.filter((t) => t.status === "passed").length,
    failed: allTests.filter((t) => t.status === "failed").length,
    skipped: allTests.filter((t) => t.status === "skipped").length,
  };
  return { summary, tests: allTests };
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * @type {import('./index.js').StackAdapter}
 */
const javaAdapter = {
  name: "java",
  detectionPatterns: DETECTION_PATTERNS,
  // OR semantics: matches when ANY of the five build files is present
  detectionMode: "any",
  readinessCheck,
  discoverRunners,
  parseOutput,
};

export default javaAdapter;
