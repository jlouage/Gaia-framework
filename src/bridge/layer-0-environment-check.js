/**
 * E17-S4 / E25-S5: Bridge Layer 0 — Environment Readiness Check
 *
 * First layer of the Test Execution Bridge (ADR-028, architecture §10.20).
 * Verifies that the local environment is ready to run tests before any runner
 * is invoked. On all-pass, emits a readiness report and advances to Layer 1.
 * On any failure, halts and emits a remediation message.
 *
 * E25-S5 refactor: all stack-specific logic has been moved to per-stack
 * adapters (src/bridge/adapters/). Layer 0 now delegates to the adapter
 * resolved by the registry's getAdapter().
 *
 * Bridge scope: orchestrate only — this module does NOT modify project files
 * (FR-203). All checks are read-only.
 *
 * Traces to: FR-192, FR-307, NFR-033 (<5s), NFR-035 (bridge_enabled guard), ADR-028, ADR-038
 */

import { getAdapter } from "./adapters/index.js";

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the Layer 0 environment readiness checks by delegating to the
 * stack adapter resolved for the given projectPath.
 *
 * @param {object} options
 * @param {string} options.projectPath - Absolute path to the project root.
 * @param {object} [options.config] - Resolved GAIA config. Layer 0 reads
 *   `config.test_execution_bridge.bridge_enabled`; when explicitly false, all
 *   checks are skipped and the call returns `{ skipped: true, ready: true }`
 *   (NFR-035).
 * @returns {{
 *   ready: boolean,
 *   skipped: boolean,
 *   checks: Array<object>,
 *   remediations: string[],
 *   report: string,
 *   elapsedMs: number,
 *   adapter: object|null,
 * }}
 */
export function checkEnvironmentReadiness({ projectPath, config = {} } = {}) {
  const started = Date.now();

  // AC5 / NFR-035 — bridge_enabled guard
  if (config?.test_execution_bridge?.bridge_enabled === false) {
    return {
      ready: true,
      skipped: true,
      checks: [],
      remediations: [],
      report: "",
      elapsedMs: Date.now() - started,
      adapter: null,
    };
  }

  if (!projectPath || typeof projectPath !== "string") {
    throw new TypeError("checkEnvironmentReadiness: projectPath is required");
  }

  // Resolve the adapter for this project via the registry
  const adapter = getAdapter(projectPath);

  if (!adapter) {
    const elapsedMs = Date.now() - started;
    return {
      ready: false,
      skipped: false,
      checks: [],
      remediations: [
        `No stack adapter matched for project at ${projectPath}. ` +
        "Ensure the project contains a recognized stack marker file " +
        "(e.g., package.json for JavaScript projects).",
      ],
      report:
        "Bridge Layer 0 — Environment Readiness\n" +
        "──────────────────────────────────────\n" +
        "  FAIL  No matching stack adapter found\n" +
        "──────────────────────────────────────\n" +
        `  Overall: NOT READY  (${elapsedMs}ms)`,
      elapsedMs,
      adapter: null,
    };
  }

  // Delegate to the adapter's readinessCheck
  const result = adapter.readinessCheck(projectPath, config);
  return { ...result, adapter };
}
