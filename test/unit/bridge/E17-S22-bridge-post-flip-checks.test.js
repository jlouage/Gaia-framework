/**
 * E17-S22: Bridge Enable Post-Flip Checks
 *
 * Story: /gaia-bridge-enable Step 4 — detect and validate
 * docs/test-artifacts/test-environment.yaml between the flag write and the
 * post-toggle summary. Produces a structured `post_flip_result` object:
 *   - { kind: "present_valid",   runners: [...] }
 *   - { kind: "present_invalid", errors:  [...] }
 *   - { kind: "absent",          choice: "a"|"b"|"c" }
 *
 * buildSummary is extended to render this result into the post-toggle summary
 * instead of the E17-S21 stub placeholder. The 3-option prompt itself is
 * rendered by the workflow engine — this module returns the machine-readable
 * option list for the engine/template-output to consume.
 *
 * Traces: FR-317, FR-201, ADR-028 §10.20.12.2, ADR-028 §10.20.12.3 (Path A)
 * Risk: low | Epic: E17 — Review Gate Enhancement & Test Execution Bridge
 *
 * Test IDs: BTG-01 (present+valid), BTG-03 (absent 3-option branches),
 *           BTG-05 (present+invalid), disable-skip, YOLO auto-skip.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";

import {
  runPostFlipChecks,
  POST_FLIP_ABSENT_OPTIONS,
} from "../../../_gaia/core/bridge/bridge-post-flip-checks.js";
import { buildSummary } from "../../../_gaia/core/bridge/bridge-toggle.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

let tmpRoot;
let testArtifactsDir;
let manifestPath;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "gaia-e17-s22-"));
  testArtifactsDir = join(tmpRoot, "docs", "test-artifacts");
  mkdirSync(testArtifactsDir, { recursive: true });
  manifestPath = join(testArtifactsDir, "test-environment.yaml");
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// Minimal valid manifest matching E17-S7 validator schema.
const VALID_MANIFEST = `version: 1
runners:
  - name: unit
    command: "npm test"
    tier: 1
  - name: integration
    command: "npm run test:integration"
    tier: 2
`;

// Missing required fields — validator emits warnings (valid: false).
const INVALID_MANIFEST = `# missing version and runners
primary_runner: unit
`;

// ─── BTG-01: Present + valid ────────────────────────────────────────────────

describe("E17-S22: Bridge Post-Flip Checks", () => {
  describe("BTG-01: manifest present and valid", () => {
    it("returns kind=present_valid with runners list", () => {
      writeFileSync(manifestPath, VALID_MANIFEST, "utf8");
      const result = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "enable",
        changed: true,
      });
      expect(result.kind).toBe("present_valid");
      expect(Array.isArray(result.runners)).toBe(true);
      expect(result.runners.length).toBe(2);
      const names = result.runners.map((r) => r.name);
      expect(names).toContain("unit");
      expect(names).toContain("integration");
    });

    it("buildSummary renders runner list when result is present_valid", () => {
      writeFileSync(manifestPath, VALID_MANIFEST, "utf8");
      const postFlipResult = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "enable",
        changed: true,
      });
      const summary = buildSummary({
        previousState: false,
        newState: true,
        mode: "enable",
        changed: true,
        postFlipResult,
      });
      expect(summary).toMatch(/post-flip check/i);
      expect(summary).toContain("unit");
      expect(summary).toContain("integration");
      expect(summary).toContain("/gaia-build-configs");
      // No 3-option prompt rendered
      expect(summary).not.toMatch(/\[a\] Run `\/gaia-brownfield`/);
    });
  });

  // ─── BTG-05: Present + invalid ─────────────────────────────────────────────

  describe("BTG-05: manifest present but schema-invalid", () => {
    it("returns kind=present_invalid with errors list", () => {
      writeFileSync(manifestPath, INVALID_MANIFEST, "utf8");
      const result = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "enable",
        changed: true,
      });
      expect(result.kind).toBe("present_invalid");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("buildSummary renders errors as warnings and still suggests /gaia-build-configs", () => {
      writeFileSync(manifestPath, INVALID_MANIFEST, "utf8");
      const postFlipResult = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "enable",
        changed: true,
      });
      const summary = buildSummary({
        previousState: false,
        newState: true,
        mode: "enable",
        changed: true,
        postFlipResult,
      });
      expect(summary).toMatch(/warning/i);
      expect(summary).toContain("/gaia-build-configs");
      // Per AC5: flag was NOT rolled back — summary still reports newState=true
      expect(summary).toContain("| New state | true |");
    });
  });

  // ─── BTG-03: Absent + 3-option prompt ──────────────────────────────────────

  describe("BTG-03: manifest absent — 3-option prompt", () => {
    it("returns kind=absent with options list when manifest is missing", () => {
      // no manifest written
      const result = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "enable",
        changed: true,
      });
      expect(result.kind).toBe("absent");
      expect(Array.isArray(result.options)).toBe(true);
      expect(result.options.length).toBe(3);
      expect(result.options.map((o) => o.key)).toEqual(["a", "b", "c"]);
    });

    it("POST_FLIP_ABSENT_OPTIONS exports three next-step suggestions (Path A, no auto-invoke)", () => {
      expect(POST_FLIP_ABSENT_OPTIONS).toHaveLength(3);
      const [a, b, c] = POST_FLIP_ABSENT_OPTIONS;
      expect(a.key).toBe("a");
      expect(a.label).toMatch(/gaia-brownfield/);
      expect(a.autoInvoke).toBe(false);
      expect(b.key).toBe("b");
      expect(b.label).toMatch(/test-environment\.yaml\.example/);
      expect(b.autoInvoke).toBe(false);
      expect(c.key).toBe("c");
      expect(c.label).toMatch(/skip/i);
      expect(c.autoInvoke).toBe(false);
    });

    it("buildSummary with choice=a renders brownfield suggestion", () => {
      const summary = buildSummary({
        previousState: false,
        newState: true,
        mode: "enable",
        changed: true,
        postFlipResult: { kind: "absent", choice: "a", options: POST_FLIP_ABSENT_OPTIONS },
      });
      expect(summary).toContain("/gaia-brownfield");
      expect(summary).toContain("/gaia-build-configs");
    });

    it("buildSummary with choice=b renders example-file copy instruction", () => {
      const summary = buildSummary({
        previousState: false,
        newState: true,
        mode: "enable",
        changed: true,
        postFlipResult: { kind: "absent", choice: "b", options: POST_FLIP_ABSENT_OPTIONS },
      });
      expect(summary).toContain("docs/test-artifacts/test-environment.yaml.example");
      expect(summary).toContain("/gaia-build-configs");
    });

    it("buildSummary with choice=c renders skip warning", () => {
      const summary = buildSummary({
        previousState: false,
        newState: true,
        mode: "enable",
        changed: true,
        postFlipResult: { kind: "absent", choice: "c", options: POST_FLIP_ABSENT_OPTIONS },
      });
      expect(summary).toMatch(/skip/i);
      expect(summary).toMatch(/fail-fast|layer 1/i);
      expect(summary).toContain("/gaia-build-configs");
    });

    it("YOLO mode auto-selects choice=c with a warning", () => {
      const result = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "enable",
        changed: true,
        yolo: true,
      });
      expect(result.kind).toBe("absent");
      expect(result.choice).toBe("c");
      expect(result.yoloAutoSkipped).toBe(true);
    });
  });

  // ─── Disable mode skip (AC7) ────────────────────────────────────────────────

  describe("AC7: disable mode skips Step 4 entirely", () => {
    it("runPostFlipChecks returns kind=skipped when mode=disable", () => {
      writeFileSync(manifestPath, VALID_MANIFEST, "utf8");
      const result = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "disable",
        changed: true,
      });
      expect(result.kind).toBe("skipped");
      expect(result.reason).toMatch(/disable/i);
    });

    it("disable summary omits post-flip-check output", () => {
      const summary = buildSummary({
        previousState: true,
        newState: false,
        mode: "disable",
        changed: true,
        postFlipResult: { kind: "skipped", reason: "disable-mode" },
      });
      expect(summary).not.toMatch(/post-flip check/i);
      expect(summary).not.toMatch(/test-environment\.yaml/i);
      expect(summary).toContain("/gaia-build-configs");
    });
  });

  // ─── Idempotency guard (Test Scenario #6) ──────────────────────────────────

  describe("Idempotency: no state transition means no post-flip checks", () => {
    it("runPostFlipChecks returns kind=skipped when changed=false", () => {
      writeFileSync(manifestPath, VALID_MANIFEST, "utf8");
      const result = runPostFlipChecks({
        projectRoot: tmpRoot,
        mode: "enable",
        changed: false, // idempotent hit — bridge already enabled
      });
      expect(result.kind).toBe("skipped");
      expect(result.reason).toMatch(/idempotent|no state transition/i);
    });
  });
});
