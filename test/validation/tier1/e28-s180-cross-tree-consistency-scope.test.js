// E28-S180 — Retire-path guard for cross-tree consistency tests.
//
// This test asserts that both legacy-tree consistency-test files carry an
// explicit scope comment clarifying that AC3a / AC6 manifest-coverage
// assertions apply only to legacy `_gaia/_config/*.csv` workflow entries.
// Native-plugin-only skills (e.g., `/gaia-release` in gaia-public) are
// intentionally absent from legacy `_gaia/_config/*.csv` and therefore out
// of scope for these tests.
//
// Background: E28-S167 finding #1 — adding `/gaia-release` rows to legacy
// `workflow-manifest.csv` and `gaia-help.csv` would force matching
// `workflow.yaml`, `lifecycle-sequence.yaml` entry, and `.claude/commands/*.md`
// stub under the legacy tree. Per ADR-049 (V1 retirement) the correct
// direction is NOT to expand legacy obligations. ADR-076 codifies the
// retire-path decision; this guard test prevents future maintainers from
// silently dropping the scope comment.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const MARKER = "E28-S180 scope:";

const FILES = [
  join(PROJECT_ROOT, "test", "validation", "tier1", "manifests.test.js"),
  join(PROJECT_ROOT, "test", "validation", "tier1", "slash-commands.test.js"),
];

describe("E28-S180: cross-tree consistency-test scope comment guard", () => {
  it.each(FILES)("file %s carries the E28-S180 scope marker", (filePath) => {
    const content = readFileSync(filePath, "utf8");
    expect(
      content.includes(MARKER),
      `${filePath} is missing the '${MARKER}' header comment that scopes ` +
        "the AC3a/AC6 manifest-coverage assertions to legacy-tree entries " +
        "only. See ADR-076."
    ).toBe(true);
  });
});
