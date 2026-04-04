/**
 * E14-S12: Fix Publish Workflow Version Verification
 *
 * Validates that the publish workflow's verification step checks only
 * the 2 files that carry version numbers (package.json and global.yaml),
 * matching the ADR-025 2-file version model established by E14-S2.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const PUBLISH_WORKFLOW_PATH = resolve(PROJECT_ROOT, ".github/workflows/publish.yml");

describe("E14-S12 — Publish Workflow Version Verification (2-file model)", () => {
  let rawContent;

  beforeAll(() => {
    rawContent = readFileSync(PUBLISH_WORKFLOW_PATH, "utf8");
  });

  // AC1: Verification checks only package.json and global.yaml
  it("AC1 — verification step should check only package.json and global.yaml", () => {
    // Should contain checks for package.json and global.yaml
    expect(rawContent).toContain("package.json");
    expect(rawContent).toContain("global.yaml");

    // Extract the verification step content between its name and the next step
    const verifyStepMatch = rawContent.match(
      /- name: Verify version files synced\s*\n\s*run: \|([\s\S]*?)(?=\n\s*- name:)/
    );
    expect(verifyStepMatch).not.toBeNull();

    const verifyContent = verifyStepMatch[1];
    // Should have exactly 2 grep/check blocks (package.json and global.yaml)
    const grepChecks = verifyContent.match(/if\s.*grep|if\s.*\$PKG_VERSION/g);
    expect(grepChecks).toHaveLength(2);
  });

  // AC2: CLAUDE.md heading check removed
  it("AC2 — verification step should NOT check CLAUDE.md", () => {
    // The verification step should not reference CLAUDE.md at all
    const verifyStepMatch = rawContent.match(
      /- name: Verify version files synced\s*\n\s*run: \|([\s\S]*?)(?=\n\s*- name:)/
    );
    expect(verifyStepMatch).not.toBeNull();
    expect(verifyStepMatch[1]).not.toContain("CLAUDE.md");
  });

  // AC3: README.md badge check removed
  it("AC3 — verification step should NOT check README.md badge", () => {
    const verifyStepMatch = rawContent.match(
      /- name: Verify version files synced\s*\n\s*run: \|([\s\S]*?)(?=\n\s*- name:)/
    );
    expect(verifyStepMatch).not.toBeNull();
    expect(verifyStepMatch[1]).not.toContain("framework-v$VERSION-blue");
  });

  // AC4: README.md code block check removed
  it("AC4 — verification step should NOT check README.md code block", () => {
    const verifyStepMatch = rawContent.match(
      /- name: Verify version files synced\s*\n\s*run: \|([\s\S]*?)(?=\n\s*- name:)/
    );
    expect(verifyStepMatch).not.toBeNull();
    // Should not have a README.md-specific grep for framework_version
    expect(verifyStepMatch[1]).not.toMatch(/README\.md/);
  });

  // AC5: Step title and echo messages have no stale count references
  it("AC5 — step title should say 'Verify version files synced' (no count)", () => {
    expect(rawContent).toContain("Verify version files synced");
    expect(rawContent).not.toMatch(/Verify all \d+ version files synced/);
  });

  it("AC5 — echo messages should not reference stale file counts", () => {
    const verifyStepMatch = rawContent.match(
      /- name: Verify version files synced\s*\n\s*run: \|([\s\S]*?)(?=\n\s*- name:)/
    );
    expect(verifyStepMatch).not.toBeNull();
    const content = verifyStepMatch[1];
    // No "all 5" or "all 6" references
    expect(content).not.toMatch(/all \d+ version/i);
    // Success message should not have a count
    expect(content).toContain("All version files verified");
  });

  // AC6: git add stages only package.json and global.yaml
  it("AC6 — git add should stage only package.json and _gaia/_config/global.yaml", () => {
    const commitStepMatch = rawContent.match(
      /- name: Commit version-synced files\s*\n\s*run: \|([\s\S]*?)(?=\n\s*- name:)/
    );
    expect(commitStepMatch).not.toBeNull();
    const commitContent = commitStepMatch[1];

    // Should contain git add with only these 2 files
    expect(commitContent).toMatch(/git add package\.json _gaia\/_config\/global\.yaml\s*$/m);
    // Should NOT contain CLAUDE.md or README.md in git add
    expect(commitContent).not.toMatch(/git add.*CLAUDE\.md/);
    expect(commitContent).not.toMatch(/git add.*README\.md/);
  });

  // AC7: YAML syntax validity (basic structural check)
  it("AC7 — workflow file should be valid YAML", () => {
    expect(() => yaml.load(rawContent)).not.toThrow();
  });
});
