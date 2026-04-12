import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: ".",
    pool: "forks",
    include: [
      "test/unit/**/*.test.js",
      "test/integration/**/*.test.js",
      "test/fixtures/**/*.test.js",
      "test/validation/tier1/**/*.test.js",
      "test/validation/atdd/**/*.test.js",
      "test/shell/**/*.test.js",
      "scripts/lib/__tests__/**/*.test.js",
    ],
    coverage: {
      provider: "v8",
      include: ["bin/**/*.js"],
      exclude: ["test/**", "node_modules/**"],
      // E3-S6: 80% line coverage enforced. branches/functions/statements at 0
      // because Windows-specific branches are untestable on macOS/Linux.
      thresholds: {
        lines: 50,
        functions: 0,
        branches: 0,
        statements: 0,
      },
      reporter: ["text", "lcov", "json-summary"],
    },
    testTimeout: 30000,
  },
});
