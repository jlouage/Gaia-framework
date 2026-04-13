/**
 * E19-S27 — Prior Remediation Loader Unit Tests (AC6, AC7)
 *
 * Verifies the 24-hour freshness window, source_gap_report frontmatter match,
 * and succeeded-only skip map extraction.
 */

import { describe, it, expect } from "vitest";
import { basename, join } from "node:path";
import {
  loadPrior,
  FRESHNESS_WINDOW_MS,
} from "../prior-remediation-loader.js";

const DIR = join("/", "test-artifacts");
const SOURCE = "docs/test-artifacts/test-gap-analysis-2026-04-10.md";

function makeReport({ sourceGapReport = SOURCE, date = "2026-04-11", rows }) {
  const frontmatter = [
    "---",
    `source_gap_report: ${sourceGapReport}`,
    `execution_date: ${date}`,
    `total_actions: ${rows.length}`,
    `succeeded: ${rows.filter((r) => r.status === "succeeded").length}`,
    `failed: ${rows.filter((r) => r.status === "failed").length}`,
    `skipped: ${rows.filter((r) => r.status === "skipped").length}`,
    "source_feature_id: null",
    "---",
    "",
    `# Gap Remediation Report — ${date}`,
    "",
    "## Per-Action Detail",
    "",
    "| # | story_key | action_type | sub_workflow | status | artifacts | error |",
    "|---|-----------|-------------|--------------|--------|-----------|-------|",
    ...rows.map(
      (r, i) =>
        `| ${i + 1} | ${r.story_key} | ${r.action_type} | ${r.sub_workflow} | ${r.status} | — | — |`,
    ),
    "",
  ].join("\n");
  return frontmatter;
}

function makeFs({ files }) {
  return {
    readdirSync: (dir) => {
      if (dir !== DIR) throw new Error("ENOENT: " + dir);
      return Object.keys(files);
    },
    readFileSync: (path) => {
      const name = basename(path);
      if (!(name in files)) throw new Error("ENOENT: " + path);
      return files[name].content;
    },
    statSync: (path) => {
      const name = basename(path);
      if (!(name in files)) throw new Error("ENOENT: " + path);
      return { mtimeMs: files[name].mtimeMs };
    },
  };
}

describe("loadPrior — no prior reports", () => {
  it("returns null when directory is empty", () => {
    const fs = makeFs({ files: {}, now: new Date() });
    const out = loadPrior(
      { sourceGapReportPath: SOURCE, testArtifactsDir: DIR },
      fs,
    );
    expect(out).toBeNull();
  });

  it("returns null when directory does not exist", () => {
    const fs = {
      readdirSync: () => {
        throw new Error("ENOENT");
      },
      readFileSync: () => {
        throw new Error("unreachable");
      },
      statSync: () => {
        throw new Error("unreachable");
      },
    };
    const out = loadPrior(
      { sourceGapReportPath: SOURCE, testArtifactsDir: DIR },
      fs,
    );
    expect(out).toBeNull();
  });
});

describe("loadPrior — source_gap_report matching", () => {
  it("ignores reports whose source_gap_report does not match", () => {
    const files = {
      "gap-remediation-report-2026-04-11.md": {
        mtimeMs: Date.now(),
        content: makeReport({
          sourceGapReport: "some-other-report.md",
          rows: [
            { story_key: "E1-S1", action_type: "append_ac", sub_workflow: "add-stories", status: "succeeded" },
          ],
        }),
      },
    };
    const out = loadPrior(
      {
        sourceGapReportPath: SOURCE,
        testArtifactsDir: DIR,
        now: new Date(),
      },
      makeFs({ files }),
    );
    expect(out).toBeNull();
  });
});

describe("loadPrior — freshness window (AC6)", () => {
  const now = new Date("2026-04-12T12:00:00Z");

  it("accepts a report 23 hours old", () => {
    const mtimeMs = now.getTime() - 23 * 60 * 60 * 1000;
    const files = {
      "gap-remediation-report-2026-04-11.md": {
        mtimeMs,
        content: makeReport({
          date: "2026-04-11",
          rows: [
            { story_key: "E1-S1", action_type: "append_ac", sub_workflow: "add-stories", status: "succeeded" },
          ],
        }),
      },
    };
    const out = loadPrior(
      { sourceGapReportPath: SOURCE, testArtifactsDir: DIR, now },
      makeFs({ files }),
    );
    expect(out).not.toBeNull();
    expect(out.skipMap).toEqual({ "E1-S1": "succeeded" });
  });

  it("rejects a report 25 hours old", () => {
    const mtimeMs = now.getTime() - 25 * 60 * 60 * 1000;
    const files = {
      "gap-remediation-report-2026-04-11.md": {
        mtimeMs,
        content: makeReport({
          date: "2026-04-11",
          rows: [
            { story_key: "E1-S1", action_type: "append_ac", sub_workflow: "add-stories", status: "succeeded" },
          ],
        }),
      },
    };
    const out = loadPrior(
      { sourceGapReportPath: SOURCE, testArtifactsDir: DIR, now },
      makeFs({ files }),
    );
    expect(out).toBeNull();
  });

  it("FRESHNESS_WINDOW_MS is 24 hours", () => {
    expect(FRESHNESS_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("loadPrior — succeeded-only skip map", () => {
  it("collects only succeeded rows and drops failed/skipped", () => {
    const now = new Date("2026-04-12T12:00:00Z");
    const files = {
      "gap-remediation-report-2026-04-11.md": {
        mtimeMs: now.getTime() - 60 * 60 * 1000,
        content: makeReport({
          date: "2026-04-11",
          rows: [
            { story_key: "E1-S1", action_type: "append_ac", sub_workflow: "add-stories", status: "succeeded" },
            { story_key: "E1-S2", action_type: "new_story", sub_workflow: "triage-findings", status: "failed" },
            { story_key: "E1-S3", action_type: "expand_automation", sub_workflow: "test-automate", status: "skipped" },
            { story_key: "E1-S4", action_type: "append_ac", sub_workflow: "add-stories", status: "succeeded" },
          ],
        }),
      },
    };
    const out = loadPrior(
      { sourceGapReportPath: SOURCE, testArtifactsDir: DIR, now },
      makeFs({ files }),
    );
    expect(out.skipMap).toEqual({
      "E1-S1": "succeeded",
      "E1-S4": "succeeded",
    });
    expect(out.reportDate).toBe("2026-04-11");
  });
});

describe("loadPrior — tie-break", () => {
  it("selects the most recent by execution_date, then mtime", () => {
    const now = new Date("2026-04-12T12:00:00Z");
    const files = {
      "gap-remediation-report-2026-04-10.md": {
        mtimeMs: now.getTime() - 30 * 60 * 1000,
        content: makeReport({
          date: "2026-04-10",
          rows: [
            { story_key: "OLD", action_type: "append_ac", sub_workflow: "add-stories", status: "succeeded" },
          ],
        }),
      },
      "gap-remediation-report-2026-04-11.md": {
        mtimeMs: now.getTime() - 60 * 60 * 1000,
        content: makeReport({
          date: "2026-04-11",
          rows: [
            { story_key: "NEW", action_type: "append_ac", sub_workflow: "add-stories", status: "succeeded" },
          ],
        }),
      },
    };
    const out = loadPrior(
      { sourceGapReportPath: SOURCE, testArtifactsDir: DIR, now },
      makeFs({ files }),
    );
    expect(out.skipMap).toEqual({ NEW: "succeeded" });
  });
});
