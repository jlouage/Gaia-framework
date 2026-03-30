/**
 * Integration Test: Performance Regression Benchmarks (E7-S5)
 *
 * Measures CLI cold start, init, and validate command P95 latencies
 * across 10 iterations and records results to a JSON artifact.
 *
 * Covers: AC1 (benchmark execution + JSON artifact), AC2 (cold start <500ms),
 *         AC3 (init <5s), AC4 (validate <2s), AC5 (soft gate — exit 0),
 *         AC6 (runner type + Node.js version in artifact),
 *         AC7 (>50% threshold breach detection)
 */

import { describe, it, expect } from "vitest";
import { resolve } from "path";

// Import the benchmark runner module (does not exist yet — RED phase)
// This will fail because the module has not been created yet.
import {
  runBenchmarkSuite,
  calculateP95,
  THRESHOLDS,
  checkThresholdBreach,
  generateAnnotations,
} from "../../scripts/benchmark-runner.mjs";

const _PROJECT_ROOT = resolve(import.meta.dirname, "../..");

describe("Performance Benchmarks (E7-S5)", () => {
  describe("AC1: Benchmark execution and JSON artifact", () => {
    it("should export a runBenchmarkSuite function", () => {
      expect(typeof runBenchmarkSuite).toBe("function");
    });

    it("should export a calculateP95 function", () => {
      expect(typeof calculateP95).toBe("function");
    });

    it("should export THRESHOLDS constants", () => {
      expect(THRESHOLDS).toBeDefined();
      expect(typeof THRESHOLDS.coldStart).toBe("number");
      expect(typeof THRESHOLDS.init).toBe("number");
      expect(typeof THRESHOLDS.validate).toBe("number");
    });
  });

  describe("AC2: Cold start P95 threshold", () => {
    it("should define cold start threshold as 500ms", () => {
      expect(THRESHOLDS.coldStart).toBe(500);
    });
  });

  describe("AC3: Init P95 threshold", () => {
    it("should define init threshold as 5000ms", () => {
      expect(THRESHOLDS.init).toBe(5000);
    });
  });

  describe("AC4: Validate P95 threshold", () => {
    it("should define validate threshold as 2000ms", () => {
      expect(THRESHOLDS.validate).toBe(2000);
    });
  });

  describe("P95 calculation", () => {
    it("should calculate P95 from a sorted array of 10 timings", () => {
      // 10 values: P95 = value at index ceil(0.95 * 10) - 1 = index 9
      const timings = [100, 110, 120, 130, 140, 150, 160, 170, 180, 900];
      const p95 = calculateP95(timings);
      expect(p95).toBe(900);
    });

    it("should calculate P95 from unsorted timings", () => {
      const timings = [150, 100, 900, 130, 170, 120, 140, 180, 110, 160];
      const p95 = calculateP95(timings);
      expect(p95).toBe(900);
    });

    it("should handle a single timing value", () => {
      const p95 = calculateP95([250]);
      expect(p95).toBe(250);
    });
  });

  describe("AC5: Soft gate behavior", () => {
    it("should export a checkThresholdBreach function", () => {
      expect(typeof checkThresholdBreach).toBe("function");
    });

    it("should return breach info when P95 exceeds threshold", () => {
      const result = checkThresholdBreach("coldStart", 600, THRESHOLDS.coldStart);
      expect(result.breached).toBe(true);
      expect(result.p95).toBe(600);
      expect(result.threshold).toBe(500);
    });

    it("should return no breach when P95 is within threshold", () => {
      const result = checkThresholdBreach("coldStart", 400, THRESHOLDS.coldStart);
      expect(result.breached).toBe(false);
    });
  });

  describe("AC6: Runner type and Node.js version in artifact", () => {
    it("should include runner_type in benchmark results", async () => {
      // runBenchmarkSuite should return results with metadata
      const results = await runBenchmarkSuite({ iterations: 1, dryRun: true });
      expect(results.metadata).toBeDefined();
      expect(results.metadata.runner_type).toBeDefined();
      expect(typeof results.metadata.runner_type).toBe("string");
    });

    it("should include node_version in benchmark results", async () => {
      const results = await runBenchmarkSuite({ iterations: 1, dryRun: true });
      expect(results.metadata).toBeDefined();
      expect(results.metadata.node_version).toBeDefined();
      expect(results.metadata.node_version).toBe(process.version);
    });

    it("should include timestamp in benchmark results", async () => {
      const results = await runBenchmarkSuite({ iterations: 1, dryRun: true });
      expect(results.metadata).toBeDefined();
      expect(results.metadata.timestamp).toBeDefined();
    });
  });

  describe("AC7: Performance degradation detection (>50% breach)", () => {
    it("should export a generateAnnotations function", () => {
      expect(typeof generateAnnotations).toBe("function");
    });

    it("should flag severe breach when P95 exceeds threshold by >50%", () => {
      // 500ms threshold, 800ms P95 = 60% over → severe
      const result = checkThresholdBreach("coldStart", 800, THRESHOLDS.coldStart);
      expect(result.breached).toBe(true);
      expect(result.severe).toBe(true);
    });

    it("should not flag severe breach when P95 exceeds threshold by <50%", () => {
      // 500ms threshold, 600ms P95 = 20% over → not severe
      const result = checkThresholdBreach("coldStart", 600, THRESHOLDS.coldStart);
      expect(result.breached).toBe(true);
      expect(result.severe).toBe(false);
    });

    it("should generate warning annotations for breaches", () => {
      const breaches = [
        { command: "coldStart", p95: 600, threshold: 500, breached: true, severe: false },
      ];
      const annotations = generateAnnotations(breaches);
      expect(annotations.length).toBeGreaterThan(0);
      expect(annotations[0]).toContain("::warning::");
    });

    it("should include performance-degradation label signal for severe breaches", () => {
      const breaches = [
        { command: "coldStart", p95: 800, threshold: 500, breached: true, severe: true },
      ];
      const annotations = generateAnnotations(breaches);
      const hasSevereAnnotation = annotations.some((a) => a.includes("performance-degradation"));
      expect(hasSevereAnnotation).toBe(true);
    });
  });

  describe("JSON artifact format", () => {
    it("should produce results with raw timings array per command", async () => {
      const results = await runBenchmarkSuite({ iterations: 1, dryRun: true });
      expect(results.benchmarks).toBeDefined();
      expect(Array.isArray(results.benchmarks.coldStart?.timings)).toBe(true);
    });

    it("should produce results with P95 value per command", async () => {
      const results = await runBenchmarkSuite({ iterations: 1, dryRun: true });
      expect(typeof results.benchmarks.coldStart?.p95).toBe("number");
    });

    it("should produce results with threshold per command", async () => {
      const results = await runBenchmarkSuite({ iterations: 1, dryRun: true });
      expect(results.benchmarks.coldStart?.threshold).toBe(THRESHOLDS.coldStart);
    });

    it("should produce results with pass/warn status per command", async () => {
      const results = await runBenchmarkSuite({ iterations: 1, dryRun: true });
      expect(["pass", "warn"]).toContain(results.benchmarks.coldStart?.status);
    });
  });
});
