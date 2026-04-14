/**
 * E25-S8: Stack Adapter Registry Performance Gate (NFR-047)
 *
 * Enforces the NFR-047 performance budgets on every CI run:
 *
 *   - TEB-MS-S01: fresh 5-adapter registry init P95 < 50 ms
 *   - getAdapter single-stack selection P95 < 10 ms
 *   - TEB-MS-S02: getAdapter monorepo (multi-pattern) selection P95 < 25 ms
 *
 * Each benchmark runs 100 iterations and asserts on the 95th-percentile
 * latency (not the mean) so the gate is robust to GC pauses and CI noise.
 *
 * Traces: NFR-047, ADR-038 §10.20.11, TEB-MS-S01, TEB-MS-S02.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const ITERATIONS = 100;

// Measure a nullary function using process.hrtime.bigint and return
// elapsed milliseconds as a floating-point number.
function measureMs(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const elapsedNs = Number(process.hrtime.bigint() - start);
  return { ms: elapsedNs / 1e6, result };
}

async function measureMsAsync(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const elapsedNs = Number(process.hrtime.bigint() - start);
  return { ms: elapsedNs / 1e6, result };
}

function p95(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function mkSingleStack() {
  const dir = mkdtempSync(join(tmpdir(), "e25-s8-single-"));
  writeFileSync(join(dir, "package.json"), '{"name":"single","version":"1.0.0"}');
  return dir;
}

function mkMonorepo() {
  const dir = mkdtempSync(join(tmpdir(), "e25-s8-mono-"));
  // Multi-language project root — multiple detection patterns exist, the
  // registry must walk its priority chain to pick the first match.
  writeFileSync(join(dir, "package.json"), '{"name":"mono","version":"1.0.0"}');
  writeFileSync(join(dir, "pyproject.toml"), "[project]\nname='mono'\n");
  writeFileSync(join(dir, "pom.xml"), "<project/>");
  writeFileSync(join(dir, "go.mod"), "module mono\n");
  writeFileSync(join(dir, "pubspec.yaml"), "name: mono\n");
  return dir;
}

describe("E25-S8 registry performance gate (NFR-047)", () => {
  it("TEB-MS-S01: fresh registry init P95 < 50 ms over 100 iterations", async () => {
    const samples = [];
    for (let i = 0; i < ITERATIONS; i++) {
      // Cache-bust via a query-string import so each iteration re-evaluates
      // the module graph instead of returning the cached resolver.
      const url = `../../../_gaia/core/bridge/adapters/index.js?p95=${i}-${Math.random()}`;
      const { ms } = await measureMsAsync(() => import(url));
      samples.push(ms);
    }
    const latency = p95(samples);
    expect(
      latency,
      `registry init P95 ${latency.toFixed(2)}ms exceeds 50ms budget (NFR-047)`
    ).toBeLessThan(50);
  });

  it("getAdapter single-stack selection P95 < 10 ms over 100 iterations", async () => {
    const { getAdapter } = await import("../../../_gaia/core/bridge/adapters/index.js");
    const projectPath = mkSingleStack();
    try {
      const samples = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const { ms, result } = measureMs(() => getAdapter(projectPath));
        expect(result).not.toBeNull();
        expect(result.name).toBe("javascript");
        samples.push(ms);
      }
      const latency = p95(samples);
      expect(
        latency,
        `getAdapter single-stack P95 ${latency.toFixed(2)}ms exceeds 10ms`
      ).toBeLessThan(10);
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it("TEB-MS-S02: getAdapter monorepo selection P95 < 25 ms over 100 iterations", async () => {
    const { getAdapter } = await import("../../../_gaia/core/bridge/adapters/index.js");
    const projectPath = mkMonorepo();
    try {
      const samples = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const { ms, result } = measureMs(() => getAdapter(projectPath));
        expect(result).not.toBeNull();
        samples.push(ms);
      }
      const latency = p95(samples);
      expect(latency, `getAdapter monorepo P95 ${latency.toFixed(2)}ms exceeds 25ms`).toBeLessThan(
        25
      );
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });
});
