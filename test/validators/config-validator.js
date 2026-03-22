import { readFileSync, existsSync, statSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";

// Project root: where _gaia/ lives
const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

// Regex matching {var} and {{var} patterns in config values
const VAR_PATTERN = /\{?\{([^}]+)\}/g;

/**
 * Load and parse a YAML file. Returns null if file does not exist.
 * Uses js-yaml per ADR-010 — no regex/grep parsing.
 */
export function loadYaml(filePath) {
  if (!existsSync(filePath)) return null;
  return yaml.load(readFileSync(filePath, "utf8"));
}

/**
 * Runtime-resolved variables — intentionally left as placeholders in
 * pre-resolved configs because they are only known at workflow execution time.
 */
export const RUNTIME_VARIABLES = new Set([
  "date",
  "story_key",
  "story_title_slug",
  "sprint_id",
  "spec_name",
  "cr_id",
  "version",
  "epic_key",
  "mode",
  "target",
  "target_file",
  "agent",
  "artifact_path",
  "plan_artifact_path",
  "data_path",
]);

/**
 * All known framework variables (build-time + runtime).
 * Used to distinguish valid unresolved references from typos.
 */
export const FRAMEWORK_VARIABLES = new Set([
  // Build-time (resolved during /gaia-build-configs)
  "project-root",
  "project-path",
  "installed_path",
  "planning_artifacts",
  "implementation_artifacts",
  "test_artifacts",
  "creative_artifacts",
  "memory_path",
  "checkpoint_path",
  // Runtime (resolved at workflow execution)
  ...RUNTIME_VARIABLES,
]);

/**
 * Extract variable name from a match, handling both {var} and {{var} patterns.
 */
function extractVarName(match) {
  return match.replace(/^\{+/, "").replace(/\}$/, "");
}

/**
 * Resolve the four-layer config inheritance chain:
 * global.yaml → module config.yaml → workflow.yaml → resolved output
 *
 * Shallow merge — workflow-level keys override module-level, which override global-level.
 */
export function resolveConfigChain(globalConfig, moduleConfig, workflowConfig) {
  return {
    ...(globalConfig || {}),
    ...(moduleConfig || {}),
    ...(workflowConfig || {}),
  };
}

/**
 * Resolve all {variable} placeholders in config values.
 * Walks all string values (including nested objects) and replaces known variables.
 * Throws on undefined variables (AC5).
 */
export function resolveVariables(config, projectRoot, options = {}) {
  const projectPath = options.project_path;
  const resolvedProjectPath =
    !projectPath || projectPath === "."
      ? projectRoot
      : join(projectRoot, projectPath);

  const varMap = {
    "project-root": projectRoot,
    "project-path": resolvedProjectPath,
    installed_path: options.installed_path || join(projectRoot, "_gaia"),
    date: new Date().toISOString().slice(0, 10),
  };

  function resolveString(str) {
    return str.replace(VAR_PATTERN, (match, varName) => {
      if (varMap[varName] !== undefined) {
        return match.startsWith("{{") ? `{${varMap[varName]}` : varMap[varName];
      }
      if (FRAMEWORK_VARIABLES.has(varName)) {
        return match; // Known but no value — leave as-is for runtime resolution
      }
      throw new Error(
        `Undefined variable: {${varName}} — not defined at any level of the config inheritance chain`,
      );
    });
  }

  function resolveValue(value) {
    if (typeof value === "string") return resolveString(value);
    if (Array.isArray(value)) return value.map(resolveValue);
    if (value !== null && typeof value === "object") {
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = resolveValue(v);
      }
      return result;
    }
    return value;
  }

  return resolveValue(config);
}

/**
 * Detect stale .resolved/ configs by comparing mtimes.
 * A resolved config is stale if any source config has been modified after it.
 */
export function detectStaleness(resolvedPath, sourcePaths) {
  if (!existsSync(resolvedPath)) {
    return { stale: true, reason: `Resolved file does not exist: ${resolvedPath}` };
  }

  const resolvedMtime = statSync(resolvedPath).mtimeMs;

  for (const sourcePath of sourcePaths) {
    if (!existsSync(sourcePath)) continue;
    const sourceMtime = statSync(sourcePath).mtimeMs;
    if (sourceMtime > resolvedMtime) {
      return {
        stale: true,
        reason: `Source ${sourcePath} (${new Date(sourceMtime).toISOString()}) is newer than resolved ${resolvedPath} (${new Date(resolvedMtime).toISOString()})`,
      };
    }
  }

  return { stale: false };
}

/**
 * Validate that a resolved config contains no unresolved variable placeholders.
 * Scans all string values for {variable} patterns.
 * Runtime variables are excluded — they are intentionally left as placeholders.
 */
export function validateNoUnresolved(config) {
  const unresolvedVars = [];

  function scanValue(value, path) {
    if (typeof value === "string") {
      const matches = value.match(VAR_PATTERN);
      if (matches) {
        for (const match of matches) {
          const varName = extractVarName(match);
          if (!RUNTIME_VARIABLES.has(varName)) {
            unresolvedVars.push(`${path}: ${match}`);
          }
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => scanValue(item, `${path}[${i}]`));
    } else if (value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        scanValue(v, `${path}.${k}`);
      }
    }
  }

  scanValue(config, "root");

  return {
    valid: unresolvedVars.length === 0,
    unresolvedVars,
  };
}

export { PROJECT_ROOT };
