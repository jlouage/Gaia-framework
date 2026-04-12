/**
 * E19-S25 — Coverage Calculation Unit Tests
 *
 * Tests the calculateCoverage and bankersRound functions from coverage-calc.js
 * using golden-file fixtures for regression testing and inline tests for
 * edge cases and determinism verification.
 *
 * Golden-file fixtures live in __fixtures__/coverage-calc/ and assert exact
 * deep-equality between computed output and committed golden output (AC2).
 *
 * Determinism test (AC4): runs the same computation twice and asserts
 * byte-identical JSON serialization.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { calculateCoverage, bankersRound } from "../coverage-calc.js";

// ─── Golden-file fixture tests (AC2) ───────────────────────────────

const FIXTURES_DIR = join(
  import.meta.dirname,
  "..",
  "__fixtures__",
  "coverage-calc",
);

const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) =>
  f.endsWith(".json"),
);

describe("calculateCoverage — golden-file fixtures", () => {
  for (const file of fixtureFiles) {
    it(`fixture: ${file}`, () => {
      const fixture = JSON.parse(
        readFileSync(join(FIXTURES_DIR, file), "utf-8"),
      );
      const result = calculateCoverage(fixture.input);
      expect(result).toEqual(fixture.expected);
    });
  }
});

// ─── Pure function and edge case tests (AC1) ───────────────────────

describe("calculateCoverage — edge cases", () => {
  it("returns empty result for null input", () => {
    expect(calculateCoverage(null)).toEqual({ perModule: {}, overall: 0 });
  });

  it("returns empty result for undefined input", () => {
    expect(calculateCoverage(undefined)).toEqual({
      perModule: {},
      overall: 0,
    });
  });

  it("returns empty result for input without modules array", () => {
    expect(calculateCoverage({ modules: "not-an-array" })).toEqual({
      perModule: {},
      overall: 0,
    });
  });

  it("handles mixed zero and non-zero totals", () => {
    const result = calculateCoverage({
      modules: [
        { name: "a", covered: 0, total: 0 },
        { name: "b", covered: 5, total: 10 },
      ],
    });
    expect(result.perModule.a).toBe(0);
    expect(result.perModule.b).toBe(50);
    // overall: 5/10 = 50
    expect(result.overall).toBe(50);
  });

  it("produces sorted keys regardless of input order", () => {
    const result1 = calculateCoverage({
      modules: [
        { name: "z", covered: 1, total: 10 },
        { name: "a", covered: 9, total: 10 },
      ],
    });
    const result2 = calculateCoverage({
      modules: [
        { name: "a", covered: 9, total: 10 },
        { name: "z", covered: 1, total: 10 },
      ],
    });
    expect(Object.keys(result1.perModule)).toEqual(["a", "z"]);
    expect(Object.keys(result2.perModule)).toEqual(["a", "z"]);
    expect(result1).toEqual(result2);
  });

  it("handles single module with partial coverage", () => {
    const result = calculateCoverage({
      modules: [{ name: "core", covered: 3, total: 7 }],
    });
    // 3/7 * 100 = 42.857142... -> rounds to 42.9
    expect(result.perModule.core).toBe(42.9);
    expect(result.overall).toBe(42.9);
  });
});

// ─── Banker's rounding tests ────────────────────────────────────────

describe("bankersRound", () => {
  it("rounds 0.5 to 0 (even)", () => {
    expect(bankersRound(0.5, 0)).toBe(0);
  });

  it("rounds 1.5 to 2 (even)", () => {
    expect(bankersRound(1.5, 0)).toBe(2);
  });

  it("rounds 2.5 to 2 (even)", () => {
    expect(bankersRound(2.5, 0)).toBe(2);
  });

  it("rounds 3.5 to 4 (even)", () => {
    expect(bankersRound(3.5, 0)).toBe(4);
  });

  it("rounds 66.65 to 66.6 (even digit at rounding position)", () => {
    expect(bankersRound(66.65, 1)).toBe(66.6);
  });

  it("rounds 66.75 to 66.8 (odd digit rounds up to even)", () => {
    expect(bankersRound(66.75, 1)).toBe(66.8);
  });

  it("rounds non-0.5 values normally", () => {
    expect(bankersRound(66.64, 1)).toBe(66.6);
    expect(bankersRound(66.66, 1)).toBe(66.7);
  });
});

// ─── Determinism test (AC4) ─────────────────────────────────────────

describe("calculateCoverage — determinism", () => {
  it("produces byte-identical output on consecutive runs", () => {
    const input = {
      modules: [
        { name: "lifecycle", covered: 42, total: 67 },
        { name: "core", covered: 15, total: 20 },
        { name: "dev", covered: 88, total: 100 },
        { name: "testing", covered: 3, total: 11 },
        { name: "creative", covered: 0, total: 5 },
      ],
    };

    const run1 = JSON.stringify(calculateCoverage(input));
    const run2 = JSON.stringify(calculateCoverage(input));

    expect(run1).toBe(run2);
  });

  it("produces byte-identical output with reversed input order", () => {
    const modules = [
      { name: "z", covered: 7, total: 13 },
      { name: "m", covered: 22, total: 30 },
      { name: "a", covered: 1, total: 9 },
    ];

    const forward = JSON.stringify(
      calculateCoverage({ modules }),
    );
    const reversed = JSON.stringify(
      calculateCoverage({ modules: [...modules].reverse() }),
    );

    expect(forward).toBe(reversed);
  });
});
