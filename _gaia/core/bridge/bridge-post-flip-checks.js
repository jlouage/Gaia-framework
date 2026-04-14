/**
 * bridge-post-flip-checks.js — Step 4 of /gaia-bridge-enable workflow.
 *
 * After /gaia-bridge-enable successfully flips test_execution_bridge.bridge_enabled
 * from false → true, this module performs a thin post-flip validation pass:
 *
 *   1. stat docs/test-artifacts/test-environment.yaml (filesystem stat — not dir listing)
 *   2. if present: validate against the FR-201 schema via the existing
 *      test-environment-validator (do NOT duplicate validation logic)
 *   3. if absent: return the 3-option next-step prompt payload (Path A — no auto-invoke)
 *
 * The module is a **pure composition** over existing components:
 *   - E17-S7 validator — imported from _gaia/core/validators/test-environment-validator.js
 *   - E17-S21 bridge-toggle — this module feeds its result into buildSummary()
 *
 * Scope guard (AC7): disable mode and idempotent (changed=false) hits return
 * kind=skipped — no filesystem I/O, no validator call, no prompt.
 *
 * Path A (ADR-028 §10.20.12.3): none of the 3 options auto-invoke any
 * sub-workflow. All three are next-step suggestions the user acts on in the
 * next turn — see POST_FLIP_ABSENT_OPTIONS.
 *
 * Traces: FR-317, FR-201, ADR-028 §10.20.12.2
 * Story: E17-S22
 */

import { readFileSync, statSync } from "fs";
import { join } from "path";

import { validateTestEnvironment } from "../validators/test-environment-validator.js";

// Canonical manifest location — per AC, resolved relative to {project-root},
// NOT {project-path}. Test artifacts live at the framework root.
const MANIFEST_RELATIVE_PATH = join("docs", "test-artifacts", "test-environment.yaml");

/**
 * The 3-option prompt payload for the absent-manifest branch.
 *
 * Path A (ADR-028 §10.20.12.3): every option has `autoInvoke: false`. The
 * workflow engine renders these options via its standard template-output
 * prompt; on user selection the engine stores the choice as `post_flip_prompt_choice`
 * and hands control back to Step 5 without spawning any sub-workflow.
 */
export const POST_FLIP_ABSENT_OPTIONS = Object.freeze([
  Object.freeze({
    key: "a",
    label:
      "Run `/gaia-brownfield` — auto-generates test-environment.yaml from your detected stack. Recommended for ongoing projects that haven't run brownfield yet. Run `/gaia-build-configs` before invoking.",
    autoInvoke: false,
  }),
  Object.freeze({
    key: "b",
    label:
      "Copy `docs/test-artifacts/test-environment.yaml.example` to `docs/test-artifacts/test-environment.yaml` and customize. The example file is installed at that path by gaia-install.sh.",
    autoInvoke: false,
  }),
  Object.freeze({
    key: "c",
    label:
      "Create `docs/test-artifacts/test-environment.yaml` manually using the example as a reference, then run `/gaia-build-configs`.",
    autoInvoke: false,
  }),
  Object.freeze({
    key: "d",
    label:
      "Skip — bridge is enabled but will fail-fast at Layer 1 with a clear error message until the manifest is created.",
    autoInvoke: false,
  }),
]);

/**
 * Stat a file — returns true if it exists and is a regular file.
 * Uses statSync directly to avoid listing the parent directory (per AC).
 */
function fileExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Run Step 4 post-flip checks.
 *
 * @param {object} params
 * @param {string} params.projectRoot  — absolute {project-root} path
 * @param {"enable"|"disable"} params.mode
 * @param {boolean} params.changed     — whether Step 3 actually wrote (state transition occurred)
 * @param {boolean} [params.yolo]      — YOLO mode auto-selects option (d) Skip on absent
 * @param {"a"|"b"|"c"|"d"} [params.choice] — pre-captured user choice (absent branch only, normal mode)
 *
 * @returns {PostFlipResult} one of:
 *   { kind: "skipped",        reason: string }
 *   { kind: "present_valid",  runners: Array<{name,command,tier,...}> }
 *   { kind: "present_invalid", errors: string[] }
 *   { kind: "absent",         options: typeof POST_FLIP_ABSENT_OPTIONS, choice?: "a"|"b"|"c"|"d", yoloAutoSkipped?: boolean }
 */
