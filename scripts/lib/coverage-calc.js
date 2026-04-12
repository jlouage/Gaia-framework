/**
 * Coverage Calculation — E19-S25
 *
 * Shared pure-function module for per-module coverage percentage calculation.
 * Extracted from the prose description in E19-S5/S6 workflow instructions
 * (test-gap-analysis Step 4c, FR-225).
 *
 * This is the single source of truth for the coverage computation.
 * The test-gap-analysis workflow instructions reference this module
 * rather than restating the formula in prose.
 *
 * Contract:
 *   - Input: { modules: Array<{ name: string, covered: number, total: number }> }
 *   - Output: { perModule: Record<string, number>, overall: number }
 *   - Pure function: no side effects, no I/O, no Date.now(), no randomness
 *   - Deterministic: identical inputs always produce identical outputs
 *   - Division-by-zero safe: modules with total=0 yield 0% coverage
 *   - Rounding: one decimal place using banker's rounding (half-to-even)
 *
 * Historical context (from E19-S5/S6 prose):
 *   The per-module coverage percentage was originally described inline in
 *   Step 4c of test-gap-analysis/instructions.xml as:
 *     coverage_pct = (tested_acs / total_acs) * 100
 *   rounded to one decimal place with banker's rounding, division-by-zero
 *   yielding 0.0, and sorted ascending by coverage_pct then epic key.
 *
 * @param {{ modules: Array<{ name: string, covered: number, total: number }> }} input
 * @returns {{ perModule: Record<string, number>, overall: number }}
 */
export function calculateCoverage(input) {
  if (!input || !Array.isArray(input.modules)) {
    return { perModule: {}, overall: 0 };
  }

  const modules = input.modules;

  if (modules.length === 0) {
    return { perModule: {}, overall: 0 };
  }

  const perModule = {};
  let totalCovered = 0;
  let totalCount = 0;

  // Process modules in sorted order for deterministic output.
  // Sort by name to ensure consistent key insertion order.
  const sorted = [...modules].sort((a, b) => {
    const nameA = String(a.name || "");
    const nameB = String(b.name || "");
    return nameA.localeCompare(nameB);
  });

  for (const mod of sorted) {
    const name = String(mod.name || "");
    const covered = Number(mod.covered) || 0;
    const total = Number(mod.total) || 0;

    const pct = total === 0 ? 0 : bankersRound((covered / total) * 100, 1);
    perModule[name] = pct;

    totalCovered += covered;
    totalCount += total;
  }

  const overall =
    totalCount === 0
      ? 0
      : bankersRound((totalCovered / totalCount) * 100, 1);

  return { perModule, overall };
}

/**
 * Banker's rounding (half-to-even) to the specified number of decimal places.
 *
 * Standard Math.round has a bias toward rounding 0.5 up. Banker's rounding
 * rounds 0.5 to the nearest even digit, which eliminates systematic bias
 * and matches the rounding specified in E19-S6/FR-225.
 *
 * @param {number} value — the number to round
 * @param {number} decimals — number of decimal places (default 1)
 * @returns {number}
 */
export function bankersRound(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  const shifted = value * factor;
  const truncated = Math.trunc(shifted);
  const remainder = Math.abs(shifted - truncated);

  // If remainder is exactly 0.5, round to even
  if (Math.abs(remainder - 0.5) < 1e-9) {
    // truncated is the integer part; if it's even, keep it; if odd, go to next even
    return truncated % 2 === 0 ? truncated / factor : (truncated + Math.sign(shifted)) / factor;
  }

  // Otherwise, standard rounding
  return Math.round(shifted) / factor;
}
