/**
 * E25-S5: Stack Adapter Registry
 *
 * Central registry for per-stack adapters consumed by the four-layer protocol.
 * All imports are static ES modules — no dynamic loading, no runtime plugin
 * discovery. This is architecture §10.20.11.4's "trust boundary" requirement.
 *
 * Built-in adapters (priority order per §10.20.11.2):
 *   javascript → python → java → go → flutter
 * E25-S3..E25-S4 will add go and flutter adapters.
 *
 * Traces to: FR-307, FR-309, NFR-047, ADR-028, ADR-038, T37
 */

import { existsSync } from "fs";
import { join } from "path";
import jsAdapter from "./js-adapter.js";
import pythonAdapter from "./python-adapter.js";
import javaAdapter from "./java-adapter.js";
import goAdapter from "./go-adapter.js";
import flutterAdapter from "./flutter-adapter.js";

// ─── StackAdapter contract typedef ──────────────────────────────────────────

/**
 * @typedef {Object} StackAdapter
 * @property {string} name - Unique adapter name (e.g., "javascript", "python")
 * @property {string[]} detectionPatterns - File patterns that identify this stack
 *   (all must match for getAdapter to select this adapter)
 * @property {function(string, object=): object} readinessCheck - Layer 0 readiness
 * @property {function(string, object=): Promise<object>} discoverRunners - Layer 1 discovery
 * @property {function(string, string, number): object} parseOutput - Layer 3 parsing
 */

// ─── Contract validation (AC7) ──────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "name",
  "detectionPatterns",
  "readinessCheck",
  "discoverRunners",
  "parseOutput",
];

/**
 * Validate that an adapter satisfies the StackAdapter contract.
 * Throws with a clear message naming the missing field and the module path.
 *
 * @param {object} adapter - The adapter to validate
 * @param {string} modulePath - Path of the adapter module (for error messages)
 * @throws {Error} If any required field is missing or undefined
 */
