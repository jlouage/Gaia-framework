/**
 * /gaia-ci-edit Audit Trail (E20-S13 AC5)
 *
 * Writes an audit checkpoint every time a user adds, removes, reorders, or
 * modifies an entry in `ci_cd.promotion_chain`. The checkpoint format
 * follows the existing `_memory/checkpoints/` YAML conventions so
 * `/gaia-resume` and future audit tooling can discover and replay the
 * history deterministically.
 *
 * Checkpoint schema:
 *   user: <string>
 *   timestamp: <ISO 8601 UTC>
 *   operation: add|remove|reorder|modify
 *   before_state: <full promotion_chain array before the edit>
 *   after_state:  <full promotion_chain array after  the edit>
 *   diff_summary: <human-readable change list: added/removed/modified/reordered>
 *
 * Design principles:
 *   - Deterministic filenames: `ci-edit-<iso-8601>.yaml` with colons
 *     replaced by hyphens so the name is filesystem-safe on every OS.
 *   - No external YAML dependency — the checkpoint writer emits a small,
 *     strict YAML subset. Round-tripping through a real YAML parser is
 *     covered in the ci-edit test suite; this module stays dependency-free.
 *   - Pure function at the edges: the filesystem write is the only side
 *     effect, and the caller provides `checkpointDir` and `now`.
 *
 * @module ci-edit-audit
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Build the filesystem-safe ISO-8601 timestamp component.
 * @param {Date} date
 * @returns {string} e.g., "2026-04-08T09-15-30Z"
 */
function buildTimestampSlug(date) {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Compute a human-readable diff summary between two promotion_chain arrays.
 *
 * - Entries present only in `after` → added
 * - Entries present only in `before` → removed
 * - Entries present in both with mutated contents → modified
 * - Entries present in both identical but in different positions → reordered
 *
 * @param {Array<object>} before
 * @param {Array<object>} after
 * @returns {{added:string[], removed:string[], modified:string[], reordered:boolean}}
 */
export function computeDiffSummary(before, after) {
  const beforeList = Array.isArray(before) ? before : [];
  const afterList = Array.isArray(after) ? after : [];
  const beforeById = new Map(beforeList.map((e) => [e?.id, e]));
  const afterById = new Map(afterList.map((e) => [e?.id, e]));

  const added = [];
  const removed = [];
  const modified = [];

  for (const [id, afterEntry] of afterById.entries()) {
    if (!beforeById.has(id)) {
      added.push(id);
      continue;
    }
    const beforeEntry = beforeById.get(id);
    if (JSON.stringify(beforeEntry) !== JSON.stringify(afterEntry)) {
      modified.push(id);
    }
  }
  for (const id of beforeById.keys()) {
    if (!afterById.has(id)) removed.push(id);
  }

  // Reorder detection: same set of ids, different ordering, no content changes.
  let reordered = false;
  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    const beforeOrder = beforeList.map((e) => e?.id).join("|");
    const afterOrder = afterList.map((e) => e?.id).join("|");
    if (beforeOrder !== afterOrder) reordered = true;
  }

  return { added, removed, modified, reordered };
}

/**
 * Minimal YAML emitter for the audit checkpoint. Handles strings, numbers,
 * booleans, arrays, and nested objects — enough for promotion_chain entries.
 *
 * @param {*} value
 * @param {number} indent
 * @returns {string}
 */
function emitYaml(value, indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    // Quote if the string contains YAML-significant characters.
    if (/[:#\-?\[\]{}&*!|>'"%@`,\n]/.test(value) || value === "") {
      return JSON.stringify(value);
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const inner = emitYaml(item, indent + 1)
            .split("\n")
            .map((line, idx) => (idx === 0 ? line : `${pad}  ${line}`))
            .join("\n");
          return `${pad}- ${inner}`;
        }
        return `${pad}- ${emitYaml(item, indent + 1)}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        if (v && typeof v === "object") {
          if (Array.isArray(v) && v.length === 0) return `${pad}${k}: []`;
          if (!Array.isArray(v) && Object.keys(v).length === 0) return `${pad}${k}: {}`;
          const nested = emitYaml(v, indent + 1);
          return `${pad}${k}:\n${nested}`;
        }
        return `${pad}${k}: ${emitYaml(v, indent + 1)}`;
      })
      .join("\n");
  }
  return JSON.stringify(value);
}

/**
 * Write a /gaia-ci-edit audit checkpoint to disk.
 *
 * @param {{
 *   operation: "add"|"remove"|"reorder"|"modify",
 *   user: string,
 *   beforeState: Array<object>,
 *   afterState: Array<object>,
 *   checkpointDir: string,
 *   now?: Date,
 * }} params
 * @returns {string} Absolute path to the written checkpoint file.
 */
export function writeCiEditAuditCheckpoint(params) {
  const { operation, user, beforeState, afterState, checkpointDir, now } = params || {};
  if (!checkpointDir || typeof checkpointDir !== "string") {
    throw new Error("writeCiEditAuditCheckpoint: checkpointDir is required");
  }

  const stamp = now instanceof Date ? now : new Date();
  const timestamp = stamp.toISOString();
  const slug = buildTimestampSlug(stamp);
  const filename = `ci-edit-${slug}.yaml`;

  const diffSummary = computeDiffSummary(beforeState, afterState);

  const payload = {
    workflow: "ci-edit",
    user: user || "unknown",
    timestamp,
    operation,
    before_state: beforeState || [],
    after_state: afterState || [],
    diff_summary: diffSummary,
  };

  mkdirSync(checkpointDir, { recursive: true });
  const filePath = join(checkpointDir, filename);
  writeFileSync(filePath, emitYaml(payload) + "\n", "utf8");
  return filePath;
}
