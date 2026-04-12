/**
 * E25-S5: Bridge Orchestrator
 *
 * Thin orchestrator that wires the four-layer bridge protocol together.
 * This module coordinates Layer 0 (readiness), Layer 1 (discovery),
 * Layer 2 (execution), and Layer 3 (parsing + evidence) into a single
 * runBridge() call for test automation and regression testing.
 *
 * Traces to: FR-307, ADR-028, ADR-038
 */

import { checkEnvironmentReadiness } from "./layer-0-environment-check.js";
import { discoverRunners } from "./layer-1-test-runner-discovery.js";
import { parseResults, writeEvidence, deriveVerdict } from "./layer-3-result-parsing.js";

/**
 * Run the full bridge pipeline: readiness check, runner discovery,
 * result parsing, and evidence generation.
 *
 * Note: Layer 2 (execution) is NOT invoked here — the caller must provide
 * pre-captured execution output when running in test/regression mode.
 * For live execution, callers should invoke Layer 2 separately.
 *
 * @param {object} options
 * @param {string} options.projectPath - Absolute path to the project root
 * @param {string} options.storyKey - Story key for evidence file naming
 * @param {object} [options.config] - Resolved GAIA config
 * @param {object} [options.executionOutput] - Pre-captured Layer 2 output
 *   { stdout, stderr, exit_code, runner }. If provided, Layer 3 parses it.
 * @param {string} [options.outputDir] - Base directory for evidence files
 * @returns {Promise<object>}
 */
export async function runBridge({ projectPath, storyKey, config = {}, executionOutput, outputDir } = {}) {
  // Layer 0: Environment readiness
  const readiness = checkEnvironmentReadiness({ projectPath, config });
  if (!readiness.ready) {
    return {
      status: "not-ready",
      readiness,
      evidence: null,
    };
  }

  const adapter = readiness.adapter;

  // Layer 1: Runner discovery
  const discovery = await discoverRunners({ projectPath, adapter, config });
  if (discovery.status === "error") {
    return {
      status: "discovery-error",
      readiness,
      discovery,
      evidence: null,
    };
  }

  // Layer 3: Parse results (if execution output provided)
  if (executionOutput) {
    const parsed = parseResults(executionOutput, adapter);
    const verdict = deriveVerdict(parsed);

    let evidencePath = null;
    if (outputDir) {
      evidencePath = writeEvidence({
        parsed,
        storyKey,
        runner: executionOutput.runner || discovery.primary?.runner_name || "unknown",
        mode: "local",
        durationSeconds: 0,
        outputDir,
        tier: null,
      });
    }

    return {
      status: "complete",
      readiness,
      discovery,
      parsed,
      verdict,
      evidencePath,
      evidence: parsed,
    };
  }

  return {
    status: "ready",
    readiness,
    discovery,
    adapter,
  };
}
