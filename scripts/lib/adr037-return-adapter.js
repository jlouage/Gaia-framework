/**
 * ADR-037 Return Shape Adapter — E19-S27 (ADR-039 §10.22.8.3 / FR-314)
 *
 * Normalizes the free-form returns of the three bundled sub-workflows invoked
 * by `/gaia-fill-test-gaps` into the ADR-037 structured return schema:
 *
 *   { status, summary, artifacts, findings, next }
 *
 * where status ∈ { "ok", "error", "halted", "needs_user" }.
 *
 * This is a bridging adapter. The three sub-workflows are not yet refactored
 * under E24 to return ADR-037 schemas natively. When any of them migrates,
 * update the matching branch below in lockstep. See ADR-039 Consequences
 * (architecture.md §5347) — maintenance coupling is acknowledged and tracked.
 *
 * Coupled sub-workflows (keep this list in sync with the parent invocation
 * allowlist in fill-test-gaps/instructions.xml):
 *
 *   1. /gaia-add-stories        — expects { story_key, appended_ac } params,
 *                                 raw return may include `story_file`,
 *                                 `appended` (bool), or `error` string.
 *   2. /gaia-triage-findings    — expects { finding, story_key } params,
 *                                 raw return may include `new_story_file`,
 *                                 `backlog_key`, or `error` string.
 *   3. /gaia-test-automate      — expects { story_key, tier } params,
 *                                 raw return may include `generated_tests`,
 *                                 `test_files`, or `error` string.
 *
 * This module is pure — no I/O, no side effects — so it can be unit-tested
 * against golden inputs.
 */

/** Allowed source workflows — rejected otherwise (defense in depth with the XML assertion). */
export const ALLOWED_SOURCE_WORKFLOWS = Object.freeze([
  "add-stories",
  "triage-findings",
  "test-automate",
]);

/** Stable empty-next sentinel so downstream code can rely on object shape. */
const EMPTY_NEXT = Object.freeze({ primary: null, suggestions: [] });

/**
 * Normalize a raw sub-workflow return into the ADR-037 schema.
 *
 * @param {unknown} raw
 * @param {string} source_workflow — one of ALLOWED_SOURCE_WORKFLOWS
 * @returns {{
 *   status: "ok"|"error"|"halted"|"needs_user",
 *   summary: string,
 *   artifacts: string[],
 *   findings: Array<{severity: string, message: string}>,
 *   next: {primary: string|null, suggestions: string[]}
 * }}
 */
export function normalizeReturn(raw, source_workflow) {
  if (!ALLOWED_SOURCE_WORKFLOWS.includes(source_workflow)) {
    return errorShape(
      `adr037-return-adapter: unknown source_workflow "${source_workflow}" — allowed: ${ALLOWED_SOURCE_WORKFLOWS.join(", ")}`,
    );
  }

  // Unparseable / null / non-object raw returns → error with diagnostic.
  if (raw === null || raw === undefined) {
    return errorShape(
      `${source_workflow}: returned null/undefined — cannot parse`,
    );
  }
  if (typeof raw !== "object") {
    return errorShape(
      `${source_workflow}: returned non-object (${typeof raw}) — cannot parse`,
    );
  }

  // If the sub-workflow already returns ADR-037 shape natively (E24 migration
  // complete), pass it through with minimal normalization.
  if (isAdr037Shape(raw)) {
    return passthrough(raw);
  }

  switch (source_workflow) {
    case "add-stories":
      return adaptAddStories(raw);
    case "triage-findings":
      return adaptTriageFindings(raw);
    case "test-automate":
      return adaptTestAutomate(raw);
    /* c8 ignore next 4 */
    default:
      return errorShape(
        `adr037-return-adapter: unreachable default branch for ${source_workflow}`,
      );
  }
}

/* ─────────────────────── helpers ─────────────────────── */