export function runPostFlipChecks({ projectRoot, mode, changed, yolo = false, choice }) {
  // AC7: disable mode skips Step 4 entirely — no prompt, no validation.
  if (mode === "disable") {
    return { kind: "skipped", reason: "disable-mode — post-flip checks only run on enable" };
  }

  // Test Scenario #6: idempotency guard — no state transition means no post-flip checks.
  // This is the "bridge already enabled" short-circuit from bridge-toggle Step 2.
  if (!changed) {
    return {
      kind: "skipped",
      reason: "no state transition (idempotent enable hit — bridge was already enabled)",
    };
  }

  const manifestPath = join(projectRoot, MANIFEST_RELATIVE_PATH);

  if (!fileExists(manifestPath)) {
    // AC3: absent — return the 4-option prompt payload.
    if (yolo) {
      // YOLO mode auto-selects option (d) Skip with a traceable warning.
      return {
        kind: "absent",
        options: POST_FLIP_ABSENT_OPTIONS,
        choice: "d",
        yoloAutoSkipped: true,
      };
    }
    return {
      kind: "absent",
      options: POST_FLIP_ABSENT_OPTIONS,
      ...(choice !== undefined ? { choice } : {}),
    };
  }

  // AC2 / AC5: manifest present — validate via existing E17-S7 validator.
  // Wrap in try/catch so any YAML parse exception is normalised into the
  // structured {valid: false, errors} shape (per Dev Notes).
  let content;
  try {
    content = readFileSync(manifestPath, "utf8");
  } catch (err) {
    return {
      kind: "present_invalid",
      errors: [`Failed to read test-environment.yaml: ${err.message}`],
    };
  }

  let validation;
  try {
    validation = validateTestEnvironment(content);
  } catch (err) {
    return {
      kind: "present_invalid",
      errors: [`Failed to validate test-environment.yaml: ${err.message}`],
    };
  }

  if (!validation.valid) {
    return {
      kind: "present_invalid",
      errors: validation.warnings || [],
    };
  }

  // AC2: collect runners for the post-toggle summary.
  // The validator does not return the parsed manifest directly, so re-parse
  // via a tiny extraction helper — we only need name + tier for the summary.
  const runners = extractRunnersForSummary(content);

  return { kind: "present_valid", runners };
}

/**
 * Extract `{name, tier}` tuples from a minimal YAML `runners:` list.
 * Used only for summary rendering — the authoritative schema validation
 * runs inside the E17-S7 validator. This helper is intentionally lax.
 */
function extractRunnersForSummary(content) {
  const runners = [];
  const lines = content.split("\n");
  let inRunners = false;
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (line.trim() === "") continue;

    if (/^runners:\s*$/.test(line)) {
      inRunners = true;
      continue;
    }

    if (inRunners) {
      // A new top-level key ends the runners block.
      if (/^[a-zA-Z_]/.test(line)) {
        if (current) runners.push(current);
        current = null;
        inRunners = false;
        continue;
      }

      const itemMatch = line.match(/^\s*-\s+name:\s*(.+)$/);
      if (itemMatch) {
        if (current) runners.push(current);
        current = { name: stripQuotes(itemMatch[1].trim()) };
        continue;
      }

      const fieldMatch = line.match(/^\s+(\w+):\s*(.+)$/);
      if (fieldMatch && current) {
        const key = fieldMatch[1];
        const value = stripQuotes(fieldMatch[2].trim());
        if (key === "tier") {
          const n = parseInt(value, 10);
          current.tier = Number.isNaN(n) ? value : n;
        } else if (key === "name" || key === "command") {
          current[key] = value;
        }
      }
    }
  }

  if (current) runners.push(current);
  return runners;
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * @typedef {Object} PostFlipResult
 * @property {"skipped"|"present_valid"|"present_invalid"|"absent"} kind
 * @property {string}   [reason]
 * @property {Array<{name:string, tier?:number|string, command?:string}>} [runners]
 * @property {string[]} [errors]
 * @property {ReadonlyArray<{key:string,label:string,autoInvoke:boolean}>} [options]
 * @property {"a"|"b"|"c"} [choice]
 * @property {boolean}  [yoloAutoSkipped]
 */
