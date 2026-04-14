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
 * Canonical test_execution_bridge block appended when the section is absent
 * and the user runs /gaia-bridge-enable. Kept intentionally minimal — matches
 * the structure documented in ADR-028 §10.20 without inventing extra keys.
 */
const CANONICAL_BRIDGE_BLOCK = `
# Test Execution Bridge (ADR-028, FR-202, NFR-035)
# Opt-in subsystem that runs tests during the post-review phase.
test_execution_bridge:
  # Master switch. false = bridge completely inactive.
  bridge_enabled: true
`;

/**
 * Toggle the bridge_enabled flag in global.yaml.
 *
 * Uses regex-based in-place edit targeting only the bridge_enabled: line
 * within the test_execution_bridge: parent scope. This preserves all YAML
 * comments, key ordering, and formatting (js-yaml strips comments on round-trip).
 *
 * When the test_execution_bridge section is absent:
 *   - enable mode appends the canonical block and reports changed=true, created=true
 *   - disable mode is a no-op (bridge is logically disabled) and returns changed=false
 *
 * @param {string} yamlPath — absolute path to global.yaml
 * @param {"enable"|"disable"} mode — target mode
 * @returns {{ changed: boolean, previousState: boolean, newState: boolean, created?: boolean }}
 */
export function toggleBridge(yamlPath, mode) {
  const targetValue = mode === "enable";
  const content = readFileSync(yamlPath, "utf8");

  if (!hasBridgeSection(content)) {
    // Section absent: Step 1 treats this as bridge_enabled=false (AC3 default).
    if (mode === "disable") {
      // Already logically disabled — zero-byte no-op.
      return {
        changed: false,
        previousState: false,
        newState: false,
        absent: true,
      };
    }

    // enable + absent: append the canonical block.
    const needsLeadingNewline = content.length > 0 && !content.endsWith("\n");
    const updated = content + (needsLeadingNewline ? "\n" : "") + CANONICAL_BRIDGE_BLOCK;
    writeFileSync(yamlPath, updated, "utf8");
    return {
      changed: true,
      previousState: false,
      newState: true,
      created: true,
    };
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
 * @param {object} result
 * @param {boolean} result.previousState
 * @param {boolean} result.newState
 * @param {string}  result.mode
 * @param {boolean} result.changed
 * @param {object}  [result.postFlipResult] — E17-S22 Step 4 output. One of:
 *   { kind: "skipped",         reason: string }
 *   { kind: "present_valid",   runners: Array<{name,tier?}> }
 *   { kind: "present_invalid", errors: string[] }
 *   { kind: "absent",          choice: "a"|"b"|"c"|"d", options?, yoloAutoSkipped? }
 * @returns {string} formatted summary
 */
export function buildSummary(result) {
  const { previousState, newState, mode, changed, created, absent, postFlipResult } = result;

  if (!changed) {
    const stateWord = mode === "enable" ? "enabled" : "disabled";
    if (mode === "disable" && absent) {
      return "Bridge is already disabled — no changes made.";
    }
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

  const headline = created
    ? "Created test_execution_bridge section with bridge_enabled: true."
    : `Bridge ${mode}d successfully.`;

  const lines = [
    headline,
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| Previous state | ${previousState} |`,
    `| New state | ${newState} |`,
    `| Mode | ${mode} |`,
  ];

  // E17-S22: render the post-flip-check result in enable mode. On disable,
  // Step 4 is skipped entirely (AC7) and we emit no post-flip-check output.
  if (mode === "enable" && postFlipResult && postFlipResult.kind !== "skipped") {
    lines.push("");
    lines.push(...renderPostFlipSection(postFlipResult));
  }

  // AC6: summary always ends with the /gaia-build-configs next-step suggestion,
  // regardless of which branch Step 4 took.
  lines.push("");
  lines.push("**Next steps:**");
  lines.push(
    "1. Run `/gaia-build-configs` to regenerate the resolved configs so the bridge_enabled change takes effect."
  );

  return lines.join("\n");
}

/**
 * Render the post-flip-check section of the summary based on the E17-S22
 * structured result shape. Pattern-matches on `kind`.
 */
function renderPostFlipSection(postFlipResult) {
  const out = ["**Post-flip checks:**"];

  switch (postFlipResult.kind) {
    case "present_valid": {
      const runners = postFlipResult.runners || [];
      out.push("");
      out.push(
        `test-environment.yaml validated successfully — ${runners.length} runner(s) detected:`
      );
      out.push("");
      out.push("| Runner | Tier |");
      out.push("|--------|------|");
      for (const r of runners) {
        out.push(`| ${r.name ?? "?"} | ${r.tier ?? "—"} |`);
      }
      break;
    }

    case "present_invalid": {
      const errors = postFlipResult.errors || [];
      out.push("");
      out.push(
        `WARNING: test-environment.yaml exists but failed schema validation (${errors.length} issue(s)).`
      );
      out.push(
        "The bridge_enabled flag was NOT rolled back — fix the manifest and re-run `/gaia-build-configs`."
      );
      out.push("");
      for (const e of errors) {
        out.push(`- ${e}`);
      }
      break;
    }

    case "absent": {
      out.push("");
      out.push(
        "`docs/test-artifacts/test-environment.yaml` was not found. The bridge is enabled, but Layer 1 will fail-fast at invocation time until the manifest is created."
      );

      if (postFlipResult.yoloAutoSkipped) {
        out.push("");
        out.push(
          "YOLO mode auto-selected option (d) **Skip** — bridge is enabled but the manifest is missing."
        );
      }

      if (postFlipResult.choice) {
        out.push("");
        out.push("**Selected option:**");
        switch (postFlipResult.choice) {
          case "a":
            out.push(
              "- [a] Run `/gaia-brownfield` in your next turn to auto-generate test-environment.yaml."
            );
            break;
          case "b":
            out.push(
              "- [b] Copy `docs/test-artifacts/test-environment.yaml.example` to `docs/test-artifacts/test-environment.yaml` and customize."
            );
            break;
          case "c":
            out.push(
              "- [c] Create `docs/test-artifacts/test-environment.yaml` manually using the example as a reference, then run `/gaia-build-configs`."
            );
            break;
          case "d":
            out.push(
              "- [d] Skip — bridge enabled without manifest. Layer 1 will fail-fast until the file is created."
            );
            break;
        }
      } else {
        // No choice captured — emit the 4-option prompt body so the engine
        // can render it verbatim via its template-output / ask machinery.
        out.push("");
        out.push("**Options:**");
        out.push(
          "- [a] Run `/gaia-brownfield` — auto-generates test-environment.yaml from your detected stack"
        );
        out.push(
          "- [b] Copy `docs/test-artifacts/test-environment.yaml.example` to `docs/test-artifacts/test-environment.yaml` and customize"
        );
        out.push(
          "- [c] Create `docs/test-artifacts/test-environment.yaml` manually using the example as a reference"
        );
        out.push(
          "- [d] Skip — bridge is enabled but will fail-fast at Layer 1 with a clear error message until the manifest is created"
        );
      }
      break;
    }

    default:
      // Unknown kind — emit nothing beyond the header.
      out.push("");
      out.push(`_Unrecognised post-flip result kind: ${postFlipResult.kind}_`);
  }

  return out;
}
