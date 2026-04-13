/**
 * E19-S27 — ADR-037 Return Shape Adapter Unit Tests
 *
 * Covers Task 2.4: 3 sub-workflow branches + unparseable fallback + 1 happy
 * path per sub-workflow. Part of FTG-08..FTG-13 test family.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeReturn,
  ALLOWED_SOURCE_WORKFLOWS,
} from "../adr037-return-adapter.js";

describe("normalizeReturn — unknown source_workflow", () => {
  it("returns error for disallowed workflow ref", () => {
    const out = normalizeReturn({ ok: true }, "random-workflow");
    expect(out.status).toBe("error");
    expect(out.summary).toMatch(/unknown source_workflow/);
    expect(ALLOWED_SOURCE_WORKFLOWS).toEqual([
      "add-stories",
      "triage-findings",
      "test-automate",
    ]);
  });
});

describe("normalizeReturn — unparseable raw returns", () => {
  it("null → error", () => {
    expect(normalizeReturn(null, "add-stories").status).toBe("error");
  });
  it("undefined → error", () => {
    expect(normalizeReturn(undefined, "add-stories").status).toBe("error");
  });
  it("string → error", () => {
    const out = normalizeReturn("not an object", "add-stories");
    expect(out.status).toBe("error");
    expect(out.summary).toMatch(/non-object/);
  });
  it("number → error", () => {
    expect(normalizeReturn(42, "test-automate").status).toBe("error");
  });
});

describe("normalizeReturn — native ADR-037 passthrough", () => {
  it("passes through a well-formed ADR-037 return", () => {
    const raw = {
      status: "ok",
      summary: "already normalized",
      artifacts: ["foo.md"],
      findings: [],
      next: { primary: "next-cmd", suggestions: ["a"] },
    };
    const out = normalizeReturn(raw, "add-stories");
    expect(out.status).toBe("ok");
    expect(out.summary).toBe("already normalized");
    expect(out.artifacts).toEqual(["foo.md"]);
    expect(out.next.primary).toBe("next-cmd");
  });

  it("fills missing fields with defaults on passthrough", () => {
    const out = normalizeReturn({ status: "ok" }, "add-stories");
    expect(out.summary).toBe("");
    expect(out.artifacts).toEqual([]);
    expect(out.findings).toEqual([]);
    expect(out.next).toEqual({ primary: null, suggestions: [] });
  });
});

describe("adapt add-stories", () => {
  it("happy path — appended_ac", () => {
    const out = normalizeReturn(
      {
        story_key: "E17-S3",
        appended_ac: "- [ ] AC9 — new check",
        story_file: "docs/implementation-artifacts/E17-S3-foo.md",
      },
      "add-stories",
    );
    expect(out.status).toBe("ok");
    expect(out.artifacts).toContain(
      "docs/implementation-artifacts/E17-S3-foo.md",
    );
    expect(out.summary).toMatch(/appended AC/);
  });

  it("error branch — raw.error present", () => {
    const out = normalizeReturn({ error: "story not found" }, "add-stories");
    expect(out.status).toBe("error");
    expect(out.summary).toMatch(/story not found/);
  });

  it("unparseable add-stories return — missing fields", () => {
    const out = normalizeReturn({ irrelevant: true }, "add-stories");
    expect(out.status).toBe("error");
    expect(out.summary).toMatch(/cannot parse/);
  });
});

describe("adapt triage-findings", () => {
  it("happy path — new_story_file", () => {
    const out = normalizeReturn(
      {
        backlog_key: "E19-S99",
        new_story_file: "docs/implementation-artifacts/E19-S99-gap.md",
      },
      "triage-findings",
    );
    expect(out.status).toBe("ok");
    expect(out.artifacts).toEqual([
      "docs/implementation-artifacts/E19-S99-gap.md",
    ]);
    expect(out.summary).toMatch(/E19-S99/);
  });

  it("error branch — raw.error string", () => {
    const out = normalizeReturn(
      { error: "Cannot create story for already-archived epic" },
      "triage-findings",
    );
    expect(out.status).toBe("error");
  });

  it("unparseable triage-findings return", () => {
    const out = normalizeReturn({}, "triage-findings");
    expect(out.status).toBe("error");
  });
});

describe("adapt test-automate", () => {
  it("happy path — test_files array", () => {
    const out = normalizeReturn(
      { test_files: ["test/unit/foo.test.js"], generated_tests: 3 },
      "test-automate",
    );
    expect(out.status).toBe("ok");
    expect(out.artifacts).toEqual(["test/unit/foo.test.js"]);
    expect(out.summary).toMatch(/3 test/);
  });

  it("happy path — only generated_tests count", () => {
    const out = normalizeReturn({ generated_tests: 5 }, "test-automate");
    expect(out.status).toBe("ok");
    expect(out.summary).toMatch(/5/);
  });

  it("error branch — raw.error", () => {
    const out = normalizeReturn(
      { error: "runner not found" },
      "test-automate",
    );
    expect(out.status).toBe("error");
  });

  it("unparseable test-automate return", () => {
    const out = normalizeReturn({ foo: "bar" }, "test-automate");
    expect(out.status).toBe("error");
  });
});
