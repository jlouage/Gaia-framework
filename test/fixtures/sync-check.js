/**
 * Fixture Sync Check
 *
 * Verifies that test fixtures in mock-framework/ reflect the real framework
 * structure. Run as a pre-test sanity check to catch fixture drift.
 *
 * Usage: node test/fixtures/sync-check.js
 *        npm run fixtures:check
 */

const { existsSync } = require("fs");
const { resolve, join } = require("path");

const PROJECT_ROOT = resolve(__dirname, "../..");
const MOCK_FRAMEWORK_ROOT = join(PROJECT_ROOT, "test", "fixtures", "mock-framework");

// Key framework paths that must exist in the REAL framework
const EXPECTED_PATHS = [
  "_gaia/core/engine/workflow.xml",
  "_gaia/_config/global.yaml",
  "bin/gaia-framework.js",
  "gaia-install.sh",
  "package.json",
];

// Key structural paths that mock-framework MUST contain
// These are the minimum viable paths required by validate_source() and cmd_init
const MOCK_REQUIRED_PATHS = [
  "_gaia/_config/manifest.yaml",
  "_gaia/_config/global.yaml",
  ".claude/commands/gaia-test.md",
  "CLAUDE.md",
];

let exitCode = 0;

// Check real framework paths
for (const rel of EXPECTED_PATHS) {
  const fullPath = join(PROJECT_ROOT, rel);
  if (!existsSync(fullPath)) {
    console.error(`MISSING in real framework: ${rel}`);
    exitCode = 1;
  }
}

// Check mock-framework paths mirror required structure
for (const rel of MOCK_REQUIRED_PATHS) {
  const fullPath = join(MOCK_FRAMEWORK_ROOT, rel);
  if (!existsSync(fullPath)) {
    console.error(
      `MISSING in mock-framework: ${rel} — ` +
        `mock-framework must contain this path to be a valid test fixture. ` +
        `Create the file at test/fixtures/mock-framework/${rel}`
    );
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log("Fixture sync check passed — all expected paths exist.");
} else {
  console.error("Fixture sync check FAILED — some expected paths are missing.");
}

process.exit(exitCode);
