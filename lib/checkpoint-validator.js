/**
 * Checkpoint Validator — E2-S4
 *
 * Validates checkpoint YAML files for the GAIA workflow engine's
 * checkpoint/resume system. Provides schema validation, files_touched
 * checksum comparison, and resume mode detection.
 *
 * Uses only Node.js built-ins + child_process (zero runtime deps per ADR-005).
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import yaml from "js-yaml";

/** Pattern for valid sha256 checksums: "sha256:" followed by exactly 64 hex chars */
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

/**
 * Check if a value is a non-empty string.
 * @param {*} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Check if a value is a plain object (not null, not array).
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Compute the sha256 checksum of a file using `shasum -a 256` (macOS/BSD variant).
 * @param {string} filePath - Absolute path to the file
 * @returns {string} Checksum in "sha256:{hex}" format
 */
function computeChecksum(filePath) {
  const output = execSync(`shasum -a 256 "${filePath}"`, { encoding: "utf8" });
  return `sha256:${output.split(" ")[0]}`;
}

/**
 * Validate a parsed checkpoint object against the required schema.
 *
 * Required fields:
 *   - workflow: non-empty string
 *   - step: non-zero positive integer
 *   - variables: plain object (key-value map)
 *
 * Optional fields:
 *   - files_touched: array of {path, checksum, last_modified} (absent in legacy checkpoints)
 *
 * @param {object} checkpoint - Parsed checkpoint data
 * @returns {{ valid: boolean, errors: Array<{ field: string, reason: string }> }}
 */
export function validateCheckpoint(checkpoint) {
  const errors = [];

  if (!isNonEmptyString(checkpoint.workflow)) {
    errors.push({ field: "workflow", reason: "Must be a non-empty string" });
  }

  if (checkpoint.step === undefined || checkpoint.step === null) {
    errors.push({ field: "step", reason: "Required field missing" });
  } else if (typeof checkpoint.step !== "number" || !Number.isInteger(checkpoint.step)) {
    errors.push({ field: "step", reason: "Must be an integer" });
  } else if (checkpoint.step === 0) {
    errors.push({ field: "step", reason: "Must be a non-zero positive integer" });
  }

  if (checkpoint.variables === undefined || checkpoint.variables === null) {
    errors.push({ field: "variables", reason: "Required field missing" });
  } else if (!isPlainObject(checkpoint.variables)) {
    errors.push({ field: "variables", reason: "Must be a key-value object" });
  }

  if (checkpoint.files_touched != null && !Array.isArray(checkpoint.files_touched)) {
    errors.push({ field: "files_touched", reason: "Must be an array if present" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate files_touched entries for correct structure and checksum format.
 *
 * Each entry must have:
 *   - path: non-empty string
 *   - checksum: string matching "sha256:{64-hex-chars}"
 *   - last_modified: non-empty string (ISO 8601)
 *
 * @param {Array<object>} entries - files_touched array
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFilesTouched(entries) {
  const errors = [];

  entries.forEach((entry, i) => {
    if (!isNonEmptyString(entry.path)) {
      errors.push(`Entry ${i}: missing or invalid 'path' field`);
    }

    if (!isNonEmptyString(entry.checksum)) {
      errors.push(`Entry ${i}: missing or invalid 'checksum' — must match sha256:{64-hex}`);
    } else if (!SHA256_PATTERN.test(entry.checksum)) {
      errors.push(
        `Entry ${i}: invalid checksum format — expected sha256:{64-hex-chars}, got "${entry.checksum}"`
      );
    }

    if (!isNonEmptyString(entry.last_modified)) {
      errors.push(`Entry ${i}: missing or invalid 'last_modified' field`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Compare files_touched checksums against actual file checksums on disk.
 *
 * For each entry:
 *   - If file doesn't exist: add to deleted[]
 *   - If file exists but checksum differs: add to modified[]
 *   - If file exists and checksum matches: add to matched[]
 *
 * Uses `shasum -a 256` (macOS/BSD variant per dev notes).
 *
 * @param {Array<{path: string, checksum: string, last_modified: string}>} filesTouched
 * @returns {{ matched: object[], modified: object[], deleted: object[] }}
 */
export function compareChecksums(filesTouched) {
  const matched = [];
  const modified = [];
  const deleted = [];

  for (const entry of filesTouched) {
    if (!existsSync(entry.path)) {
      deleted.push(entry);
      continue;
    }

    try {
      const currentChecksum = computeChecksum(entry.path);
      if (currentChecksum === entry.checksum) {
        matched.push(entry);
      } else {
        modified.push({ ...entry, currentChecksum });
      }
    } catch {
      modified.push(entry);
    }
  }

  return { matched, modified, deleted };
}

/**
 * Detect the resume mode for a checkpoint.
 *
 * - "validate": files_touched is present and non-empty -> validate checksums
 * - "skip-validation": files_touched is absent or empty -> legacy path (AC5)
 *
 * @param {object} checkpoint - Parsed checkpoint data
 * @returns {"validate" | "skip-validation"}
 */
export function detectResumeMode(checkpoint) {
  const hasFilesTouched =
    Array.isArray(checkpoint.files_touched) && checkpoint.files_touched.length > 0;
  return hasFilesTouched ? "validate" : "skip-validation";
}

/**
 * Parse a checkpoint YAML file from disk with graceful error handling.
 *
 * @param {string} filePath - Absolute path to checkpoint YAML file
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function parseCheckpointFile(filePath) {
  if (!existsSync(filePath)) {
    return { success: false, error: `Checkpoint file not found: ${filePath}` };
  }

  try {
    const content = readFileSync(filePath, "utf8");
    const data = yaml.load(content);

    if (!isPlainObject(data)) {
      return { success: false, error: "Checkpoint file is empty or not a valid YAML object" };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: `Failed to parse checkpoint YAML: ${err.message}` };
  }
}
