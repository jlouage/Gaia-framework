/**
 * E20-S2 — Environment Presets Loader
 *
 * Loads and parses the environment-presets.yaml file that lives at
 *   Gaia-framework/_gaia/_config/environment-presets.yaml
 *
 * This is the user-facing entry point for promotion-chain configuration,
 * consumed by /gaia-ci-setup (E20-S3) to offer preset selection during
 * initial project setup.
 *
 * Responsibilities:
 *   1. Read the YAML file from disk (throws if missing or unreadable).
 *   2. Parse it with js-yaml in safe mode (throws on malformed YAML).
 *   3. Return a plain object keyed by preset name.
 *
 * This loader intentionally does NOT invoke the E20-S1 promotion-chain
 * validator — callers that need validation should wrap each preset's
 * promotion_chain in a { ci_cd: { promotion_chain } } object and invoke
 * validatePromotionChain themselves. Keeping concerns separated lets
 * /gaia-ci-setup report loader errors and validation errors independently.
 *
 * @module environment-presets-loader
 */

import fs from "node:fs";
import yaml from "js-yaml";

/**
 * Canonical list of preset names defined in environment-presets.yaml.
 * Exposed so /gaia-ci-setup and other consumers can iterate the expected
 * preset set without reparsing the file or hardcoding names inline.
 */
export const KNOWN_PRESETS = Object.freeze(["solo", "small-team", "standard", "enterprise"]);

/**
 * Load and parse environment-presets.yaml from the given path.
 *
 * @param {string} presetsPath — absolute path to environment-presets.yaml
 * @returns {Record<string, { description: string, promotion_chain: Array<object> }>}
 *   An object keyed by preset name (solo, small-team, standard, enterprise).
 * @throws {Error} if the file cannot be read or is not a valid YAML object.
 */
export function loadEnvironmentPresets(presetsPath) {
  if (typeof presetsPath !== "string" || presetsPath.length === 0) {
    throw new Error("loadEnvironmentPresets: presetsPath must be a non-empty string");
  }

  let raw;
  try {
    raw = fs.readFileSync(presetsPath, "utf8");
  } catch (err) {
    throw new Error(
      `loadEnvironmentPresets: failed to read presets file at ${presetsPath}: ${err.message}`
    );
  }

  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`loadEnvironmentPresets: YAML parse error in ${presetsPath}: ${err.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `loadEnvironmentPresets: ${presetsPath} must contain a top-level YAML mapping of preset names`
    );
  }

  return parsed;
}

/**
 * Return the list of preset names actually defined in a loaded presets object.
 *
 * @param {Record<string, object>} presets — result of loadEnvironmentPresets
 * @returns {string[]} sorted list of preset names
 */
export function getPresetNames(presets) {
  if (!presets || typeof presets !== "object") return [];
  return Object.keys(presets).sort();
}
