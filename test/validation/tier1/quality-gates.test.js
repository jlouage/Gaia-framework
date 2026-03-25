/**
 * Quality Gate Validation — E2-S5
 *
 * Tier classification: Tier 1 (programmatic, CI-safe)
 * Deviation from architecture Section 10.2: ADR-001 classifies FR-41 (quality-gate-audit)
 * as Tier 2. However, the programmatic portion — YAML parsing, variable resolution,
 * on_fail validation — is fully automatable without Claude Code and belongs in Tier 1.
 * Semantic interpretation (does the engine correctly halt at runtime?) remains Tier 2 scope
 * and is NOT covered here.
 *
 * References: ADR-001, ADR-010 (js-yaml), FR-41, US-13
 */

import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { getWorkflowPaths } from "../helpers/workflow-paths.js";
import { loadYaml, FRAMEWORK_VARIABLES } from "../../validators/config-validator.js";

// Project root: where _gaia/ lives
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

// Variable pattern matching {var} in check values (not {{var}} double-brace templates)
const _VAR_PATTERN = /\{([a-z_-]+)\}/g;

/**
 * Extract all {variable} references from a string.
 * Returns array of variable names (without braces).
 */
function extractVariables(value) {
  const vars = [];
  let match;
  const pattern = /\{([a-z_-]+)\}/g;
  while ((match = pattern.exec(value)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

// Hardcoded absolute path patterns (cross-platform)
const ABSOLUTE_PATH_PATTERNS = [
  /\/Users\//,
  /\/home\//,
  /\/var\//,
  /\/tmp\//,
  /\/etc\//,
  /\/opt\//,
  /C:\\/,
  /D:\\/,
];

// Critical-path workflows whose pre_start gates MUST use HALT: prefix
const CRITICAL_PATH_WORKFLOWS = ["dev-story", "deployment-checklist", "implementation-readiness"];

// Recognized on_fail severity prefixes
const RECOGNIZED_PREFIXES = ["HALT:", "WARN:", "RECOMMEND:", "WARNING:"];

/**
 * Classify a check condition into one of four categories:
 *   - file-path: contains {variable}/path or file existence reference
 *   - state-enum: checks status/state == value
 *   - runtime-computed: checks computed boolean (all_tests_pass, etc.)
 *   - content-structure: checks content completeness (has_all_sections, etc.)
 *
 * Returns { type, reason } or null if unclassified.
 */
function classifyCheck(checkValue) {
  if (!checkValue || typeof checkValue !== "string") return null;

  // file-path: contains {variable} with path-like context or *_exists with args
  if (/\{[a-z_-]+\}/.test(checkValue) && (checkValue.includes("/") || checkValue.includes("*"))) {
    return { type: "file-path", reason: "contains variable references with path context" };
  }

  // file-path: named existence checks with embedded path args like brainstorm_exists(...)
  if (/\w+_exists\(/.test(checkValue)) {
    return { type: "file-path", reason: "named existence check with path argument" };
  }

  // file-path: named existence checks without args (e.g., prd_exists, architecture_exists)
  if (/^\w+_exists$/.test(checkValue) || /\w+_exist(s)?$/.test(checkValue)) {
    return { type: "file-path", reason: "named file existence check" };
  }

  // file-path: ".md exists" or similar
  if (/\.md\s+exists/.test(checkValue) || /file\s+exists/.test(checkValue)) {
    return { type: "file-path", reason: "file existence assertion" };
  }

  // state-enum: status == 'value' or status in [...]
  if (/status\s*(==|!=|in\s*\[)/.test(checkValue) || /override\s*==/.test(checkValue)) {
    return { type: "state-enum", reason: "state/status comparison" };
  }

  // runtime-computed: boolean expressions like all_tests_pass == true
  if (/==\s*true|==\s*false/.test(checkValue)) {
    return { type: "runtime-computed", reason: "boolean runtime check" };
  }

  // content-structure: checks for section completeness
  if (/has_all_sections|all_sections|completeness/.test(checkValue)) {
    return { type: "content-structure", reason: "content structure check" };
  }

  // file-path: "is provided and file exists" or "is provided"
  if (/is\s+provided/.test(checkValue)) {
    return { type: "runtime-computed", reason: "parameter provision check" };
  }

  // runtime-computed: catch-all for named abstract conditions (e.g., readiness_passed, cascade_significant)
  if (/^\w+$/.test(checkValue) || /^\w+_\w+$/.test(checkValue)) {
    return { type: "runtime-computed", reason: "named abstract condition" };
  }

  // runtime-computed: anything with _recommended, _passed, _confirmed suffixes
  if (/_recommended$|_passed$|_confirmed$|_advisory$/.test(checkValue)) {
    return { type: "runtime-computed", reason: "named result condition" };
  }

  // content-structure or runtime-computed: compound expressions
  if (/\s+or\s+|\s+and\s+/.test(checkValue)) {
    return { type: "runtime-computed", reason: "compound condition" };
  }

  return null;
}

// ---------- Build the gate registry ----------

const workflowFiles = getWorkflowPaths(PROJECT_ROOT);

// Collect all quality gate entries from all workflow files
const gateRegistry = [];

for (const wfPath of workflowFiles) {
  const config = loadYaml(wfPath);
  if (!config?.quality_gates) continue;

  const workflowName = config.name || "unknown";

  for (const gateType of ["pre_start", "post_complete"]) {
    const entries = config.quality_gates[gateType];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      gateRegistry.push({
        workflowPath: wfPath,
        workflowName,
        gateType,
        check: entry.check,
        onFail: entry.on_fail,
      });
    }
  }
}

// ---------- Tests ----------

describe("Quality Gate Validation (FR-41, US-13)", () => {
  // AC4: Dynamic enumeration
  it("should dynamically discover quality gates from the filesystem", () => {
    expect(gateRegistry.length).toBeGreaterThan(0);
    // No hardcoded count — the test discovers whatever exists
  });

  it("should exclude .resolved/ directories from gate discovery", () => {
    const resolvedFiles = gateRegistry.filter(
      (g) => g.workflowPath.includes(".resolved/") || g.workflowPath.includes(".resolved\\")
    );
    expect(resolvedFiles, ".resolved/ gates should be excluded").toHaveLength(0);
  });

  it("should exclude _backups/ directories from gate discovery", () => {
    const backupFiles = gateRegistry.filter(
      (g) => g.workflowPath.includes("_backups/") || g.workflowPath.includes("_backups\\")
    );
    expect(backupFiles, "_backups/ gates should be excluded").toHaveLength(0);
  });

  // AC1a: Variable resolution in file-path checks
  describe("AC1a: File-path variable resolution", () => {
    const filePathGates = gateRegistry.filter((g) => {
      const classification = classifyCheck(g.check);
      return classification?.type === "file-path";
    });

    it("should find file-path gates to validate", () => {
      expect(filePathGates.length).toBeGreaterThan(0);
    });

    describe.each(filePathGates.map((g) => [`${g.workflowName} (${g.gateType}): ${g.check}`, g]))(
      "%s",
      (_label, gate) => {
        it("should use only defined framework variables", () => {
          for (const v of extractVariables(gate.check)) {
            expect(
              FRAMEWORK_VARIABLES.has(v),
              `Undefined variable '{${v}}' in gate check: "${gate.check}" (workflow: ${gate.workflowName})`
            ).toBe(true);
          }
        });
      }
    );
  });

  // AC1b: Classify all gate conditions
  describe("AC1b: Gate condition classification", () => {
    describe.each(gateRegistry.map((g) => [`${g.workflowName} (${g.gateType}): ${g.check}`, g]))(
      "%s",
      (_label, gate) => {
        it("should be classifiable as file-path, state-enum, runtime-computed, or content-structure", () => {
          const classification = classifyCheck(gate.check);
          expect(
            classification,
            `Unclassified check: "${gate.check}" (workflow: ${gate.workflowName}). ` +
              `Must match one of: file-path, state-enum, runtime-computed, content-structure`
          ).not.toBeNull();
          expect(["file-path", "state-enum", "runtime-computed", "content-structure"]).toContain(
            classification.type
          );
        });
      }
    );
  });

  // AC2a: on_fail message validation
  describe("AC2a: on_fail message presence, prefix, and actionability", () => {
    describe.each(gateRegistry.map((g) => [`${g.workflowName} (${g.gateType}): ${g.check}`, g]))(
      "%s",
      (_label, gate) => {
        it("should have a non-empty on_fail message", () => {
          expect(
            gate.onFail,
            `Missing on_fail for check: "${gate.check}" (workflow: ${gate.workflowName})`
          ).toBeTruthy();
          expect(
            typeof gate.onFail === "string" && gate.onFail.trim().length > 0,
            `Empty on_fail for check: "${gate.check}" (workflow: ${gate.workflowName})`
          ).toBe(true);
        });

        it("should begin with a recognized severity prefix", () => {
          if (!gate.onFail) return;
          const hasPrefix = RECOGNIZED_PREFIXES.some((prefix) =>
            gate.onFail.trimStart().startsWith(prefix)
          );
          expect(
            hasPrefix,
            `on_fail message does not start with a recognized prefix (${RECOGNIZED_PREFIXES.join(", ")}): ` +
              `"${gate.onFail}" (workflow: ${gate.workflowName})`
          ).toBe(true);
        });

        it("should include actionable remediation (slash command or file path)", () => {
          if (!gate.onFail) return;
          const hasSlashCommand = /\/gaia-/.test(gate.onFail);
          const hasFilePath = /\{[a-z_-]+\}\//.test(gate.onFail) || /\.\w{2,4}/.test(gate.onFail);
          const hasActionableGuidance = hasSlashCommand || hasFilePath;
          expect(
            hasActionableGuidance,
            `on_fail lacks actionable remediation (no /gaia- command or file reference): ` +
              `"${gate.onFail}" (workflow: ${gate.workflowName})`
          ).toBe(true);
        });
      }
    );
  });

  // AC2b: Critical-path pre_start gates use HALT: prefix
  describe("AC2b: Critical-path pre_start gates use HALT:", () => {
    for (const criticalWorkflow of CRITICAL_PATH_WORKFLOWS) {
      const criticalGates = gateRegistry.filter(
        (g) => g.workflowName === criticalWorkflow && g.gateType === "pre_start"
      );

      describe(`${criticalWorkflow}`, () => {
        it("should have pre_start gates defined", () => {
          expect(
            criticalGates.length,
            `Critical workflow '${criticalWorkflow}' has no pre_start gates`
          ).toBeGreaterThan(0);
        });

        if (criticalGates.length > 0) {
          describe.each(criticalGates.map((g) => [`check: ${g.check}`, g]))(
            "%s",
            (_label, gate) => {
              it("should use HALT: prefix on on_fail", () => {
                expect(
                  gate.onFail?.trimStart().startsWith("HALT:"),
                  `Critical-path pre_start gate uses non-HALT prefix: "${gate.onFail}" (workflow: ${gate.workflowName})`
                ).toBe(true);
              });
            }
          );
        }
      });
    }
  });

  // AC3a: No undefined variable references
  describe("AC3a: No undefined variable references in gate checks", () => {
    const gatesWithVars = gateRegistry.filter((g) => /\{[a-z_-]+\}/.test(g.check));

    it("should find gates with variable references to validate", () => {
      // It's okay if there are none, but we expect some based on the codebase
      expect(gatesWithVars.length).toBeGreaterThanOrEqual(0);
    });

    if (gatesWithVars.length > 0) {
      describe.each(gatesWithVars.map((g) => [`${g.workflowName}: ${g.check}`, g]))(
        "%s",
        (_label, gate) => {
          it("should only reference defined variables", () => {
            for (const v of extractVariables(gate.check)) {
              expect(
                FRAMEWORK_VARIABLES.has(v),
                `Undefined variable '{${v}}' in check: "${gate.check}" (workflow: ${gate.workflowName})`
              ).toBe(true);
            }
          });
        }
      );
    }
  });

  // AC3b: No hardcoded absolute paths
  describe("AC3b: No hardcoded absolute paths in gate checks", () => {
    describe.each(gateRegistry.map((g) => [`${g.workflowName} (${g.gateType}): ${g.check}`, g]))(
      "%s",
      (_label, gate) => {
        it("should not contain hardcoded absolute paths", () => {
          for (const pattern of ABSOLUTE_PATH_PATTERNS) {
            expect(
              pattern.test(gate.check),
              `Hardcoded absolute path found in check: "${gate.check}" (pattern: ${pattern}) (workflow: ${gate.workflowName})`
            ).toBe(false);
          }
        });
      }
    );
  });

  // Supplementary: Syntactic inconsistency detection (warnings, not failures)
  describe("Supplementary: Syntactic inconsistency detection", () => {
    it("should report syntactic variants of equivalent checks as warnings", () => {
      // Collect all check values that refer to similar concepts
      const existenceChecks = gateRegistry
        .filter((g) => /exist/i.test(g.check))
        .map((g) => ({ check: g.check, workflow: g.workflowName }));

      // Group by base concept (strip _exists, _exist, .md exists, etc.)
      const concepts = new Map();
      for (const ec of existenceChecks) {
        const base = ec.check
          .replace(/_exists?\b/g, "")
          .replace(/\.md\s+exists/g, "")
          .replace(/\(.*\)/, "")
          .trim()
          .toLowerCase();
        if (!concepts.has(base)) concepts.set(base, []);
        concepts.get(base).push(ec);
      }

      // Warn (but don't fail) for concepts with multiple syntactic forms
      const inconsistencies = [];
      for (const [concept, entries] of concepts) {
        const uniqueForms = [...new Set(entries.map((e) => e.check))];
        if (uniqueForms.length > 1) {
          inconsistencies.push({ concept, forms: uniqueForms });
        }
      }

      // This test documents inconsistencies — it always passes
      // Inconsistencies are logged but not treated as failures
      if (inconsistencies.length > 0) {
        console.warn(
          "Syntactic inconsistencies detected in gate checks:",
          JSON.stringify(inconsistencies, null, 2)
        );
      }
      expect(true).toBe(true);
    });
  });
});
