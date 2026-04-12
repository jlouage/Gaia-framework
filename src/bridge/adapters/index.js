/**
 * E25-S5: Stack Adapter Registry
 *
 * Central registry for per-stack adapters consumed by the four-layer protocol.
 * All imports are static ES modules — no dynamic loading, no runtime plugin
 * discovery. This is architecture §10.20.11.4's "trust boundary" requirement.
 *
 * In this story only the JavaScript adapter ships. E25-S1..E25-S4 will add:
 *   import pythonAdapter from './python-adapter.js';
 *   import javaAdapter from './java-adapter.js';
 *   import goAdapter from './go-adapter.js';
 *   import flutterAdapter from './flutter-adapter.js';
 *
 * Traces to: FR-307, NFR-047, ADR-028, ADR-038, T37
 */

import { existsSync } from "fs";
import { join } from "path";
import jsAdapter from "./js-adapter.js";

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

const REQUIRED_FIELDS = ["name", "detectionPatterns", "readinessCheck", "discoverRunners", "parseOutput"];

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
    throw new Error(
      `Adapter contract violation in ${modulePath}: adapter is not an object`
    );
  }
  for (const field of REQUIRED_FIELDS) {
    if (adapter[field] === undefined || adapter[field] === null) {
      throw new Error(
        `Adapter contract violation in ${modulePath}: missing field: ${field}`
      );
    }
  }
}

// ─── Registry initialization (loud failure at import time) ──────────────────

// Validate all imported adapters at module top-level so contract violations
// fail at import time (AC7). No silent skips, no partial registration.
validateAdapter(jsAdapter, "./js-adapter.js");

/**
 * Built-in adapters in deterministic priority order.
 * JavaScript is first (only adapter in this story).
 * E25-S1..E25-S4 will extend this array.
 * @type {StackAdapter[]}
 */
const ADAPTERS = [jsAdapter];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Return all registered adapters in deterministic priority order.
 *
 * @returns {StackAdapter[]}
 */
export function listAdapters() {
  return ADAPTERS;
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
    const allMatch = adapter.detectionPatterns.every((pattern) =>
      existsSync(join(projectPath, pattern))
    );
    if (allMatch) return adapter;
  }
  return null;
}