function isAdr037Shape(raw) {
  return (
    typeof raw === "object" &&
    raw !== null &&
    typeof raw.status === "string" &&
    ["ok", "error", "halted", "needs_user"].includes(raw.status)
  );
}

function passthrough(raw) {
  return {
    status: raw.status,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    artifacts: Array.isArray(raw.artifacts) ? raw.artifacts.slice() : [],
    findings: Array.isArray(raw.findings) ? raw.findings.slice() : [],
    next:
      raw.next && typeof raw.next === "object"
        ? {
            primary:
              typeof raw.next.primary === "string" ? raw.next.primary : null,
            suggestions: Array.isArray(raw.next.suggestions)
              ? raw.next.suggestions.slice()
              : [],
          }
        : EMPTY_NEXT,
  };
}

function errorShape(message) {
  return {
    status: "error",
    summary: message,
    artifacts: [],
    findings: [{ severity: "error", message }],
    next: EMPTY_NEXT,
  };
}

function toArtifacts(...candidates) {
  const out = [];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) out.push(c);
    else if (Array.isArray(c)) {
      for (const s of c) if (typeof s === "string" && s.length > 0) out.push(s);
    }
  }
  return out;
}

/* ─────────────────────── per-workflow branches ─────────────────────── */

function adaptAddStories(raw) {
  if (typeof raw.error === "string" && raw.error.length > 0) {
    return {
      status: "error",
      summary: `add-stories: ${raw.error}`,
      artifacts: [],
      findings: [{ severity: "error", message: raw.error }],
      next: EMPTY_NEXT,
    };
  }

  const artifacts = toArtifacts(raw.story_file, raw.story_files);
  const appended = raw.appended === true || typeof raw.appended_ac === "string";

  if (artifacts.length === 0 && !appended) {
    return errorShape(
      "add-stories: return contained neither story_file nor appended_ac — cannot parse",
    );
  }

  return {
    status: "ok",
    summary: appended
      ? `add-stories: appended AC to ${raw.story_key ?? "existing story"}`
      : `add-stories: created ${artifacts.length} story file(s)`,
    artifacts,
    findings: [],
    next: EMPTY_NEXT,
  };
}

function adaptTriageFindings(raw) {
  if (typeof raw.error === "string" && raw.error.length > 0) {
    return {
      status: "error",
      summary: `triage-findings: ${raw.error}`,
      artifacts: [],
      findings: [{ severity: "error", message: raw.error }],
      next: EMPTY_NEXT,
    };
  }

  const artifacts = toArtifacts(raw.new_story_file, raw.story_files);
  const backlogKey =
    typeof raw.backlog_key === "string" ? raw.backlog_key : null;

  if (artifacts.length === 0 && backlogKey === null) {
    return errorShape(
      "triage-findings: return contained neither new_story_file nor backlog_key — cannot parse",
    );
  }

  return {
    status: "ok",
    summary: backlogKey
      ? `triage-findings: created backlog story ${backlogKey}`
      : `triage-findings: created ${artifacts.length} new story file(s)`,
    artifacts,
    findings: [],
    next: EMPTY_NEXT,
  };
}

function adaptTestAutomate(raw) {
  if (typeof raw.error === "string" && raw.error.length > 0) {
    return {
      status: "error",
      summary: `test-automate: ${raw.error}`,
      artifacts: [],
      findings: [{ severity: "error", message: raw.error }],
      next: EMPTY_NEXT,
    };
  }

  const artifacts = toArtifacts(raw.test_files, raw.test_file);
  const generated = Number.isFinite(raw.generated_tests)
    ? raw.generated_tests
    : null;

  if (artifacts.length === 0 && generated === null) {
    return errorShape(
      "test-automate: return contained neither test_files nor generated_tests — cannot parse",
    );
  }

  return {
    status: "ok",
    summary:
      generated !== null
        ? `test-automate: generated ${generated} test(s)`
        : `test-automate: wrote ${artifacts.length} test file(s)`,
    artifacts,
    findings: [],
    next: EMPTY_NEXT,
  };
}
