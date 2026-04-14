/**
 * E17-S5 / E25-S5: Bridge Layer 1 — Test Runner Discovery
 *
 * Second layer of the Test Execution Bridge (ADR-028, architecture §10.20).
 * Auto-discovers which test runners are configured for the project so the
 * correct runner can be invoked without manual configuration.
 *
 * E25-S5 refactor: all stack-specific logic (runner constants, detection
 * patterns, package.json scanning) has been moved to per-stack adapters
 * (_gaia/core/bridge/adapters/). Layer 1 now delegates to the adapter passed in
 * from Layer 0.
 *
 * Inputs (read-only):
 *   1. adapter — the stack adapter resolved by Layer 0 via getAdapter()
 *   2. projectPath — absolute path to the project root
 *   3. manifest — optional pre-existing manifest
 *
 * Layer 1 is strictly read-only — it parses configuration files and emits
 * a structured runner manifest for Layer 2. It NEVER executes test commands.
 *
 * Traces to: FR-196, FR-201, FR-307, ADR-028, ADR-038 | Test cases: TEB-21 to TEB-25
 */

// Re-export SUPPORTED_RUNNERS from the JS adapter as the canonical import
// point for the bridge compatibility guard (E17-S20, AC1).
export { SUPPORTED_RUNNERS } from "./adapters/js-adapter.js";

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RunnerManifestEntry
 * @property {string} runner_name   — canonical runner name (e.g., "vitest")
 * @property {string} command       — CLI command to invoke the runner
 * @property {string} source        — detection source (priority ranking key)
 * @property {object|null} tier_mapping — tier + gates mapping (from test-environment.yaml)
 *
 * @typedef {Object} DiscoveryResultOk
 * @property {"ok"} status
 * @property {RunnerManifestEntry} primary  — selected runner for Layer 2
 * @property {{ primary_runner: RunnerManifestEntry, runners: RunnerManifestEntry[] }} manifest
 *
 * @typedef {Object} DiscoveryResultDisambiguation
 * @property {"disambiguation"} status
 * @property {RunnerManifestEntry[]} candidates
 *
 * @typedef {Object} DiscoveryResultError
 * @property {"error"} status
 * @property {string} message
 */

/**
 * Discover the test runners configured for a project by delegating to the
 * stack adapter.
 *
 * @param {object} options
 * @param {string} options.projectPath — absolute path to the project root
 * @param {object} options.adapter — the stack adapter resolved by Layer 0
 * @param {object} [options.config] — resolved GAIA config; when
 *   `config.test_execution_bridge.bridge_enabled` is explicitly false the
 *   call short-circuits with `{ status: "ok", skipped: true }` (NFR-035).
 * @param {object} [options.manifest] — optional pre-existing manifest
 * @returns {Promise<DiscoveryResultOk | DiscoveryResultDisambiguation | DiscoveryResultError>}
 */
export async function discoverRunners({ projectPath, adapter, config = {}, manifest = {} } = {}) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("discoverRunners: projectPath is required");
  }

  // NFR-035 — honour the bridge_enabled opt-in toggle when present.
  if (config?.test_execution_bridge?.bridge_enabled === false) {
    return {
      status: "ok",
      skipped: true,
      primary: null,
      manifest: { primary_runner: null, runners: [] },
    };
  }

  if (!adapter) {
    return {
      status: "error",
      message:
        "No stack adapter provided. Layer 0 must resolve an adapter via getAdapter() before calling Layer 1.",
    };
  }

  // Delegate to the adapter's discoverRunners method
  return adapter.discoverRunners(projectPath, manifest);
}
