import { defineConfig } from "vitest/config";

/**
 * Vitest config for Tier 2 (LLM-runtime) tests.
 * These tests cannot run in CI — they require Claude Code runtime.
 * Run manually: npx vitest run --config vitest.tier2.config.js
 */
export default defineConfig({
  test: {
    globals: true,
    root: ".",
    pool: "forks",
    include: ["test/validation/tier2/**/*.test.js"],
    testTimeout: 60000,
  },
});
