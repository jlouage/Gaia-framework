/**
 * Gap Remediation Report Writer — E19-S27 (ADR-039 §10.22.8.3 / FR-314 / AC5)
 *
 * Writes `docs/test-artifacts/gap-remediation-report-{YYYY-MM-DD}.md` with the
 * frontmatter + per-action detail table documented in architecture §10.22.8.3.
 *
 * This module is pure — it renders markdown and (optionally) writes it to disk
 * via an injectable filesystem. That makes it unit-testable without touching
 * the real filesystem.
 *
 * Frontmatter schema:
 *
 *   source_gap_report: <path string>
 *   execution_date: <YYYY-MM-DD>
 *   total_actions: <int>
 *   succeeded: <int>
 *   failed: <int>
 *   skipped: <int>
 *   source_feature_id: <string|null>
 *
 * Body:
 *
 *   # Gap Remediation Report — {date}
 *   | # | story_key | action_type | sub_workflow | status | artifacts | error |
 *   ...
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";

/** Allowed statuses in the per-action detail table (from §10.22.8.3). */
export const ACTION_STATUSES = Object.freeze([
  "succeeded",
  "failed",
  "skipped",
]);

/**
 * Build the rendered markdown string for the remediation report.
 *
 * @param {{
 *   trackingMap: Array<{
 *     story_key: string,
 *     action_type: string,
 *     sub_workflow: string,
 *     status: "succeeded"|"failed"|"skipped",
 *     artifacts?: string[],
 *     error?: string|null,
 *   }>,
 *   sourceGapReport: string,
 *   sourceFeatureId: string|null,
 *   executionDate?: string,  // ISO date (YYYY-MM-DD) — defaults to today
 * }} input
 * @returns {string} rendered markdown
 */
export function renderReport({
  trackingMap,
  sourceGapReport,
  sourceFeatureId,
  executionDate,
}) {
  if (!Array.isArray(trackingMap)) {
    throw new TypeError("renderReport: trackingMap must be an array");
  }
  if (typeof sourceGapReport !== "string" || sourceGapReport.length === 0) {
    throw new TypeError("renderReport: sourceGapReport must be a non-empty string");
  }

  const date = executionDate ?? todayIsoDate();

  const counts = { total: 0, succeeded: 0, failed: 0, skipped: 0 };
  for (const row of trackingMap) {
    counts.total += 1;
    if (row.status === "succeeded") counts.succeeded += 1;
    else if (row.status === "failed") counts.failed += 1;
    else if (row.status === "skipped") counts.skipped += 1;
  }

  const frontmatter = {
    source_gap_report: sourceGapReport,
    execution_date: date,
    total_actions: counts.total,
    succeeded: counts.succeeded,
    failed: counts.failed,
    skipped: counts.skipped,
    source_feature_id: sourceFeatureId ?? null,
  };

  const yamlBlock = yaml.dump(frontmatter, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  const header = `# Gap Remediation Report — ${date}\n\n` +
    `> Source gap report: \`${sourceGapReport}\`\n` +
    `> Execution date: ${date}\n` +
    `> Totals: ${counts.total} actions (${counts.succeeded} succeeded, ${counts.failed} failed, ${counts.skipped} skipped)\n\n`;

  const tableHeader =
    "| # | story_key | action_type | sub_workflow | status | artifacts | error |\n" +
    "|---|-----------|-------------|--------------|--------|-----------|-------|\n";

  const rows = trackingMap.length === 0
    ? "| — | — | — | — | — | — | — |\n"
    : trackingMap
        .map((r, i) => {
          const artifacts = Array.isArray(r.artifacts) && r.artifacts.length > 0
            ? r.artifacts.map((a) => `\`${a}\``).join("<br>")
            : "—";
          const err = r.error ? String(r.error).replace(/\|/g, "\\|") : "—";
          return `| ${i + 1} | ${r.story_key ?? "—"} | ${r.action_type ?? "—"} | ${r.sub_workflow ?? "—"} | ${r.status ?? "—"} | ${artifacts} | ${err} |`;
        })
        .join("\n") + "\n";

  return `---\n${yamlBlock}---\n\n${header}## Per-Action Detail\n\n${tableHeader}${rows}\n`;
}

/**
 * Render + write the report to disk. Returns the absolute path written.
 *
 * @param {object} input — same shape as renderReport, plus:
 * @param {string} input.outputDir — absolute directory for test artifacts
 * @param {{writeFileSync?: Function, mkdirSync?: Function}} [fs]
 * @returns {string} absolute path of the written file
 */
export function writeReport(input, fs = { writeFileSync, mkdirSync }) {
  const date = input.executionDate ?? todayIsoDate();
  const md = renderReport({ ...input, executionDate: date });

  if (typeof input.outputDir !== "string" || input.outputDir.length === 0) {
    throw new TypeError("writeReport: outputDir must be a non-empty string");
  }

  const filename = `gap-remediation-report-${date}.md`;
  const outPath = join(input.outputDir, filename);

  fs.mkdirSync(dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, "utf8");
  return outPath;
}

/** ISO date YYYY-MM-DD in UTC — deterministic across machines. */
function todayIsoDate() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
