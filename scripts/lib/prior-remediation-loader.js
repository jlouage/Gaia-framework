/**
 * Prior Remediation Loader — E19-S27 (ADR-039 §10.22.8.3 / AC6, AC7)
 *
 * Finds the most recent prior `gap-remediation-report-*.md` whose frontmatter
 * `source_gap_report` matches the gap report the parent workflow is about to
 * process, and returns a skip map { story_key → prior_status } containing
 * ONLY `succeeded` actions so Step 4 can skip already-succeeded rows during
 * retry.
 *
 * A 24-hour freshness window is enforced — any match older than 24 hours is
 * ignored (retry-only-failed semantics require recent state, per FR-314). This
 * keeps the design stateless: the remediation report file IS the state store.
 *
 * Pure-function contract (I/O via injected `fs`): the default export reads
 * from the real filesystem, but tests pass an in-memory adapter.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

/** Default 24-hour window in milliseconds (AC6). */
export const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Load the skip map from the most recent prior remediation report.
 *
 * @param {{
 *   sourceGapReportPath: string,
 *   testArtifactsDir: string,
 *   now?: Date,  // injectable for deterministic tests
 * }} input
 * @param {{
 *   readFileSync?: Function,
 *   readdirSync?: Function,
 *   statSync?: Function,
 * }} [fs]
 * @returns {null|{
 *   reportPath: string,
 *   reportDate: string,
 *   skipMap: Record<string, "succeeded">,
 * }}
 */
export function loadPrior(
  { sourceGapReportPath, testArtifactsDir, now },
  fs = { readFileSync, readdirSync, statSync },
) {
  if (typeof sourceGapReportPath !== "string" || sourceGapReportPath.length === 0) {
    throw new TypeError("loadPrior: sourceGapReportPath must be a non-empty string");
  }
  if (typeof testArtifactsDir !== "string" || testArtifactsDir.length === 0) {
    throw new TypeError("loadPrior: testArtifactsDir must be a non-empty string");
  }

  const nowMs = (now ?? new Date()).getTime();

  let entries;
  try {
    entries = fs.readdirSync(testArtifactsDir);
  } catch (_err) {
    // Directory does not exist yet — no prior reports.
    return null;
  }

  const candidates = entries
    .filter((name) =>
      typeof name === "string" &&
      name.startsWith("gap-remediation-report-") &&
      name.endsWith(".md"),
    )
    .map((name) => join(testArtifactsDir, name));

  if (candidates.length === 0) return null;

  /** @type {{path: string, frontmatter: Record<string, unknown>, mtimeMs: number}[]} */
  const parsed = [];
  for (const path of candidates) {
    try {
      const raw = fs.readFileSync(path, "utf8");
      const fm = parseFrontmatter(raw);
      if (!fm) continue;
      if (fm.source_gap_report !== sourceGapReportPath) continue;
      const stat = fs.statSync(path);
      parsed.push({ path, frontmatter: fm, mtimeMs: stat.mtimeMs });
    } catch (_err) {
      // Skip unreadable / unparseable files silently — they are not the state
      // store we're looking for.
      continue;
    }
  }

  if (parsed.length === 0) return null;

  // Pick the most recent by execution_date (ISO string compare), tie-break on mtime.
  parsed.sort((a, b) => {
    const da = normalizeDate(a.frontmatter.execution_date);
    const db = normalizeDate(b.frontmatter.execution_date);
    if (da !== db) return db.localeCompare(da);
    return b.mtimeMs - a.mtimeMs;
  });

  const winner = parsed[0];

  // Enforce 24-hour freshness on mtime.
  if (nowMs - winner.mtimeMs > FRESHNESS_WINDOW_MS) {
    return null;
  }

  const body = stripFrontmatter(fs.readFileSync(winner.path, "utf8"));
  const skipMap = extractSucceededSkipMap(body);

  return {
    reportPath: winner.path,
    reportDate: normalizeDate(winner.frontmatter.execution_date),
    skipMap,
  };
}

/** Normalize a YAML-parsed execution_date into a YYYY-MM-DD string. */
function normalizeDate(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value ?? "");
}

/* ─────────────────────── helpers ─────────────────────── */

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;
  const yamlText = raw.slice(3, end).trim();
  try {
    const doc = yaml.load(yamlText);
    return doc && typeof doc === "object" ? doc : null;
  } catch (_err) {
    return null;
  }
}

function stripFrontmatter(raw) {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4);
}

/**
 * Walk the per-action detail table and collect story_keys whose status is
 * `succeeded`. The table shape is fixed by gap-remediation-report-writer.
 */
function extractSucceededSkipMap(body) {
  /** @type {Record<string, "succeeded">} */
  const map = {};
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // Expected: [ "", "#", "story_key", "action_type", "sub_workflow", "status", "artifacts", "error", "" ]
    if (cells.length < 8) continue;
    const idx = cells[1];
    const storyKey = cells[2];
    const status = cells[5];
    if (idx === "#" || idx === "---" || idx === "—") continue;
    if (!storyKey || storyKey === "—" || storyKey === "story_key") continue;
    if (status === "succeeded") {
      map[storyKey] = "succeeded";
    }
  }
  return map;
}
