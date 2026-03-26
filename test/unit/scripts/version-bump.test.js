/**
 * Unit tests for scripts/version-bump.js
 * Tests all 8 acceptance criteria for E5-S7
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SCRIPT = path.resolve(__dirname, "../../../scripts/version-bump.js");

/**
 * Create a temporary directory with fixture files mimicking
 * the 6 global version files the script must update.
 */
function createFixtures(version = "1.0.0") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vbump-"));

  // 1. package.json
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "test", version, scripts: {} }, null, 2) + "\n",
  );

  // 2. gaia-install.sh
  fs.writeFileSync(
    path.join(dir, "gaia-install.sh"),
    `#!/usr/bin/env bash\nreadonly VERSION="${version}"\n`,
  );

  // 3. _gaia/_config/global.yaml
  fs.mkdirSync(path.join(dir, "_gaia", "_config"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "_gaia", "_config", "global.yaml"),
    `framework_name: "GAIA"\nframework_version: "${version}"\n`,
  );

  // 4. _gaia/_config/manifest.yaml
  fs.writeFileSync(
    path.join(dir, "_gaia", "_config", "manifest.yaml"),
    [
      "modules:",
      '  - name: core',
      '    version: "1.0.0"',
      '    path: "_gaia/core"',
      '  - name: lifecycle',
      '    version: "1.0.0"',
      '    path: "_gaia/lifecycle"',
      '  - name: dev',
      '    version: "1.0.0"',
      '    path: "_gaia/dev"',
      '  - name: creative',
      '    version: "1.0.0"',
      '    path: "_gaia/creative"',
      '  - name: testing',
      '    version: "1.0.0"',
      '    path: "_gaia/testing"',
      "",
    ].join("\n"),
  );

  // 5. CLAUDE.md
  fs.writeFileSync(
    path.join(dir, "CLAUDE.md"),
    `\n# GAIA Framework v${version}\n\nSome content here.\n`,
  );

  // 6. README.md
  fs.writeFileSync(
    path.join(dir, "README.md"),
    [
      `[![Framework](https://img.shields.io/badge/framework-v${version}-blue)]()`,
      "",
      "```yaml",
      `framework_version: "${version}"`,
      "```",
      "",
    ].join("\n"),
  );

  // Module config.yaml files
  for (const mod of ["core", "lifecycle", "dev", "creative", "testing"]) {
    fs.mkdirSync(path.join(dir, "_gaia", mod), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "_gaia", mod, "config.yaml"),
      `module_name: ${mod}\nmodule_version: "1.0.0"\n`,
    );
  }

  return dir;
}

function runBump(dir, args = []) {
  return execFileSync("node", [SCRIPT, ...args], {
    cwd: dir,
    env: { ...process.env, GAIA_PROJECT_ROOT: dir },
    encoding: "utf8",
    timeout: 10000,
  });
}

function runBumpError(dir, args = []) {
  try {
    execFileSync("node", [SCRIPT, ...args], {
      cwd: dir,
      env: { ...process.env, GAIA_PROJECT_ROOT: dir },
      encoding: "utf8",
      timeout: 10000,
    });
    return { stdout: "", exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.status };
  }
}

function readVersion(dir, file) {
  return fs.readFileSync(path.join(dir, file), "utf8");
}

