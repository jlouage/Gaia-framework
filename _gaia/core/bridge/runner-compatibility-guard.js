/**
 * E17-S20: Bridge Runner Compatibility Guard
 *
 * Pre-Layer-0 guard that validates test runners declared in
 * test-environment.yaml against the bridge's SUPPORTED_RUNNERS set.
 * Provides clear remediation messages for unsupported runners and
 * graceful degradation (warning + partial execution) for mixed stacks.
 *
 * This guard is strictly READ-ONLY — it never modifies test-environment.yaml,
 * never mutates project files, and never executes runner commands. It only
 * reads the manifest, classifies runners, writes an evidence stub on halt,
 * and either halts or returns.
 *
 * Retirement trigger: when AF-2026-04-10-2 / E25 merges, this guard may be
 * expanded or retired — see E25-S5 Dev Notes blocks_retirement_of: [E17-S20].
 *
 * Traces to: FR-196, FR-203, T36 | Test cases: TEB-41, TEB-42, TEB-43
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { SUPPORTED_RUNNERS } from "./layer-1-test-runner-discovery.js";

// Re-export for test consumption
export { SUPPORTED_RUNNERS };

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Load and parse test-environment.yaml, extracting the runners list.
 * Uses a minimal YAML parser — only needs the `runners:` array.
 *
 * @param {string} manifestPath - Absolute path to test-environment.yaml
 * @returns {{ runners: string[], bridgeEnabled: boolean } | null}
 */
function loadManifestRunners(manifestPath) {
  if (!existsSync(manifestPath)) return null;

  let content;
  try {
    content = readFileSync(manifestPath, "utf-8");
  } catch {
    return null;
  }

  // Parse bridge_enabled
  const bridgeEnabledMatch = content.match(/^bridge_enabled:\s*(true|false)/m);
  const bridgeEnabled = bridgeEnabledMatch ? bridgeEnabledMatch[1] === "true" : false;

  // Parse runners array — handles both inline [a, b] and block - a\n- b forms
  const inlineMatch = content.match(/^runners:\s*\[([^\]]*)\]/m);
  if (inlineMatch) {
    const runners = inlineMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    return { runners, bridgeEnabled };
  }

  // Block form: runners:\n  - vitest\n  - pytest
  const blockMatch = content.match(/^runners:\s*\n((?:\s+-\s+\S+\n?)+)/m);
  if (blockMatch) {
    const runners = blockMatch[1]
      .split("\n")
      .map((line) =>
        line
          .replace(/^\s+-\s+/, "")
          .trim()
          .replace(/^["']|["']$/g, "")
      )
      .filter(Boolean);
    return { runners, bridgeEnabled };
  }

  return { runners: [], bridgeEnabled };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Check whether declared runners in test-environment.yaml are compatible
 * with the bridge's SUPPORTED_RUNNERS allowlist.
 *
 * @param {object} options
 * @param {string} options.manifestPath - Absolute path to test-environment.yaml
 * @param {string} options.storyKey - Story key for evidence file naming
 * @param {object} [options.config] - Resolved GAIA config
 * @returns {{ status: 'supported' | 'partial' | 'unsupported' | 'skipped', supported: string[], unsupported: string[], messages: string[] }}
 */
export function checkRunnerCompatibility({ manifestPath, storyKey, config = {} } = {}) {
  // No-op when bridge is disabled
  if (config?.test_execution_bridge?.bridge_enabled === false) {
    return { status: "skipped", supported: [], unsupported: [], messages: [] };
  }

  // No-op when manifest is absent — manifest-absent handling is FR-201 / E17-S7 territory
  const manifest = loadManifestRunners(manifestPath);
  if (!manifest) {
    return { status: "skipped", supported: [], unsupported: [], messages: [] };
  }

  // No-op when bridge is not enabled in the manifest
  if (!manifest.bridgeEnabled) {
    return { status: "skipped", supported: [], unsupported: [], messages: [] };
  }

  const { runners } = manifest;
  if (!runners || runners.length === 0) {
    return { status: "supported", supported: [], unsupported: [], messages: [] };
  }

  const supported = runners.filter((r) => SUPPORTED_RUNNERS.includes(r));
  const unsupported = runners.filter((r) => !SUPPORTED_RUNNERS.includes(r));

  // AC6: All supported — silent pass
  if (unsupported.length === 0) {
    return { status: "supported", supported, unsupported: [], messages: [] };
  }

  // AC3: All unsupported — halt with remediation message
  if (supported.length === 0) {
    const messages = unsupported.map(
      (runner) =>
        `test-environment.yaml declares runner '${runner}' which is not yet supported by the bridge. ` +
        `Supported runners: ${JSON.stringify(SUPPORTED_RUNNERS)}. ` +
        `Track multi-stack support in epic E25 (AF-2026-04-10-2). ` +
        `For now, set bridge_enabled: false or remove the unsupported runner.`
    );
    return { status: "unsupported", supported: [], unsupported, messages };
  }

  // AC5: Mixed — warning, proceed with supported subset
  const messages = [
    `WARNING: test-environment.yaml declares runner(s) not yet supported by the bridge: ${JSON.stringify(unsupported)}. ` +
      `These will be skipped. Supported runners proceeding: ${JSON.stringify(supported)}. ` +
      `Track multi-stack support in epic E25 (AF-2026-04-10-2).`,
  ];
  return { status: "partial", supported, unsupported, messages };
}

/**
 * Write a minimal evidence stub for unsupported or partial runner scenarios.
 * Reuses the evidence file convention from E17-S10.
 *
 * @param {object} options
 * @param {string} options.storyKey - Story key for evidence file naming
 * @param {string} options.bridgeStatus - "unsupported_runner" | "partial"
 * @param {string[]} options.unsupportedRunners - List of unsupported runner names
 * @param {string[]} [options.supportedRunners] - List of supported runner names (for partial)
 * @param {string} [options.manifestPath] - Path to the manifest that was checked
 * @param {string} options.outputDir - Base directory for test-results/
 * @returns {string} Absolute path to the written evidence file
 */
export function writeCompatibilityEvidence({
  storyKey,
  bridgeStatus,
  unsupportedRunners,
  supportedRunners = [],
  manifestPath = "",
  outputDir,
}) {
  if (!storyKey || !outputDir) {
    throw new TypeError("writeCompatibilityEvidence: storyKey and outputDir are required");
  }

  const evidence = {
    schema_version: "1.0",
    story_key: storyKey,
    bridge_status: bridgeStatus,
    unsupported_runners: unsupportedRunners,
    ...(bridgeStatus === "partial"
      ? { skipped_runners: unsupportedRunners, supported_runners: supportedRunners }
      : {}),
    manifest_path: manifestPath,
    timestamp: new Date().toISOString(),
  };

  const resultsDir = join(outputDir, "test-results");
  try {
    mkdirSync(resultsDir, { recursive: true });
  } catch {
    // Non-blocking on mkdir failure — log and continue (AC4)
  }

  const filePath = join(resultsDir, `${storyKey}-execution.json`);
  try {
    writeFileSync(filePath, JSON.stringify(evidence, null, 2), "utf-8");
  } catch {
    // Best-effort write
  }
  return filePath;
}
