import { readFileSync, existsSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import yaml from "js-yaml";
import { walkFiles } from "../validation/helpers/fs-walk.js";
import { PROJECT_ROOT } from "../helpers/project-root.js";

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
    !projectPath || projectPath === "." ? projectRoot : join(projectRoot, projectPath);

  const varMap = {
    "project-root": projectRoot,
    "project-path": resolvedProjectPath,
    installed_path: options.installed_path || join(projectRoot, "_gaia"),
    date: new Date().toISOString().slice(0, 10),
    // Spread any additional variables (e.g., artifact paths from global config)
    ...(options.additionalVars || {}),
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
        `Undefined variable: {${varName}} — not defined at any level of the config inheritance chain`
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

/**
 * Build-time artifact path keys from global.yaml.
 * Used by resolveWorkflowConfig to pre-resolve artifact variables.
 */
const ARTIFACT_PATH_KEYS = [
  "planning_artifacts",
  "implementation_artifacts",
  "test_artifacts",
  "creative_artifacts",
  "memory_path",
  "checkpoint_path",
];

/**
 * Build pre-resolved artifact path variables from global config.
 * Replaces {project-root} in each artifact path with the actual project root.
 */
function buildArtifactVars(globalConfig, projectRoot) {
  const vars = {};
  for (const key of ARTIFACT_PATH_KEYS) {
    if (globalConfig[key]) {
      vars[key] = globalConfig[key].replace(/\{project-root\}/g, projectRoot);
    }
  }
  return vars;
}

/**
 * Find files matching a pattern within a module directory.
 * Shared helper to avoid duplicated find commands across functions.
 * @param {string} modDir — module directory path
 * @param {string} pattern — find -path or -name pattern
 * @param {boolean} usePath — if true, use -path; if false, use -name
 * @returns {string[]} — array of matching file paths
 */
function findModuleFiles(modDir, pattern, usePath = false) {
  if (usePath) {
    // -path mode: pattern like "*/agents/*.md" — walk all files and filter
    const allFiles = walkFiles(modDir, {
      exclude: ["_backups", "node_modules"],
    });
    // Convert find -path glob to a regex: replace * with .*
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return allFiles.filter((f) => regex.test(f));
  }
  // -name mode: pattern is a filename glob like "workflow.yaml" or "*.md"
  return walkFiles(modDir, {
    namePattern: pattern,
    exclude: ["_backups", "node_modules"],
  });
}

/**
 * Resolve a workflow config through the full inheritance chain.
 * global.yaml -> module config.yaml -> workflow.yaml -> resolved output.
 * Multi-pass resolution handles nested variable references.
 */
export function resolveWorkflowConfig(workflowPath, projectRoot, globalConfig) {
  const workflowConfig = loadYaml(workflowPath);
  if (!workflowConfig) return null;

  const gaiaDir = join(projectRoot, "_gaia");
  const moduleConfig = loadYaml(join(gaiaDir, workflowConfig.module, "config.yaml"));
  const merged = resolveConfigChain(globalConfig, moduleConfig || {}, workflowConfig);

  const installedPath = workflowConfig.installed_path || dirname(workflowPath);
  const additionalVars = buildArtifactVars(globalConfig, projectRoot);

  const resolveOpts = {
    project_path: globalConfig.project_path,
    installed_path: installedPath,
    additionalVars,
  };

  // Two-pass resolution: first pass resolves direct references,
  // second pass catches nested references (e.g., {installed_path} -> {project-root}/...)
  let resolved = resolveVariables(merged, projectRoot, resolveOpts);
  resolved = resolveVariables(resolved, projectRoot, {
    ...resolveOpts,
    installed_path: resolved.installed_path || installedPath,
  });

  return resolved;
}

/**
 * Count .resolved/ files and workflow.yaml files per module.
 * Returns { moduleName: { resolved, workflows, gap } }.
 */
export function countResolvedByModule(modules) {
  const gaiaDir = join(PROJECT_ROOT, "_gaia");
  const counts = {};

  for (const mod of modules) {
    const modDir = join(gaiaDir, mod);
    if (!existsSync(modDir)) {
      counts[mod] = { resolved: 0, workflows: 0, gap: 0 };
      continue;
    }

    const resolvedCount = findModuleFiles(modDir, "*/.resolved/*.yaml", true).length;
    const workflowFiles = findModuleFiles(modDir, "workflow.yaml").filter(
      (f) => !f.includes("/.resolved/")
    );

    const gap = workflowFiles.length - resolvedCount;
    counts[mod] = { resolved: resolvedCount, workflows: workflowFiles.length, gap };
  }

  return counts;
}

/**
 * Detect count drift — find workflow.yaml files without corresponding .resolved/ entries.
 * Returns array of { module, missing, missingFiles[] }.
 */
export function detectCountDrift(modules) {
  const gaiaDir = join(PROJECT_ROOT, "_gaia");
  const results = [];

  for (const mod of modules) {
    const modDir = join(gaiaDir, mod);
    if (!existsSync(modDir)) {
      results.push({ module: mod, missing: 0, missingFiles: [] });
      continue;
    }

    const workflowPaths = findModuleFiles(modDir, "workflow.yaml").filter(
      (f) => !f.includes("/.resolved/")
    );
    const resolvedNames = new Set(
      findModuleFiles(modDir, "*/.resolved/*.yaml", true).map((f) => basename(f, ".yaml"))
    );

    const missingFiles = [];
    for (const wfPath of workflowPaths) {
      const wfConfig = loadYaml(wfPath);
      const wfName = wfConfig?.name || basename(dirname(wfPath));
      if (!resolvedNames.has(wfName)) {
        missingFiles.push(wfName);
      }
    }

    results.push({ module: mod, missing: missingFiles.length, missingFiles });
  }

  return results;
}

/**
 * Validate resolution for a single module. Returns { success, error } or { success, resolvedConfigs }.
 * On failure (e.g., missing config.yaml), returns error with no partial output.
 */
export function validateModuleResolution(moduleName, projectRoot) {
  const gaiaDir = join(projectRoot, "_gaia");
  const modDir = join(gaiaDir, moduleName);

  if (!existsSync(modDir)) {
    return {
      success: false,
      error: `Module directory does not exist: ${modDir}`,
    };
  }

  const moduleConfigPath = join(modDir, "config.yaml");
  if (!existsSync(moduleConfigPath)) {
    return {
      success: false,
      error: `Module config.yaml not found: ${moduleConfigPath}`,
    };
  }

  const globalConfig = loadYaml(join(gaiaDir, "_config", "global.yaml"));
  if (!globalConfig) {
    return {
      success: false,
      error: `global.yaml not found or invalid`,
    };
  }

  return { success: true };
}

export { PROJECT_ROOT };
