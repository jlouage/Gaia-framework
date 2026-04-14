/**
 * E25-S8: Multi-Stack Regression Suite
 *
 * End-to-end regression suite that exercises every shipped adapter against a
 * minimal golden-path fixture and asserts byte-exact match against a
 * pre-captured evidence record. Numeric timing fields are compared with a
 * ±5ms float tolerance to absorb runner jitter (AC2).
 *
 * Also contains the StackAdapter contract enforcement suite (AC5 / TEB-MS-R08):
 * table-driven tests construct a fake adapter with each required field
 * individually stripped and assert that `validateAdapter()` throws with the
 * missing field named in the error message.
 *
 * Traces: FR-307, FR-308, FR-309, FR-310, FR-311, ADR-038, TEB-MS-R08.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import jsAdapter from "../../../_gaia/core/bridge/adapters/js-adapter.js";
import pythonAdapter from "../../../_gaia/core/bridge/adapters/python-adapter.js";
import javaAdapter from "../../../_gaia/core/bridge/adapters/java-adapter.js";
import goAdapter from "../../../_gaia/core/bridge/adapters/go-adapter.js";
import flutterAdapter from "../../../_gaia/core/bridge/adapters/flutter-adapter.js";
import { validateAdapter } from "../../../_gaia/core/bridge/adapters/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, "..", "..", "fixtures", "bridge");

const TIMING_TOLERANCE_MS = 5;

// Numeric-timing fields that the regression matcher allows to drift within
// ±TIMING_TOLERANCE_MS. Every other field must match byte-exact.
const TIMING_FIELD_KEYS = new Set([
  "startedAt",
  "durationMs",
  "duration_ms",
  "duration",
  "elapsed_ms",
  "time",
  "time_ms",
]);

/**
 * Recursive deep-equal that tolerates ±TIMING_TOLERANCE_MS on known numeric
 * timing keys and requires byte-exact equality for everything else.
 */
function matchEvidence(actual, expected, path = "") {
  if (expected === null || actual === null) {
    expect(actual, `mismatch at ${path || "<root>"}`).toBe(expected);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `expected array at ${path}`).toBe(true);
    expect(actual.length, `array length mismatch at ${path}`).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      matchEvidence(actual[i], expected[i], `${path}[${i}]`);
    }
    return;
  }
  if (typeof expected === "object") {
    expect(typeof actual, `expected object at ${path}`).toBe("object");
    const expKeys = Object.keys(expected).sort();
    const actKeys = Object.keys(actual).sort();
    expect(actKeys, `key set mismatch at ${path}`).toEqual(expKeys);
    for (const k of expKeys) {
      matchEvidence(actual[k], expected[k], path ? `${path}.${k}` : k);
    }
    return;
  }
  if (typeof expected === "number" && TIMING_FIELD_KEYS.has(leafKey(path))) {
    expect(typeof actual, `expected numeric timing at ${path}`).toBe("number");
    const diff = Math.abs(actual - expected);
    expect(
      diff <= TIMING_TOLERANCE_MS,
      `timing drift at ${path}: ${actual} vs ${expected} (±${TIMING_TOLERANCE_MS}ms)`
    ).toBe(true);
    return;
  }
  expect(actual, `mismatch at ${path}`).toBe(expected);
}

function leafKey(path) {
  const dot = path.lastIndexOf(".");
  const bracket = path.lastIndexOf("[");
  const cut = Math.max(dot, bracket);
  if (cut === -1) return path;
  return path.slice(dot + 1);
}

function readFixture(stack) {
  const dir = join(FIXTURES_ROOT, stack, "golden-path");
  const stdout = existsSync(join(dir, "captured-stdout.txt"))
    ? readFileSync(join(dir, "captured-stdout.txt"), "utf8")
    : "";
  const stderr = existsSync(join(dir, "captured-stderr.txt"))
    ? readFileSync(join(dir, "captured-stderr.txt"), "utf8")
    : "";
  const exitRaw = existsSync(join(dir, "captured-exit.txt"))
    ? readFileSync(join(dir, "captured-exit.txt"), "utf8").trim()
    : "0";
  const exitCode = Number.parseInt(exitRaw, 10) || 0;
  const expected = JSON.parse(readFileSync(join(dir, "expected-evidence.json"), "utf8"));
  return { dir, stdout, stderr, exitCode, expected };
}

// ─── Golden-path regression per stack (AC1, AC2) ────────────────────────────

const STACKS = [
  { name: "js", adapter: jsAdapter },
  { name: "python", adapter: pythonAdapter },
  { name: "java", adapter: javaAdapter },
  { name: "go", adapter: goAdapter },
  { name: "flutter", adapter: flutterAdapter },
];

describe("E25-S8 multi-stack golden-path regression", () => {
  for (const { name, adapter } of STACKS) {
    it(`${name} adapter produces evidence matching the golden fixture`, () => {
      const { dir, stdout, stderr, exitCode, expected } = readFixture(name);
      const actual = adapter.parseOutput(stdout, stderr, exitCode, {
        _projectPath: dir,
      });
      matchEvidence(actual, expected);
    });
  }
});

// ─── Adapter contract enforcement (AC5 / TEB-MS-R08) ────────────────────────

const REQUIRED_FIELDS = [
  "name",
  "detectionPatterns",
  "readinessCheck",
  "discoverRunners",
  "parseOutput",
];

function makeFakeAdapter() {
  return {
    name: "fake",
    detectionPatterns: ["fake.json"],
    readinessCheck: () => ({ ready: true }),
    discoverRunners: async () => ({ runners: [] }),
    parseOutput: () => ({ summary: {}, tests: [] }),
  };
}

describe("E25-S8 adapter contract enforcement (TEB-MS-R08)", () => {
  for (const field of REQUIRED_FIELDS) {
    it(`throws a loud error when required field '${field}' is missing`, () => {
      const fake = makeFakeAdapter();
      delete fake[field];
      expect(() => validateAdapter(fake, "./fake-adapter.js")).toThrow(
        new RegExp(`missing field: ${field}`)
      );
    });
  }

  it("throws when the adapter is not an object at all", () => {
    expect(() => validateAdapter(null, "./null-adapter.js")).toThrow(/adapter is not an object/);
  });
});
