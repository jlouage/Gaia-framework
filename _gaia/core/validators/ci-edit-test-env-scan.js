/**
 * ci-edit Remove Safety Scan — test-environment.yaml target (E20-S10, AC5)
 *
 * Scans a `test-environment.yaml` payload for tier entries that reference a
 * given promotion chain environment id via `promotion_chain_env_id`, so the
 * `/gaia-ci-edit` remove operation (E20-S4) can surface impacted tiers and
 * warn the user before deleting an environment from `ci_cd.promotion_chain`.
 *
 * This module intentionally does NOT rely on a full YAML parser — it uses a
 * minimal line-based scanner tuned to the manifest schema (flat runner list
 * with scalar fields). This keeps the scan dependency-free and resilient to
 * partial manifests.
 *
 * Architecture references:
 *   - ADR-033: Multi-Environment Promotion Chain
 *   - §10.24.4: /gaia-ci-edit cascade updates
 *
 * @module ci-edit-test-env-scan
 */

/**
 * Scan a test-environment.yaml content string for tier entries that reference
 * the given environment id.
 *
 * @param {string|null|undefined} content — The raw YAML content.
 * @param {string} targetEnvId — The id being removed from the promotion chain.
 * @returns {string[]} List of tier/runner names that reference the id. Empty
 *   list if nothing matches, the content is empty, or the target id is falsy.
 */
export function scanTestEnvironmentForEnvId(content, targetEnvId) {
  if (!content || typeof content !== "string") return [];
  if (!targetEnvId) return [];

  const lines = content.split("\n");
  const references = [];
  let currentRunnerName = null;

  for (const rawLine of lines) {
    // Strip trailing comments and whitespace
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (line.trim() === "") continue;

    const trimmed = line.trimStart();

    // Detect a new runner entry: "- name: <value>"
    const runnerNameMatch = trimmed.match(/^-\s+name:\s*(.+)$/);
    if (runnerNameMatch) {
      currentRunnerName = stripQuotes(runnerNameMatch[1].trim());
      continue;
    }

    // Detect an indented "name:" line for the current runner (alternative form)
    const altNameMatch = trimmed.match(/^name:\s*(.+)$/);
    if (altNameMatch && !trimmed.startsWith("- ")) {
      // Only honor if we're already inside a runner block (indent > 0)
      const indent = line.length - line.trimStart().length;
      if (indent > 0) {
        currentRunnerName = stripQuotes(altNameMatch[1].trim());
      }
      continue;
    }

    // Detect "promotion_chain_env_id: <value>" within the current runner
    const envIdMatch = trimmed.match(/^promotion_chain_env_id:\s*(.+)$/);
    if (envIdMatch && currentRunnerName) {
      const value = stripQuotes(envIdMatch[1].trim());
      if (value === targetEnvId) {
        references.push(currentRunnerName);
      }
    }
  }

  return references;
}

/**
 * Strip surrounding single or double quotes from a YAML scalar value.
 * @param {string} value
 * @returns {string}
 */
function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
