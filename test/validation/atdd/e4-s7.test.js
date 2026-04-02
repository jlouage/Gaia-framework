/**
 * ATDD — E4-S7: CI-Driven Version Sync in Publish Workflow
 *
 * Red phase: all tests must FAIL because the implementation does not exist yet.
 * - AC1–AC4: publish.yml lacks version-sync steps
 * - AC5–AC6: version-bump.js does not accept explicit version arguments
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const PUBLISH_WORKFLOW = path.join(PROJECT_ROOT, ".github", "workflows", "publish.yml");
const VERSION_BUMP_SCRIPT = path.join(PROJECT_ROOT, "scripts", "version-bump.js");

// ── Fixture helper (reuses convention from version-bump.test.js) ─────────

function createFixtures(version = "1.0.0") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e4s7-"));

  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "test", version, scripts: {} }, null, 2) + "\n"
  );
  fs.mkdirSync(path.join(dir, "_gaia", "_config"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "_gaia", "_config", "global.yaml"),
    `framework_name: "GAIA"\nframework_version: "${version}"\n`
  );
  fs.writeFileSync(
    path.join(dir, "CLAUDE.md"),
    `\n# GAIA Framework v${version}\n\nSome content here.\n`
  );
  fs.writeFileSync(
    path.join(dir, "README.md"),
    [
      `[![Framework](https://img.shields.io/badge/framework-v${version}-blue)]()`,
      "",
      "```yaml",
      `framework_version: "${version}"`,
      "```",
      "",
    ].join("\n")
  );

  return dir;
}

function runBump(dir, args = []) {
  return execFileSync("node", [VERSION_BUMP_SCRIPT, ...args], {
    cwd: dir,
    env: { ...process.env, GAIA_PROJECT_ROOT: dir },
    encoding: "utf8",
    timeout: 10000,
  });
}

function runBumpResult(dir, args = []) {
  try {
    const stdout = execFileSync("node", [VERSION_BUMP_SCRIPT, ...args], {
      cwd: dir,
      env: { ...process.env, GAIA_PROJECT_ROOT: dir },
      encoding: "utf8",
      timeout: 10000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: err.status,
    };
  }
}

describe("E4-S7: CI-Driven Version Sync in Publish Workflow", () => {
  // ── AC1: Publish workflow extracts version from git tag ────────────────

  describe("AC1: Tag version extraction", () => {
    it("test_ac1_tag_version_extraction — publish.yml has a step that extracts version from git tag and stores it", () => {
      const content = fs.readFileSync(PUBLISH_WORKFLOW, "utf-8");

      // Must have a dedicated step that strips 'v' prefix and stores the version
      // Current workflow only does this in verification — E4-S7 requires a sync step
      expect(content).toMatch(/name:.*(?:Extract|Derive|Sync).*version.*(?:from|tag)/i);

      // The extracted version must be exported/stored for downstream steps
      expect(content).toMatch(/TAG_VERSION.*\$\{.*tag_name.*\}/);

      // Must strip 'v' prefix: vX.Y.Z → X.Y.Z
      expect(content).toMatch(/TAG_VERSION.*#v|TAG_VERSION.*v}/);
    });
  });

  // ── AC2: Workflow invokes version-bump.js with tag-derived version ─────

  describe("AC2: Version-bump invocation with explicit version", () => {
    it("test_ac2_version_bump_invocation — publish.yml runs version-bump.js with the tag-derived version", () => {
      const content = fs.readFileSync(PUBLISH_WORKFLOW, "utf-8");

      // Must invoke version-bump.js (or npm run version:bump) with an explicit version
      expect(content).toMatch(/version-bump(?:\.js)?\s+\$|npm run version:bump.*\$/i);

      // The version argument must come from the tag extraction step, not be patch/minor/major
      // This confirms AC5 integration — explicit version, not bump type
      expect(content).toMatch(
        /version-bump(?:\.js)?\s+(?:"\$\{?TAG_VERSION|"\$TAG_VERSION|\$TAG_VERSION)/i
      );
    });
  });

  // ── AC3: Six-file verification with hard-fail ─────────────────────────

  describe("AC3: Five-file post-sync verification", () => {
    it("test_ac3_five_file_verification — publish.yml verifies all 5 files match after version sync", () => {
      const content = fs.readFileSync(PUBLISH_WORKFLOW, "utf-8");

      // Must have a dedicated verification step that checks all version files
      expect(content).toMatch(
        /name:.*(?:Verify|Check).*(?:all|5|five|6|six).*(?:file|version|sync)/i
      );

      // Must reference the 5 target files (gaia-install.sh removed — reads version from package.json at runtime)
      const fileRefs = [/package\.json/, /global\.yaml/, /CLAUDE\.md/, /README\.md/];
      let matchCount = 0;
      for (const pattern of fileRefs) {
        if (pattern.test(content)) matchCount++;
      }
      // At least 4 of the 5 files referenced (README.md has 2 patterns but 1 file)
      expect(matchCount).toBeGreaterThanOrEqual(4);

      // Must hard-fail (exit 1) on divergence
      expect(content).toMatch(/exit\s+1/);
    });
  });

  // ── AC4: Commit version-synced files before npm publish ───────────────

  describe("AC4: Commit before publish", () => {
    it("test_ac4_commit_before_publish — publish.yml commits synced files before npm publish step", () => {
      const content = fs.readFileSync(PUBLISH_WORKFLOW, "utf-8");

      // Must have a git commit step
      expect(content).toMatch(/git\s+commit/);

      // The commit must appear BEFORE the npm publish step
      const commitIdx = content.search(/git\s+commit/);
      const publishIdx = content.search(/npm\s+publish/);

      expect(commitIdx).toBeGreaterThan(-1);
      expect(publishIdx).toBeGreaterThan(-1);
      expect(commitIdx).toBeLessThan(publishIdx);

      // Must also push the commit so the tag points to the synced state
      expect(content).toMatch(/git\s+push/);
    });
  });

  // ── AC5: version-bump.js accepts explicit version argument ────────────

  describe("AC5: Explicit version argument", () => {
    let dir;

    beforeEach(() => {
      dir = createFixtures("1.0.0");
    });

    afterEach(() => {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    it("test_ac5_explicit_version_argument — version-bump.js accepts '1.2.3' as an explicit version", () => {
      // Pass an explicit semver instead of patch/minor/major
      const result = runBumpResult(dir, ["1.2.3"]);

      // Must succeed (exit 0)
      expect(result.exitCode).toBe(0);

      // Both global files must be updated to 1.2.3 (ADR-025: 2-file model)
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      expect(pkg.version).toBe("1.2.3");

      const global = fs.readFileSync(path.join(dir, "_gaia", "_config", "global.yaml"), "utf8");
      expect(global).toContain('framework_version: "1.2.3"');
    });

    it("test_ac5_explicit_version_rejects_invalid — rejects non-semver explicit version", () => {
      const result = runBumpResult(dir, ["abc"]);
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ── AC6: Existing unit tests extended for explicit version mode ────────

  describe("AC6: Unit test coverage for explicit version", () => {
    it("test_ac6_explicit_version_unit_tests — version-bump.test.js contains explicit version test cases", () => {
      const testFile = path.join(PROJECT_ROOT, "test", "unit", "scripts", "version-bump.test.js");
      const content = fs.readFileSync(testFile, "utf-8");

      // Must have test cases for explicit version (not just patch/minor/major)
      expect(content).toMatch(/explicit.*version|direct.*version/i);

      // Must test that an explicit semver (like "2.0.0" or "1.5.3") works
      expect(content).toMatch(/["']\d+\.\d+\.\d+["'].*(?:explicit|direct)/i);
    });
  });
});