describe("version-bump.js", () => {
  let dir;

  beforeEach(() => {
    dir = createFixtures("1.0.0");
  });

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  // AC1: patch/minor/major bumps update all 6 global files atomically
  describe("AC1 — bump type updates all 6 global files", () => {
    it("patch bump: 1.0.0 → 1.0.1 across all 6 files", () => {
      runBump(dir, ["patch"]);

      const pkg = JSON.parse(readVersion(dir, "package.json"));
      expect(pkg.version).toBe("1.0.1");

      const installer = readVersion(dir, "gaia-install.sh");
      expect(installer).toContain('readonly VERSION="1.0.1"');

      const global = readVersion(dir, "_gaia/_config/global.yaml");
      expect(global).toContain('framework_version: "1.0.1"');

      const claude = readVersion(dir, "CLAUDE.md");
      expect(claude).toContain("# GAIA Framework v1.0.1");

      const readme = readVersion(dir, "README.md");
      expect(readme).toContain("framework-v1.0.1-blue");
      expect(readme).toContain('framework_version: "1.0.1"');
    });

    it("minor bump: 1.0.0 → 1.1.0", () => {
      runBump(dir, ["minor"]);
      const pkg = JSON.parse(readVersion(dir, "package.json"));
      expect(pkg.version).toBe("1.1.0");
    });

    it("major bump: 1.0.0 → 2.0.0", () => {
      runBump(dir, ["major"]);
      const pkg = JSON.parse(readVersion(dir, "package.json"));
      expect(pkg.version).toBe("2.0.0");
    });
  });

  // AC2: --modules flag updates specified module configs + manifest entries
  describe("AC2 — --modules updates specified modules", () => {
    it("--modules core,dev updates those module configs and manifest entries", () => {
      runBump(dir, ["patch", "--modules", "core,dev"]);

      const coreConfig = readVersion(dir, "_gaia/core/config.yaml");
      expect(coreConfig).toContain('module_version: "1.0.1"');

      const devConfig = readVersion(dir, "_gaia/dev/config.yaml");
      expect(devConfig).toContain('module_version: "1.0.1"');

      // Untouched modules stay at 1.0.0
      const lifecycleConfig = readVersion(dir, "_gaia/lifecycle/config.yaml");
      expect(lifecycleConfig).toContain('module_version: "1.0.0"');

      // Manifest entries for core and dev updated
      const manifest = readVersion(dir, "_gaia/_config/manifest.yaml");
      // core version line should be 1.0.1
      const lines = manifest.split("\n");
      let coreIdx = lines.findIndex((l) => l.includes("name: core"));
      expect(lines[coreIdx + 1].trim()).toContain('"1.0.1"');
      let devIdx = lines.findIndex((l) => l.includes("name: dev"));
      expect(lines[devIdx + 1].trim()).toContain('"1.0.1"');
      // lifecycle should still be 1.0.0
      let lcIdx = lines.findIndex((l) => l.includes("name: lifecycle"));
      expect(lines[lcIdx + 1].trim()).toContain('"1.0.0"');
    });
  });

  // AC3: no --modules flag means no module configs touched
  describe("AC3 — omitting --modules leaves module configs untouched", () => {
    it("patch without --modules does not touch module config.yaml files", () => {
      runBump(dir, ["patch"]);

      for (const mod of ["core", "lifecycle", "dev", "creative", "testing"]) {
        const config = readVersion(dir, `_gaia/${mod}/config.yaml`);
        expect(config).toContain('module_version: "1.0.0"');
      }
    });
  });

  // AC4: --dry-run prints diff but writes nothing
  describe("AC4 — dry-run mode", () => {
    it("prints diff-like summary and writes nothing to disk", () => {
      const stdout = runBump(dir, ["patch", "--dry-run"]);

      // Should contain file paths and version changes
      expect(stdout).toContain("1.0.0");
      expect(stdout).toContain("1.0.1");

      // Files should NOT be modified
      const pkg = JSON.parse(readVersion(dir, "package.json"));
      expect(pkg.version).toBe("1.0.0");
    });
  });

  // AC5: missing/unreadable file halts before writing
  describe("AC5 — missing file halts with error", () => {
    it("halts and names the missing file when CLAUDE.md is deleted", () => {
      fs.unlinkSync(path.join(dir, "CLAUDE.md"));
      const result = runBumpError(dir, ["patch"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr + result.stdout).toContain("CLAUDE.md");

      // Other files should NOT have been written
      const pkg = JSON.parse(readVersion(dir, "package.json"));
      expect(pkg.version).toBe("1.0.0");
    });
  });

  // AC6: version drift detection
  describe("AC6 — version drift detection", () => {
    it("detects and reports divergent versions across files", () => {
      // Set global.yaml to a different version
      fs.writeFileSync(
        path.join(dir, "_gaia", "_config", "global.yaml"),
        'framework_name: "GAIA"\nframework_version: "1.0.1"\n',
      );

      const result = runBumpError(dir, ["patch"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/drift|diverge|mismatch/i);
    });
  });

  // AC7: invalid module name rejection
  describe("AC7 — invalid module name rejected", () => {
    it("rejects invalid module name with valid list", () => {
      const result = runBumpError(dir, ["patch", "--modules", "coer"]);

      expect(result.exitCode).not.toBe(0);
      const output = result.stderr + result.stdout;
      expect(output).toContain("coer");
      expect(output).toMatch(/core|lifecycle|dev|creative|testing/);
    });
  });

  // AC8: post-bump reminder displayed
  describe("AC8 — post-bump reminder", () => {
    it("displays /gaia-build-configs reminder after successful bump", () => {
      const stdout = runBump(dir, ["patch"]);
      expect(stdout).toContain("gaia-build-configs");
    });
  });
});
