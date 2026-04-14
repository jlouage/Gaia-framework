import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// E17-S10 ATDD — Bridge Layer 3 — Result Parsing and Evidence Generation
//
// Source: docs/test-artifacts/atdd-E17-S10.md
// Story: E17-S10 (Risk: HIGH, Priority: P0)
//
// These tests verify each AC by scanning the implementation surfaces for
// canonical content markers. They run in the Red→Green→Refactor cycle
// and lock in the evidence schema and parsing behavior described in the ATDD.

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_ROOT = resolve(PROJECT_ROOT, "..");

const POSSIBLE_LAYER3_FILES = [
  join(
    PROJECT_ROOT,
    "_gaia",
    "lifecycle",
    "workflows",
    "4-implementation",
    "dev-story",
    "bridge-layer3.js"
  ),
  join(PROJECT_ROOT, "lib", "bridge", "layer3.js"),
  join(PROJECT_ROOT, "lib", "bridge", "result-parser.js"),
  join(PROJECT_ROOT, "bin", "bridge", "layer3.js"),
  join(PROJECT_ROOT, "_gaia", "core", "bridge", "layer3.js"),
  join(PROJECT_ROOT, "_gaia", "core", "bridge", "layer-3-result-parsing.js"),
];

// Prefer the product source at Gaia-framework/_gaia/... so the test runs in
// CI (where only the repo is checked out) and in local dev (where a running
// framework lives one level up). Falls back to the running framework at
// GAIA_ROOT only when the product source copy is absent.
const DEV_STORY_INSTRUCTIONS = (() => {
  const productSource = join(
    PROJECT_ROOT,
    "_gaia",
    "lifecycle",
    "workflows",
    "4-implementation",
    "dev-story",
    "instructions.xml"
  );
  if (existsSync(productSource)) return productSource;
  return join(
    GAIA_ROOT,
    "_gaia",
    "lifecycle",
    "workflows",
    "4-implementation",
    "dev-story",
    "instructions.xml"
  );
})();

const ATDD_INSTRUCTIONS = (() => {
  const productSource = join(
    PROJECT_ROOT,
    "_gaia",
    "testing",
    "workflows",
    "atdd",
    "instructions.xml"
  );
  if (existsSync(productSource)) return productSource;
  return join(GAIA_ROOT, "_gaia", "testing", "workflows", "atdd", "instructions.xml");
})();

const SCHEMA_REFERENCES = [DEV_STORY_INSTRUCTIONS, ATDD_INSTRUCTIONS, ...POSSIBLE_LAYER3_FILES];

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function loadAllExisting(paths) {
  return paths
    .map((p) => loadFile(p))
    .filter((c) => c !== null)
    .join("\n");
}

describe("E17-S10: Bridge Layer 3 — Result Parsing and Evidence Generation", () => {
  describe("AC1: Layer 3 parses runner output and extracts structured fields", () => {
    it("Test 1: implementation references extraction of total, passed, failed, and skipped test counts", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/total/i);
      expect(combined).toMatch(/passed|pass\b/i);
      expect(combined).toMatch(/failed|fail\b/i);
      expect(combined).toMatch(/skipped|skip\b/i);
    });

    it("Test 2: implementation references extraction of test names and failure messages from runner output", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/test.*name|name.*test/i);
      expect(combined).toMatch(/failure.*message|message.*failure|fail.*message|message.*fail/i);
    });

    it("Test 3: dev-story instructions.xml references Layer 3 or result parsing as a bridge step", () => {
      const content = loadFile(DEV_STORY_INSTRUCTIONS);
      expect(content).not.toBeNull();
      expect(content).toMatch(/layer.?3|result.?pars|evidence.?gen|parse.*result|pars.*output/i);
    });
  });

  describe("AC2: Evidence file written to test-results/{story_key}-execution.json (FR-194)", () => {
    it("Test 4: implementation references test-results/ directory and execution.json output path", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/test-results\//i);
      expect(combined).toMatch(/execution\.json|execution-json/i);
    });

    it("Test 5: implementation or instructions reference FR-194 for the evidence schema", () => {
      const combined = loadAllExisting([...SCHEMA_REFERENCES, DEV_STORY_INSTRUCTIONS]);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/FR-194/);
    });
  });

  describe("AC3: Evidence file uses the canonical schema from FR-194", () => {
    it("Test 6: implementation references schema_version in the evidence schema", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/schema_version/i);
    });

    it("Test 7: implementation references top-level evidence schema fields: story_key, runner, mode, executed_at, duration_seconds", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/story_key/i);
      expect(combined).toMatch(/\brunner\b/i);
      expect(combined).toMatch(/\bmode\b/i);
      expect(combined).toMatch(/executed_at/i);
      expect(combined).toMatch(/duration_seconds/i);
    });

    it("Test 8: implementation references per-test evidence fields: name, status, duration_ms, failure_message", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/duration_ms/i);
      expect(combined).toMatch(/failure_message/i);
    });
  });

  describe("AC4: Evidence file capped at 500KB with truncated flag (NFR-034)", () => {
    it("Test 9: implementation references 500KB size limit and a truncated flag for the evidence file", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/500\s*KB|500kb|500,000|512000|truncat/i);
      expect(combined).toMatch(/truncated/i);
    });

    it("Test 10: implementation references NFR-034 for the size constraint", () => {
      const combined = loadAllExisting([...SCHEMA_REFERENCES, DEV_STORY_INSTRUCTIONS]);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/NFR-034/);
    });
  });

  describe("AC5: Parse failure produces minimal evidence with parse_error and raw_output_snippet", () => {
    it("Test 11: implementation references parse_error flag and raw_output_snippet for unknown runner formats", () => {
      const combined = loadAllExisting(SCHEMA_REFERENCES);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/parse_error/i);
      expect(combined).toMatch(/raw_output_snippet/i);
    });
  });

  describe("AC6: Evidence file path reported to user and linked in review gate section", () => {
    it("Test 12: implementation or instructions reference reporting the evidence file path to the user", () => {
      const combined = loadAllExisting([...SCHEMA_REFERENCES, DEV_STORY_INSTRUCTIONS]);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(
        /evidence.*path|path.*evidence|evidence.*file.*report|report.*evidence.*file/i
      );
    });

    it("Test 13: implementation references linking the evidence file in the story review gate section", () => {
      const combined = loadAllExisting([...SCHEMA_REFERENCES, DEV_STORY_INSTRUCTIONS]);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).toMatch(/review.?gate|gate.*section|story.*review/i);
      expect(combined).toMatch(/link|linked|evidence/i);
    });
  });
});
