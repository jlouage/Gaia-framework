import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: ".",
    pool: "forks",
    include: ["test/validation/tier2/**/*.test.js"],
    testTimeout: 60000,
  },
});
