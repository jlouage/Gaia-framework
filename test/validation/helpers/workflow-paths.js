import { execSync } from "child_process";
import { join } from "path";

/**
 * Discover all workflow.yaml files under _gaia/, excluding _backups/ and node_modules/.
 * Shared utility — used by workflows.test.js (E1-S1) and instruction-xml tests (E1-S4).
 *
 * @param {string} projectRoot - Absolute path to the project root containing _gaia/
 * @returns {string[]} Array of absolute paths to workflow.yaml files
 */
export function getWorkflowPaths(projectRoot) {
  const gaiaRoot = join(projectRoot, "_gaia");
  const result = execSync(
    `find -L "${gaiaRoot}" -name "workflow.yaml" -not -path "*/node_modules/*" -not -path "*/_backups/*"`,
    { encoding: "utf8" }
  );
  return result
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
}

/**
 * Known valid variable patterns used in workflow.yaml paths.
 * Maintained per E1-S1 AC3 + global.yaml variable definitions.
 */
export const VALID_VARIABLE_REFS = [
  "{project-root}",
  "{project-path}",
  "{installed_path}",
  "{planning_artifacts}",
  "{implementation_artifacts}",
  "{test_artifacts}",
  "{creative_artifacts}",
  "{data_path}",
  "{artifact_path}",
  "{plan_artifact_path}",
  "{memory_path}",
  "{checkpoint_path}",
  "{date}",
  "{story_key}",
  "{story_title_slug}",
  "{sprint_id}",
  "{spec_name}",
  "{cr_id}",
  "{version}",
  "{agent}",
];

/**
 * Resolve variables in a path using the workflow's own declared installed_path.
 * {project-root} resolves to projectRoot.
 * {installed_path} resolves from the workflow.yaml's installed_path field,
 * falling back to {project-root}/_gaia if not declared.
 */
export function resolveVariable(value, workflowPath, parsedConfig, projectRoot) {
  let installedPath = join(projectRoot, "_gaia");

  if (parsedConfig?.installed_path) {
    installedPath = parsedConfig.installed_path.replace(/\{project-root\}/g, projectRoot);
  }

  return value
    .replace(/\{installed_path\}/g, installedPath)
    .replace(/\{project-root\}/g, projectRoot);
}
