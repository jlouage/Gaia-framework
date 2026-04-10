/**
 * E19-S16: Auto-Generate test-environment.yaml from Detected Infrastructure
 *
 * Aggregates results from the four brownfield test-infrastructure detectors
 * (E19-S12 test-runner, E19-S13 ci-test, E19-S14 docker-test, E19-S15
 * browser-matrix) and produces a `test-environment.yaml` file that is
 * compatible with the E17-S7 schema consumed by the Test Execution Bridge.
 *
 * Traces to: FR-235, ADR-030 §10.22
 *
 * Design notes:
 *   - The file is WRITTEN ONLY TO {project-root}/docs/test-artifacts/test-environment.yaml.
 *   - Conflict resolution is an explicit responsibility of the caller — the
 *     generator exposes `generate`, `merge`, and `writeTestEnvironmentYaml`
 *     as separate concerns so that the brownfield workflow can prompt the
 *     user (normal mode) or default to safe merge (YOLO mode).
 *   - Detected values NEVER overwrite non-null user-supplied fields during a
 *     merge — detected values fill NULL fields only. This is the critical
 *     safety invariant for AC3/AC4 and the primary risk called out in the
 *     story.
 *   - The generator emits the required E17-S7 schema fields (`version`,
 *     `runners`) alongside the story-required metadata fields
 *     (`test_runner`, `ci_provider`, `docker_test_config`, `browser_matrix`,
 *     `generated_by`, `generated_date`). This dual-layer layout lets the
 *     Test Execution Bridge consume the file while preserving the detection
 *     provenance requested by the story.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

// ─── YAML Serialization (minimal, deterministic) ──────────────────────────

/**
 * Convert a JS value into a YAML scalar.
 * Strings containing special chars are double-quoted. Null becomes "null".
 */
function scalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  const str = String(value);
  if (str === "") return '""';
  // Quote when containing YAML-meaningful characters, leading/trailing space,
  // or when it would otherwise parse as a non-string scalar.
  if (
    /[:#\[\]{}&*!|>'"%@`\n,?]/.test(str) ||
    /^\s|\s$/.test(str) ||
    /^(true|false|null|~|-?\d+(\.\d+)?)$/.test(str)
  ) {
    return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * Serialize a simple object to YAML. Supports nested maps and lists of
 * strings/maps. Keeps key order deterministic (insertion order).
 */
function toYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${pad}${key}: null`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
        continue;
      }
      lines.push(`${pad}${key}:`);
      for (const item of value) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          const entries = Object.entries(item);
          if (entries.length === 0) {
            lines.push(`${pad}  - {}`);
            continue;
          }
          const [firstKey, firstVal] = entries[0];
          lines.push(`${pad}  - ${firstKey}: ${scalar(firstVal)}`);
          for (let i = 1; i < entries.length; i++) {
            const [k, v] = entries[i];
            if (v !== null && typeof v === "object" && !Array.isArray(v)) {
              lines.push(`${pad}    ${k}:`);
              lines.push(toYaml(v, indent + 3));
            } else if (Array.isArray(v)) {
              if (v.length === 0) {
                lines.push(`${pad}    ${k}: []`);
              } else {
                lines.push(`${pad}    ${k}: [${v.map(scalar).join(", ")}]`);
              }
            } else {
              lines.push(`${pad}    ${k}: ${scalar(v)}`);
            }
          }
        } else {
          lines.push(`${pad}  - ${scalar(item)}`);
        }
      }
    } else if (typeof value === "object") {
      const nestedKeys = Object.keys(value);
      if (nestedKeys.length === 0) {
        lines.push(`${pad}${key}: {}`);
      } else {
        lines.push(`${pad}${key}:`);
        lines.push(toYaml(value, indent + 1));
      }
    } else {
      lines.push(`${pad}${key}: ${scalar(value)}`);
    }
  }

  return lines.join("\n");
}

// ─── Minimal YAML reader (top-level keys only, for merge) ─────────────────

/**
 * Extract the set of top-level YAML keys defined in the given file content.
 * Used by the merge path to detect which fields the user has already set so
 * that detected values never overwrite them.
 *
 * This deliberately does NOT attempt full YAML parsing — it only needs to
 * know which top-level keys exist and whether they are explicitly null.
 */
function parseTopLevelKeys(content) {
  if (!content) return {};
  const keys = {};
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Skip comments and blank lines
    if (/^\s*#/.test(rawLine)) continue;
    if (rawLine.trim() === "") continue;
    // Top-level key: starts at column 0, has a colon
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(rawLine)) {
      const colonIdx = rawLine.indexOf(":");
      const key = rawLine.substring(0, colonIdx).trim();
      const value = rawLine.substring(colonIdx + 1).trim();
      // Strip inline comment from value
      const cleanValue = value.replace(/\s+#.*$/, "").trim();
      // Explicit null markers
      if (cleanValue === "null" || cleanValue === "~") {
        keys[key] = { present: true, isNull: true };
        continue;
      }
      // Non-empty scalar/inline value — definitely set
      if (cleanValue !== "") {
        keys[key] = { present: true, isNull: false };
        continue;
      }
      // Empty value on the key line — look ahead for nested content
      // (indented child lines indicate a nested map or list, which counts
      // as "set" by the user).
      let hasChildren = false;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (next.trim() === "") continue;
        if (/^\s*#/.test(next)) continue;
        // If the next non-blank non-comment line is indented, we have children
        if (/^\s/.test(next)) {
          hasChildren = true;
        }
        break;
      }
      keys[key] = { present: true, isNull: !hasChildren };
    }
  }
  return keys;
}

// ─── Schema builders ──────────────────────────────────────────────────────

/**
 * Map a detected test runner name to a default E17-S7 runner command.
 * Returns a sensible default shell invocation for the runner.
 */
function defaultCommandForRunner(runner) {
  const defaults = {
    jest: "npx jest",
    vitest: "npx vitest run",
    mocha: "npx mocha",
    jasmine: "npx jasmine",
    pytest: "pytest",
    junit: "mvn test",
    "go-test": "go test ./...",
    bats: "bats test/",
  };
  return defaults[runner] || "npm test";
}

/**
 * Build the E17-S7 `runners` list from detected test runners. Every
 * detection becomes a tier-1 runner so that the generated file is valid
 * against the E17-S7 schema out of the box (AC5). Users can refine tiers
 * later.
 */
function buildRunnersFromDetection(testRunners) {
  if (!Array.isArray(testRunners) || testRunners.length === 0) {
    // Minimum-viable stub so the schema stays valid.
    return [
      {
        name: "unit",
        command: "npm test",
        tier: 1,
      },
    ];
  }

  return testRunners.map((runner) => ({
    name: runner,
    command: defaultCommandForRunner(runner),
    tier: 1,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Shape of the detection results passed to {@link generateTestEnvironmentYaml}.
 *
 * @typedef {Object} Detections
 * @property {string[]|null} testRunners       - From detectTestRunners (E19-S12)
 * @property {{ci_test_execution: string|null, test_commands: string[]}|null} ciTestExecution - From detectCITestExecution (E19-S13)
 * @property {{compose_file: string, service_name: string|null, test_command: string|null}|null} dockerTestConfig - From detectDockerTestConfig (E19-S14)
 * @property {{browser_matrix: Array<{name:string,config_source:string}>|null, build_target_only: {type:string,config_source:string}|null}|null} browserMatrix - From detectBrowserMatrix (E19-S15)
 * @property {string} [generatedDate] - ISO date string; defaults to today
 */

/**
 * Returns true if any of the four detectors produced a non-empty result.
 * Used by the quality gate (AC6) to decide whether the file is required.
 */
export function hasDetectedInfrastructure(detections) {
  if (!detections) return false;
  const {
    testRunners = null,
    ciTestExecution = null,
    dockerTestConfig = null,
    browserMatrix = null,
  } = detections;

  if (Array.isArray(testRunners) && testRunners.length > 0) return true;
  if (ciTestExecution && ciTestExecution.ci_test_execution) return true;
  if (dockerTestConfig && dockerTestConfig.compose_file) return true;
  if (browserMatrix) {
    if (Array.isArray(browserMatrix.browser_matrix) && browserMatrix.browser_matrix.length > 0) {
      return true;
    }
    if (browserMatrix.build_target_only) return true;
  }
  return false;
}

/**
 * Generate a test-environment.yaml document from the aggregated detector
 * results. Returns a plain JS object (not a YAML string) so callers can
 * merge, validate, or serialize as needed.
 *
 * @param {Detections} detections
 * @returns {object}
 */
export function generateTestEnvironmentYaml(detections = {}) {
  const {
    testRunners = null,
    ciTestExecution = null,
    dockerTestConfig = null,
    browserMatrix = null,
    generatedDate = new Date().toISOString().slice(0, 10),
  } = detections;

  // ─── E17-S7 required fields ─────
  const doc = {
    version: 2,
    runners: buildRunnersFromDetection(testRunners),
  };

  // ─── Story-required metadata fields (FR-235) ─────
  // These capture detection provenance alongside the schema-required fields.
  doc.test_runner = Array.isArray(testRunners) && testRunners.length > 0 ? testRunners : null;

  doc.ci_provider =
    ciTestExecution && ciTestExecution.ci_test_execution ? ciTestExecution.ci_test_execution : null;

  doc.docker_test_config = dockerTestConfig || null;

  if (browserMatrix) {
    doc.browser_matrix = browserMatrix.browser_matrix || null;
    if (browserMatrix.build_target_only) {
      doc.browserslist = browserMatrix.build_target_only;
    }
  } else {
    doc.browser_matrix = null;
  }

  doc.generated_by = "brownfield";
  doc.generated_date = generatedDate;

  return doc;
}

/**
 * Serialize a generated document to a YAML string.
 *
 * @param {object} doc
 * @returns {string}
 */
export function serializeTestEnvironmentYaml(doc) {
  const header = [
    "# test-environment.yaml — auto-generated by /gaia-brownfield (E19-S16, FR-235)",
    "# This file aggregates detected test infrastructure (E19-S12–S15).",
    "# Safe to edit — future brownfield runs will MERGE detected values into",
    "# null fields only, never overwriting your customizations.",
    "",
  ].join("\n");
  return header + toYaml(doc) + "\n";
}

/**
 * Merge detected values into an existing test-environment.yaml, preserving
 * every field the user has already defined. Detected values fill ONLY the
 * fields that are absent or explicitly `null` in the existing file.
 *
 * This is the safety-critical path called out as HIGH RISK in the story:
 * it must never silently overwrite user customizations.
 *
 * @param {string} existingContent - Raw YAML content of the existing file.
 * @param {object} generatedDoc   - Fresh document from generateTestEnvironmentYaml.
 * @returns {string} merged YAML content
 */
export function mergeTestEnvironmentYaml(existingContent, generatedDoc) {
  if (!existingContent || existingContent.trim() === "") {
    return serializeTestEnvironmentYaml(generatedDoc);
  }

  const userKeys = parseTopLevelKeys(existingContent);

  // Append a "Detected by brownfield" section to the existing file, but ONLY
  // for keys the user has not set (or has explicitly left null). This keeps
  // the user's layout, comments, and overrides intact.
  const additions = {};
  for (const [key, value] of Object.entries(generatedDoc)) {
    const userEntry = userKeys[key];
    const userHasValue = userEntry && userEntry.present && !userEntry.isNull;
    if (userHasValue) continue;
    additions[key] = value;
  }

  if (Object.keys(additions).length === 0) {
    // Nothing to merge — user has already set every field we would have
    // written. Preserve the existing content byte-for-byte.
    return existingContent;
  }

  const separator = existingContent.endsWith("\n") ? "" : "\n";
  const block = [
    "",
    "# ─── Auto-merged by /gaia-brownfield (E19-S16) ──────────────────────",
    `# generated_date: ${generatedDoc.generated_date}`,
    "# Detected values appended for fields the user had not set.",
    toYaml(additions),
    "",
  ].join("\n");

  return existingContent + separator + block;
}