export function validateAdapter(adapter, modulePath) {
  if (!adapter || typeof adapter !== "object") {
    throw new Error(`Adapter contract violation in ${modulePath}: adapter is not an object`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (adapter[field] === undefined || adapter[field] === null) {
      throw new Error(`Adapter contract violation in ${modulePath}: missing field: ${field}`);
    }
  }
}

// ─── Registry initialization (loud failure at import time) ──────────────────

// Validate all imported adapters at module top-level so contract violations
// fail at import time (AC7). No silent skips, no partial registration.
validateAdapter(jsAdapter, "./js-adapter.js");
validateAdapter(pythonAdapter, "./python-adapter.js");
validateAdapter(javaAdapter, "./java-adapter.js");
validateAdapter(goAdapter, "./go-adapter.js");
validateAdapter(flutterAdapter, "./flutter-adapter.js");

/**
 * Built-in adapters in deterministic priority order (§10.20.11.2).
 * Order: javascript → python → java → go → flutter.
 * @type {StackAdapter[]}
 */
const ADAPTERS = [jsAdapter, pythonAdapter, javaAdapter, goAdapter, flutterAdapter];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Return all registered adapters in deterministic priority order.
 *
 * @returns {StackAdapter[]}
 */
export function listAdapters() {
  return ADAPTERS;
}

// ─── E25-S6: per-stack tier mapping resolver ────────────────────────────────

/**
 * Map a test-environment.yaml `tiers.stack_hints` key to the adapter name
 * whose hints it targets. (E25-S6, FR-312)
 */
const STACK_HINT_ADAPTER_KEY = Object.freeze({
  python: "pytest_markers",
  java: "gradle_tasks",
  go: "go_build_tags",
  flutter: "flutter_suites",
});

/**
 * Resolve tier mappings for every active adapter in the project and return a
 * namespaced block keyed by adapter name. Each adapter's `resolveTierMapping`
 * is called with the matching hint block from `tiers.stack_hints` (or no
 * hints at all, in which case the adapter falls back to its own defaults).
 *
 * Adapters that do not expose `resolveTierMapping` (e.g. the JS adapter —
 * preserved byte-identically per AC5) are skipped silently. Adapters that
 * are not active (detectionPatterns do not match the project layout) are
 * reported in an `unusedHints` array so callers can emit an INFO log per the
 * story's Dev Notes ("unused stack_hints for inactive stack: go").
 *
 * Deterministic iteration order (AC4): adapters are processed in the
 * registry's priority order (javascript → python → java → go → flutter),
 * so multi-stack gate resolution is reproducible run-to-run.
 *
 * Traces: FR-312, ADR-028, ADR-038 §10.20.11.
 *
 * @param {string} projectPath - Absolute project root
 * @param {object} [stackHintsBlock] - Parsed `tiers.stack_hints` object from
 *   the project's `test-environment.yaml` (may be null / undefined).
 * @returns {{
 *   perStack: Object<string, { active: boolean, mapping?: object, entries?: Array }>,
 *   unusedHints: string[]
 * }}
 */
export function resolveAllTierMappings(projectPath, stackHintsBlock) {
  const hints = stackHintsBlock && typeof stackHintsBlock === "object" ? stackHintsBlock : {};
  const perStack = {};
  const unusedHints = [];

  // Determine which adapters are active by running detection against the
  // project root — mirrors getAdapter() semantics but returns ALL matching
  // adapters (a monorepo with two languages gets two active adapters).
  const isActive = (adapter) => {
    const mode = adapter.detectionMode === "any" ? "any" : "all";
    const matcher = (pattern) => existsSync(join(projectPath, pattern));
    return mode === "any"
      ? adapter.detectionPatterns.some(matcher)
      : adapter.detectionPatterns.every(matcher);
  };

  for (const adapter of ADAPTERS) {
    const active = isActive(adapter);
    const hintKey = STACK_HINT_ADAPTER_KEY[adapter.name];
    const adapterHints = hintKey ? hints[hintKey] : undefined;

    if (!active) {
      if (adapterHints !== undefined && hintKey) {
        // Dev Notes edge case: hint present but stack is not active —
        // silently ignore the hint but record an INFO-level entry so
        // callers can surface "unused stack_hints for inactive stack: X".
        unusedHints.push(adapter.name);
      }
      perStack[adapter.name] = { active: false };
      continue;
    }

    // Active adapter — skip if it does not expose resolveTierMapping
    // (e.g. the JS adapter, which preserves its E17-S12 byte-identical
    // gate semantics per AC5).
    if (typeof adapter.resolveTierMapping !== "function") {
      perStack[adapter.name] = { active: true, mapping: null, entries: [] };
      continue;
    }

    try {
      const result = adapter.resolveTierMapping(projectPath, {
        stackHints: adapterHints,
      });
      perStack[adapter.name] = {
        active: true,
        mapping: result.mapping,
        entries: result.entries || [],
      };
    } catch (err) {
      // A misbehaving adapter must not break multi-stack resolution for
      // the rest of the registry — record the failure and continue.
      perStack[adapter.name] = {
        active: true,
        mapping: null,
        entries: [],
        error: err?.message ?? String(err),
      };
    }
  }

  return { perStack, unusedHints };
}

/**
 * Return the first adapter whose detectionPatterns all match the project.
 * Returns null if no adapter matches.
 *
 * @param {string} projectPath - Absolute path to the project root
 * @returns {StackAdapter|null}
 */
export function getAdapter(projectPath) {
  for (const adapter of ADAPTERS) {
    // Per-adapter detection semantics: default is ALL (every pattern must
    // match) which preserves js-adapter behavior. Adapters with
    // detectionMode === "any" match if ANY pattern exists — required for
    // pytest where pyproject.toml / pytest.ini / setup.cfg / setup.py are
    // OR'd per E25-S1 Dev Notes.
    const mode = adapter.detectionMode === "any" ? "any" : "all";
    const matcher = (pattern) => existsSync(join(projectPath, pattern));
    const matched =
      mode === "any"
        ? adapter.detectionPatterns.some(matcher)
        : adapter.detectionPatterns.every(matcher);
    if (matched) return adapter;
  }
  return null;
}
