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
    ],
    coverage: {
      provider: "v8",
      include: ["bin/**/*.js"],
      exclude: ["test/**", "node_modules/**"],
      // TODO: E3-S6 raises thresholds to 80% — do not ship to production at 0%
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
      reporter: ["text", "lcov", "json-summary"],
    },
    testTimeout: 30000,
  },
});
