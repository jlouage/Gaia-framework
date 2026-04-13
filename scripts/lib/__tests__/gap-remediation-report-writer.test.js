/**
 * E19-S27 — Gap Remediation Report Writer Unit Tests
 *
 * Verifies the frontmatter schema, per-action detail table, and rollup counts
 * required by architecture §10.22.8.3 (AC5).
 */

import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import {
  renderReport,
  writeReport,
  ACTION_STATUSES,
} from "../gap-remediation-report-writer.js";
import yaml from "js-yaml";

const FIXED_DATE = "2026-04-12";

const sampleTracking = [
  {
    story_key: "E17-S3",
    action_type: "append_ac",
    sub_workflow: "add-stories",
    status: "succeeded",
    artifacts: ["docs/implementation-artifacts/E17-S3-foo.md"],
  },
  {
    story_key: "E19-S14",
    action_type: "new_story",
    sub_workflow: "triage-findings",
    status: "failed",
    error: "Cannot create story for already-archived epic",
  },
  {
    story_key: "E20-S1",
    action_type: "skip",
    sub_workflow: "—",
    status: "skipped",
  },
];

describe("ACTION_STATUSES", () => {
  it("matches the schema from §10.22.8.3", () => {
    expect(ACTION_STATUSES).toEqual(["succeeded", "failed", "skipped"]);
  });
});

describe("renderReport — frontmatter", () => {
  it("emits the schema required by §10.22.8.3", () => {
    const md = renderReport({
      trackingMap: sampleTracking,
      sourceGapReport: "docs/test-artifacts/test-gap-analysis-2026-04-10.md",
      sourceFeatureId: null,
      executionDate: FIXED_DATE,
    });

    expect(md.startsWith("---\n")).toBe(true);
    const fmEnd = md.indexOf("\n---\n", 3);
    expect(fmEnd).toBeGreaterThan(0);
    const fmText = md.slice(4, fmEnd);
    const fm = yaml.load(fmText);

    expect(fm.source_gap_report).toBe(
      "docs/test-artifacts/test-gap-analysis-2026-04-10.md",
    );
    expect(fm.execution_date).toBe(FIXED_DATE);
    expect(fm.total_actions).toBe(3);
    expect(fm.succeeded).toBe(1);
    expect(fm.failed).toBe(1);
    expect(fm.skipped).toBe(1);
    expect(fm.source_feature_id).toBeNull();
  });

  it("handles a non-null source_feature_id", () => {
    const md = renderReport({
      trackingMap: [],
      sourceGapReport: "gr.md",
      sourceFeatureId: "FEAT-42",
      executionDate: FIXED_DATE,
    });
    const fm = yaml.load(md.slice(4, md.indexOf("\n---\n", 3)));
    expect(fm.source_feature_id).toBe("FEAT-42");
    expect(fm.total_actions).toBe(0);
  });
});

describe("renderReport — body table", () => {
  it("renders one row per action in order", () => {
    const md = renderReport({
      trackingMap: sampleTracking,
      sourceGapReport: "gr.md",
      sourceFeatureId: null,
      executionDate: FIXED_DATE,
    });
    expect(md).toMatch(/\| 1 \| E17-S3 \| append_ac \| add-stories \| succeeded \|/);
    expect(md).toMatch(/\| 2 \| E19-S14 \| new_story \| triage-findings \| failed \|/);
    expect(md).toMatch(/\| 3 \| E20-S1 \| skip \| — \| skipped \|/);
  });

  it("renders an empty-state placeholder row when no actions", () => {
    const md = renderReport({
      trackingMap: [],
      sourceGapReport: "gr.md",
      sourceFeatureId: null,
      executionDate: FIXED_DATE,
    });
    expect(md).toMatch(/\| — \| — \| — \| — \| — \| — \| — \|/);
  });

  it("escapes pipe characters in error messages", () => {
    const md = renderReport({
      trackingMap: [
        {
          story_key: "E1-S1",
          action_type: "append_ac",
          sub_workflow: "add-stories",
          status: "failed",
          error: "a | b | c",
        },
      ],
      sourceGapReport: "gr.md",
      sourceFeatureId: null,
      executionDate: FIXED_DATE,
    });
    expect(md).toContain("a \\| b \\| c");
  });
});

describe("renderReport — validation", () => {
  it("throws on non-array trackingMap", () => {
    expect(() =>
      renderReport({
        trackingMap: "nope",
        sourceGapReport: "gr.md",
        sourceFeatureId: null,
        executionDate: FIXED_DATE,
      }),
    ).toThrow(TypeError);
  });

  it("throws on empty sourceGapReport", () => {
    expect(() =>
      renderReport({
        trackingMap: [],
        sourceGapReport: "",
        sourceFeatureId: null,
        executionDate: FIXED_DATE,
      }),
    ).toThrow(TypeError);
  });
});

describe("writeReport — filesystem adapter", () => {
  it("writes to gap-remediation-report-{date}.md in outputDir", () => {
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();

    const outDir = join("/", "tmp", "test-artifacts");
    const path = writeReport(
      {
        trackingMap: sampleTracking,
        sourceGapReport: "gr.md",
        sourceFeatureId: null,
        outputDir: outDir,
        executionDate: FIXED_DATE,
      },
      { writeFileSync, mkdirSync },
    );

    expect(path).toBe(join(outDir, `gap-remediation-report-${FIXED_DATE}.md`));
    expect(mkdirSync).toHaveBeenCalledWith(outDir, { recursive: true });
    expect(writeFileSync).toHaveBeenCalledOnce();
    const [writePath, content] = writeFileSync.mock.calls[0];
    expect(writePath).toBe(path);
    expect(content).toContain("# Gap Remediation Report");
  });

  it("throws on empty outputDir", () => {
    expect(() =>
      writeReport(
        {
          trackingMap: [],
          sourceGapReport: "gr.md",
          sourceFeatureId: null,
          outputDir: "",
          executionDate: FIXED_DATE,
        },
        { writeFileSync: () => {}, mkdirSync: () => {} },
      ),
    ).toThrow(TypeError);
  });
});
