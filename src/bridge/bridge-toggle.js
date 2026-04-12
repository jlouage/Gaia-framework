/**
 * bridge-toggle.js — Bridge toggle utility for /gaia-bridge-enable and /gaia-bridge-disable
 *
 * Reads, checks idempotency, and writes the test_execution_bridge.bridge_enabled flag
 * in global.yaml using a regex-based in-place edit that preserves all YAML comments,
 * key ordering, and formatting.
 *
 * Traces: FR-316, ADR-028 §10.20.12
 * Story: E17-S21
 */

import { readFileSync, writeFileSync } from "fs";

// Shared regex patterns for test_execution_bridge section parsing
const SECTION_EXISTS_RE = /^test_execution_bridge:/m;
const BRIDGE_VALUE_RE = /^test_execution_bridge:[\s\S]*?^\s+bridge_enabled:\s*(true|false)/m;
const BRIDGE_KEY_RE = /^(test_execution_bridge:[\s\S]*?)(^\s+bridge_enabled:\s*)(true|false)(.*)/m;
const BRIDGE_LINE_RE = /^(\s+bridge_enabled:\s*)(true|false)/m;

/**
 * Check whether the test_execution_bridge section exists in a YAML string.
 * @param {string} content — raw YAML file content
 * @returns {boolean}
 */
function hasBridgeSection(content) {
  return SECTION_EXISTS_RE.test(content);
}

/**
 * Read the current bridge_enabled state from global.yaml.
 * Returns false if the test_execution_bridge section or bridge_enabled key is absent (AC3).
 *
 * @param {string} yamlPath — absolute path to global.yaml
 * @returns {boolean} current bridge_enabled value
 */
export function readBridgeState(yamlPath) {
  const content = readFileSync(yamlPath, "utf8");

  if (!hasBridgeSection(content)) {
    return false;
  }

  const match = content.match(BRIDGE_VALUE_RE);
  if (!match) {
    return false;
  }

  return match[1] === "true";
}

/**
 * Toggle the bridge_enabled flag in global.yaml.
 *
 * Uses regex-based in-place edit targeting only the bridge_enabled: line
 * within the test_execution_bridge: parent scope. This preserves all YAML
 * comments, key ordering, and formatting (js-yaml strips comments on round-trip).
 *
 * @param {string} yamlPath — absolute path to global.yaml
 * @param {"enable"|"disable"} mode — target mode
 * @returns {{ changed: boolean, previousState: boolean, newState: boolean }}
 */
export function toggleBridge(yamlPath, mode) {
  const targetValue = mode === "enable";
  const content = readFileSync(yamlPath, "utf8");

  if (!hasBridgeSection(content)) {
    throw new Error(
      "test_execution_bridge section is missing from global.yaml. " +
        "The section must exist before toggling. Run /gaia-bridge-enable after " +
        "adding the test_execution_bridge block (see ADR-028 §10.20.7)."
    );
  }

  const match = content.match(BRIDGE_KEY_RE);

  if (!match) {
    throw new Error(
      "bridge_enabled key not found within the test_execution_bridge section. " +
        "Add `bridge_enabled: false` under test_execution_bridge in global.yaml."
    );
  }

  const previousState = match[3] === "true";

  // Idempotency check: if already in target state, return without writing
  if (previousState === targetValue) {
    return {
      changed: false,
      previousState,
      newState: previousState,
    };
  }

  // Regex-based in-place edit: replace only the bridge_enabled value
  // Preserves inline comments on the same line
  const updated = content.replace(BRIDGE_LINE_RE, `$1${targetValue}`);

  writeFileSync(yamlPath, updated, "utf8");

  return {
    changed: true,
    previousState,
    newState: targetValue,
  };
}

/**
 * Build a human-readable post-toggle summary.
 *
 * @param {{ previousState: boolean, newState: boolean, mode: string, changed: boolean }} result
 * @returns {string} formatted summary
 */
export function buildSummary(result) {
  const { previousState, newState, mode, changed } = result;

  if (!changed) {
    const stateWord = mode === "enable" ? "enabled" : "disabled";
    return [
      `Bridge already ${stateWord}.`,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Current state | ${newState} |`,
      `| Requested | ${mode} |`,
      `| Action | none (idempotent) |`,
      "",
      "No changes were made to global.yaml.",
    ].join("\n");
  }

  const lines = [
    `Bridge ${mode}d successfully.`,
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| Previous state | ${previousState} |`,
    `| New state | ${newState} |`,
    `| Mode | ${mode} |`,
  ];

  // Step 4 placeholder: enable mode only (E17-S22 will fill this in)
  if (mode === "enable") {
    lines.push("");
    lines.push(
      "**Post-flip checks:** _Stub — E17-S22 will add test-environment.yaml validation here._"
    );
  }

  lines.push("");
  lines.push("**Next steps:**");
  lines.push(
    "1. Run `/gaia-build-configs` to regenerate the resolved configs so the bridge_enabled change takes effect."
  );

  return lines.join("\n");
}