/**
 * Conflict resolution mode for {@link writeTestEnvironmentYaml}.
 *
 * @typedef {"merge" | "skip" | "overwrite"} WriteMode
 */

/**
 * Write the generated test-environment.yaml to disk, honoring the chosen
 * conflict-resolution mode when the file already exists.
 *
 * Modes:
 *   - "merge":     preserve existing fields, fill null / missing ones only
 *   - "skip":      leave the existing file untouched
 *   - "overwrite": replace the file entirely (explicit opt-in only)
 *
 * When the file does not exist, the mode is ignored and the file is written
 * fresh.
 *
 * @param {string} targetPath
 * @param {object} generatedDoc - Output of generateTestEnvironmentYaml()
 * @param {WriteMode} [mode="merge"]
 * @returns {{ action: "created"|"merged"|"skipped"|"overwritten", path: string }}
 */
export function writeTestEnvironmentYaml(targetPath, generatedDoc, mode = "merge") {
  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(targetPath)) {
    writeFileSync(targetPath, serializeTestEnvironmentYaml(generatedDoc), "utf8");
    return { action: "created", path: targetPath };
  }

  if (mode === "skip") {
    return { action: "skipped", path: targetPath };
  }

  if (mode === "overwrite") {
    writeFileSync(targetPath, serializeTestEnvironmentYaml(generatedDoc), "utf8");
    return { action: "overwritten", path: targetPath };
  }

  // Default and YOLO-mode safe default: merge
  const existing = readFileSync(targetPath, "utf8");
  const merged = mergeTestEnvironmentYaml(existing, generatedDoc);
  writeFileSync(targetPath, merged, "utf8");
  return { action: "merged", path: targetPath };
}
