/**
 * Performance Benchmark Runner (E7-S5)
 *
 * Measures CLI cold start, init, and validate command P95 latencies
 * across configurable iterations. Produces a JSON artifact for CI.
 *
 * Usage:
 *   import { runBenchmarkSuite, calculateP95, THRESHOLDS } from './benchmark-runner.js';
 *   const results = await runBenchmarkSuite({ iterations: 10 });
 *
 * Or run directly:
 *   node scripts/benchmark-runner.js [--iterations N] [--output path]
 */

import { execFileSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { platform } from "os";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

/** Threshold constants in milliseconds */
export const THRESHOLDS = {
  coldStart: 500,
  init: 5000,
  validate: 2000,
};

/**
 * Calculate P95 from an array of timing values.
 * P95 = value at index ceil(0.95 * N) - 1 in sorted array.
 *
 * @param {number[]} timings - Array of timing values in ms
 * @returns {number} P95 value
 */
export function calculateP95(timings) {
  const sorted = [...timings].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[index];
}

/**
 * Check if a P95 measurement breaches its threshold.
 *
 * @param {string} command - Command name (coldStart, init, validate)
 * @param {number} p95 - P95 measurement in ms
 * @param {number} threshold - Threshold in ms
 * @returns {{ command: string, p95: number, threshold: number, breached: boolean, severe: boolean }}
 */
export function checkThresholdBreach(command, p95, threshold) {
  const breached = p95 > threshold;
  // Severe = exceeded by more than 50%
  const severe = breached && p95 > threshold * 1.5;
  return { command, p95, threshold, breached, severe };
}

/**
 * Generate GitHub Actions warning annotations for threshold breaches.
 *
 * @param {{ command: string, p95: number, threshold: number, breached: boolean, severe: boolean }[]} breaches
 * @returns {string[]} Array of annotation strings
 */
export function generateAnnotations(breaches) {
  const annotations = [];
  for (const b of breaches) {
    if (b.breached) {
      annotations.push(
        `::warning::Performance threshold breached: ${b.command} P95=${b.p95}ms exceeds ${b.threshold}ms threshold`
      );
      if (b.severe) {
        annotations.push(
          `::warning::SEVERE: ${b.command} P95=${b.p95}ms exceeds threshold by >50%%. Add performance-degradation label.`
        );
      }
    }
  }
  return annotations;
}

/**
 * Measure execution time of a command over N iterations.
 *
 * @param {string} cmd - Command to execute
 * @param {string[]} args - Command arguments
 * @param {number} iterations - Number of iterations
 * @param {object} [options] - execFileSync options
 * @returns {number[]} Array of timing values in ms
 */
function measureCommand(cmd, args, iterations, options = {}) {
  const timings = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    try {
      execFileSync(cmd, args, {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30000,
        ...options,
      });
    } catch {
      // Command may fail — we still record the timing
    }
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    timings.push(Math.round(durationMs * 100) / 100);
  }
  return timings;
}

/**
 * Run the full benchmark suite.
 *
 * @param {{ iterations?: number, dryRun?: boolean, output?: string }} [options]
 * @returns {Promise<{ metadata: object, benchmarks: object }>}
 */
export async function runBenchmarkSuite(options = {}) {
  const iterations = options.iterations ?? 10;
  const dryRun = options.dryRun ?? false;

  const metadata = {
    runner_type: process.env.RUNNER_OS || platform(),
    node_version: process.version,
    timestamp: new Date().toISOString(),
    iterations,
  };

  const benchmarks = {};

  /**
   * Benchmark a single command and return its result entry.
   * @param {string} name - Benchmark name (key in THRESHOLDS)
   * @param {string} cmd - Executable command
   * @param {string[]} cmdArgs - Command arguments
   * @param {number} runs - Number of iterations
   * @param {object} [opts] - Additional execFileSync options
   */
  function bench(name, cmd, cmdArgs, runs, opts) {
    const timings = measureCommand(cmd, cmdArgs, runs, opts);
    const p95 = calculateP95(timings);
    const breach = checkThresholdBreach(name, p95, THRESHOLDS[name]);
    return { timings, p95, threshold: THRESHOLDS[name], status: breach.breached ? "warn" : "pass" };
  }

  const cliPath = join(PROJECT_ROOT, "bin", "gaia-framework.js");
  const installerPath = join(PROJECT_ROOT, "gaia-install.sh");

  // Cold start is always measured (even in dry run, with 1 iteration)
  benchmarks.coldStart = bench(
    "coldStart",
    "node",
    [cliPath, "--version"],
    dryRun ? 1 : iterations
  );

  if (!dryRun) {
    benchmarks.init = bench(
      "init",
      "bash",
      [installerPath, "init", "--source", PROJECT_ROOT, "--yes", "/tmp/gaia-bench-init"],
      iterations,
      { env: { ...process.env, HOME: process.env.HOME } }
    );

    benchmarks.validate = bench("validate", "bash", [installerPath, "validate"], iterations);
  }

  const results = { metadata, benchmarks };

  // Write artifact if output path specified
  if (options.output) {
    const outputDir = dirname(options.output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    writeFileSync(options.output, JSON.stringify(results, null, 2));
  }

  return results;
}

// CLI entry point
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = process.argv.slice(2);
  const iterIdx = args.indexOf("--iterations");
  const outIdx = args.indexOf("--output");

  const iterations = iterIdx >= 0 ? parseInt(args[iterIdx + 1], 10) : 10;
  const output =
    outIdx >= 0
      ? args[outIdx + 1]
      : join(PROJECT_ROOT, "test-artifacts", "performance-baseline.json");

  runBenchmarkSuite({ iterations, output }).then((results) => {
    // Print summary table
    console.log("\n=== Performance Benchmark Results ===\n");
    console.log("Command        | P95 (ms)  | Threshold | Status");
    console.log("-------------- | --------- | --------- | ------");
    for (const [cmd, data] of Object.entries(results.benchmarks)) {
      const status = data.status === "pass" ? "PASS" : "WARN";
      console.log(
        `${cmd.padEnd(14)} | ${String(data.p95).padEnd(9)} | ${String(data.threshold).padEnd(9)} | ${status}`
      );
    }

    // Emit CI annotations
    const breaches = Object.entries(results.benchmarks).map(([cmd, data]) =>
      checkThresholdBreach(cmd, data.p95, data.threshold)
    );
    const annotations = generateAnnotations(breaches);
    for (const ann of annotations) {
      console.log(ann);
    }

    console.log(`\nResults written to: ${output}`);
    console.log(`Runner: ${results.metadata.runner_type}, Node: ${results.metadata.node_version}`);
  });
}
