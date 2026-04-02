#!/usr/bin/env node
"use strict";

/**
 * version-bump.js — Automate version sync across GAIA framework files.
 *
 * Usage:
 *   node scripts/version-bump.js <patch|minor|major|none|X.Y.Z> [--prerelease rc] [--strip-prerelease] [--modules mod1,mod2] [--dry-run]
 *
 * Updates 2 global files: package.json and _gaia/_config/global.yaml.
 * Supports RC prerelease versions (ADR-025 Model B).
 * Optionally updates module config.yaml and manifest.yaml entries when --modules is provided.
 *
 * Zero runtime dependencies (ADR-005). File-based regex patterns (ADR-006).
 */

const fs = require("node:fs");
const path = require("node:path");

// ── Configuration ───────────────────────────────────────────────────────────

const VALID_MODULES = ["core", "lifecycle", "dev", "creative", "testing"];
const BUMP_TYPES = ["patch", "minor", "major", "none"];

/**
 * Build a version-pattern descriptor for a single file.
 * @param {string} file   Absolute path
 * @param {string} label  Human-readable label
 * @param {RegExp} readRe Regex with one capture group for the full version string
 * @param {RegExp} replRe Regex with three capture groups: prefix, version, suffix
 */
function pat(file, label, readRe, replRe) {
  return {
    file,
    label,
    read: (c) => {
      const m = c.match(readRe);
      return m ? m[1] : null;
    },
    replace: (c, v) => c.replace(replRe, `$1${v}$3`),
  };
}

/**
 * The 2 global version targets: package.json and global.yaml (ADR-025).
 * gaia-install.sh was removed — it now reads version from package.json at runtime.
 * CLAUDE.md, README.md were removed — version is no longer hardcoded in those files.
 */
function globalFilePatterns(root) {
  const j = (...segs) => path.join(root, ...segs);
  return [
    pat(
      j("package.json"),
      "package.json",
      /"version"\s*:\s*"(\d+\.\d+\.\d+(?:-rc\.\d+)?)"/,
      /("version"\s*:\s*")(\d+\.\d+\.\d+(?:-rc\.\d+)?)(")/
    ),
    pat(
      j("_gaia", "_config", "global.yaml"),
      "_gaia/_config/global.yaml",
      /framework_version:\s*"(\d+\.\d+\.\d+(?:-rc\.\d+)?)"/,
      /(framework_version:\s*")(\d+\.\d+\.\d+(?:-rc\.\d+)?)(")/
    ),
  ];
}

// ── Semver helpers (inline, no deps — ADR-005) ─────────────────────────────

/**
 * Parse a version string into components. Supports both clean and RC formats.
 * @param {string} ver  Version string like "1.58.2" or "1.59.0-rc.3"
 * @returns {{ major: number, minor: number, patch: number, rc: number|null }} or null
 */
function parseSemver(ver) {
  const m = ver.match(/^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/);
  if (!m) return null;
  return {
    major: +m[1],
    minor: +m[2],
    patch: +m[3],
    rc: m[4] != null ? +m[4] : null,
  };
}

/**
 * Format a parsed version object back into a version string.
 * @param {{ major: number, minor: number, patch: number, rc: number|null }} v
 * @returns {string}
 */
function formatVersion(v) {
  const base = `${v.major}.${v.minor}.${v.patch}`;
  return v.rc != null ? `${base}-rc.${v.rc}` : base;
}

/**
 * Compute the new version based on bump type, prerelease mode, and strip mode.
 * Implements Model B bump logic (ADR-025).
 *
 * @param {string} currentVersion  Current version string
 * @param {string} bumpType        "patch" | "minor" | "major" | "none"
 * @param {string|null} prerelease "rc" or null
 * @param {boolean} stripPrerelease Whether to strip the RC suffix
 * @returns {string} New version string
 */
function computeNewVersion(currentVersion, bumpType, prerelease, stripPrerelease) {
  const parsed = parseSemver(currentVersion);
  if (!parsed) throw new Error(`Cannot parse version: ${currentVersion}`);

  // --strip-prerelease: remove RC suffix, no number change
  if (stripPrerelease) {
    return formatVersion({ ...parsed, rc: null });
  }

  // bump:none — increment RC counter only
  if (bumpType === "none") {
    if (parsed.rc == null) {
      console.error(
        `Error: No RC suffix to increment. Version "${currentVersion}" has no -rc.N suffix. Use a bump type (patch/minor/major) with --prerelease rc instead.`
      );
      process.exit(1);
    }
    return formatVersion({ ...parsed, rc: parsed.rc + 1 });
  }

  // --prerelease rc with bump type
  if (prerelease === "rc") {
    if (parsed.rc != null) {
      console.error(
        `Error: Version "${currentVersion}" already has an RC suffix. Use "none" to increment the RC counter, or --strip-prerelease to remove it first.`
      );
      process.exit(1);
    }

    if (bumpType === "major") {
      return formatVersion({ major: parsed.major + 1, minor: 0, patch: 0, rc: 1 });
    }
    if (bumpType === "minor") {
      return formatVersion({ major: parsed.major, minor: parsed.minor + 1, patch: 0, rc: 1 });
    }
    // patch
    return formatVersion({
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch + 1,
      rc: 1,
    });
  }

  // Standard bump (no prerelease)
  if (bumpType === "major")
    return formatVersion({ major: parsed.major + 1, minor: 0, patch: 0, rc: null });
  if (bumpType === "minor")
    return formatVersion({ major: parsed.major, minor: parsed.minor + 1, patch: 0, rc: null });
  return formatVersion({
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch + 1,
    rc: null,
  });
}

// ── File I/O helpers ────────────────────────────────────────────────────────

function resolveRoot() {
  return process.env.GAIA_PROJECT_ROOT || process.cwd();
}

function validateAndReadFiles(patterns) {
  const errors = [];
  const fileContents = new Map();

  for (const p of patterns) {
    if (!fileContents.has(p.file)) {
      if (!fs.existsSync(p.file)) {
        errors.push(`Missing: ${p.label} (${p.file})`);
        continue;
      }
      try {
        fileContents.set(p.file, fs.readFileSync(p.file, "utf8"));
      } catch (err) {
        errors.push(`Unreadable: ${p.label} (${p.file}) — ${err.message}`);
        continue;
      }
    }

    const content = fileContents.get(p.file);
    if (!p.read(content)) {
      errors.push(`No version pattern found in: ${p.label} (${p.file})`);
    }
  }

  return { errors, fileContents };
}

function detectDrift(patterns, fileContents) {
  const versions = new Map();

  for (const p of patterns) {
    const content = fileContents.get(p.file);
    if (!content) continue;
    const ver = p.read(content);
    if (ver) {
      if (!versions.has(ver)) versions.set(ver, []);
      versions.get(ver).push(p.label);
    }
  }

  if (versions.size <= 1) return null;

  const lines = ["Version drift detected — files contain different versions:"];
  for (const [ver, files] of versions.entries()) {
    lines.push(`  ${ver}: ${files.join(", ")}`);
  }
  lines.push("Resolve the divergence before bumping.");
  return lines.join("\n");
}

/** Deduplicated file labels for display. */
function uniqueLabels(patterns) {
  const seen = new Set();
  const labels = [];
  for (const p of patterns) {
    if (seen.has(p.file)) continue;
    seen.add(p.file);
    labels.push(p.label);
  }
  return labels;
}

// ── Module updates ──────────────────────────────────────────────────────────

function collectModuleMutations(root, modules, newVer) {
  const mutations = [];

  for (const mod of modules) {
    const configPath = path.join(root, "_gaia", mod, "config.yaml");
    if (!fs.existsSync(configPath)) {
      console.error(`Warning: Module config not found: ${configPath}`);
      continue;
    }
    const content = fs.readFileSync(configPath, "utf8");
    const oldMatch = content.match(/module_version:\s*"(\d+\.\d+\.\d+)"/);

    mutations.push({
      file: configPath,
      label: `_gaia/${mod}/config.yaml`,
      oldVer: oldMatch ? oldMatch[1] : "unknown",
      newVer,
      content: content.replace(/(module_version:\s*")(\d+\.\d+\.\d+)(")/, `$1${newVer}$3`),
    });
  }

  // Manifest — state-machine line scan for per-module version entries
  const manifestPath = path.join(root, "_gaia", "_config", "manifest.yaml");
  if (fs.existsSync(manifestPath)) {
    const lines = fs.readFileSync(manifestPath, "utf8").split("\n");
    let currentModule = null;

    for (let i = 0; i < lines.length; i++) {
      const nameMatch = lines[i].match(/^\s+-?\s*name:\s*(\w+)/);
      if (nameMatch) {
        currentModule = nameMatch[1];
        continue;
      }

      if (
        currentModule &&
        modules.includes(currentModule) &&
        /^\s+version:\s*"?\d+\.\d+\.\d+"?/.test(lines[i])
      ) {
        lines[i] = lines[i].replace(/(version:\s*")(\d+\.\d+\.\d+)(")/, `$1${newVer}$3`);
        currentModule = null;
      }
    }

    mutations.push({
      file: manifestPath,
      label: "_gaia/_config/manifest.yaml (module entries)",
      oldVer: "(various)",
      newVer,
      content: lines.join("\n"),
    });
  }

  return mutations;
}

function applyModuleUpdates(root, modules, newVer, dryRun) {
  const mutations = collectModuleMutations(root, modules, newVer);

  if (dryRun) {
    for (const m of mutations) console.log(`  ${m.label}: ${m.oldVer} → ${m.newVer}`);
  } else {
    for (const m of mutations) fs.writeFileSync(m.file, m.content, "utf8");
  }
}

// ── CLI argument parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  let bumpType = null;
  let explicitVersion = null;
  let modules = null;
  let dryRun = false;
  let prerelease = null;
  let stripPrerelease = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--strip-prerelease") {
      stripPrerelease = true;
    } else if (argv[i] === "--prerelease") {
      if (!argv[++i] || argv[i] !== "rc") {
        console.error("Error: --prerelease requires 'rc' as value.");
        process.exit(1);
      }
      prerelease = "rc";
    } else if (argv[i] === "--modules") {
      if (!argv[++i]) {
        console.error("Error: --modules requires a value.");
        process.exit(1);
      }
      modules = argv[i].split(",").map((s) => s.trim());
    } else if (BUMP_TYPES.includes(argv[i])) {
      bumpType = argv[i];
    } else if (parseSemver(argv[i])) {
      explicitVersion = argv[i];
    } else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }

  // --strip-prerelease is standalone — does not require a bump type
  if (stripPrerelease) {
    return { bumpType, explicitVersion, modules, dryRun, prerelease, stripPrerelease };
  }

  if (!bumpType && !explicitVersion) {
    console.error(
      "Usage: node scripts/version-bump.js <patch|minor|major|none|X.Y.Z> [--prerelease rc] [--strip-prerelease] [--modules mod1,mod2] [--dry-run]"
    );
    process.exit(1);
  }

  return { bumpType, explicitVersion, modules, dryRun, prerelease, stripPrerelease };
}

function resolveModules(modules) {
  if (!modules) return null;
  if (modules.length === 1 && modules[0] === "all") return [...VALID_MODULES];

  const invalid = modules.filter((m) => !VALID_MODULES.includes(m) && m !== "all");
  if (invalid.length > 0) {
    console.error(
      `Invalid module(s): ${invalid.join(", ")}. Valid: ${VALID_MODULES.join(", ")}, all`
    );
    process.exit(1);
  }
  return modules;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const {
    bumpType,
    explicitVersion,
    modules: rawModules,
    dryRun,
    prerelease,
    stripPrerelease,
  } = parseArgs(process.argv.slice(2));
  const modules = resolveModules(rawModules);
  const root = resolveRoot();
  const patterns = globalFilePatterns(root);

  // Validate all files exist and contain expected patterns
  const { errors, fileContents } = validateAndReadFiles(patterns);
  if (errors.length > 0) {
    console.error("Pre-validation failed:");
    errors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }

  // Detect version drift
  const drift = detectDrift(patterns, fileContents);
  if (drift) {
    if (explicitVersion) {
      console.log(
        "Warning: " +
          drift.replace(
            "Resolve the divergence before bumping.",
            "Proceeding with explicit version sync."
          )
      );
    } else {
      console.error(drift);
      process.exit(1);
    }
  }

  // Current → new version
  const currentVersion = patterns[0].read(fileContents.get(patterns[0].file));
  if (!parseSemver(currentVersion)) {
    console.error(`Cannot parse version: ${currentVersion}`);
    process.exit(1);
  }

  let newVersion;
  if (explicitVersion) {
    newVersion = explicitVersion;
  } else {
    newVersion = computeNewVersion(currentVersion, bumpType, prerelease, stripPrerelease);
  }

  // Dry-run: print and exit
  if (dryRun) {
    console.log(`Dry run: ${currentVersion} → ${newVersion}\n`);
    console.log("Global files:");
    uniqueLabels(patterns).forEach((l) => console.log(`  ${l}: ${currentVersion} → ${newVersion}`));
    if (modules) {
      console.log("\nModule files:");
      applyModuleUpdates(root, modules, newVersion, true);
    }
    console.log("\nNo files written.");
    process.exit(0);
  }

  // Apply global file updates
  const filesToWrite = new Map();
  for (const p of patterns) {
    const content = filesToWrite.get(p.file) || fileContents.get(p.file);
    filesToWrite.set(p.file, p.replace(content, newVersion));
  }
  for (const [fp, content] of filesToWrite) fs.writeFileSync(fp, content, "utf8");

  console.log(`Version bumped: ${currentVersion} → ${newVersion}\n`);
  console.log("Updated files:");
  uniqueLabels(patterns).forEach((l) => console.log(`  ${l}`));

  // Apply module updates if requested
  if (modules) {
    console.log("\nModule files:");
    applyModuleUpdates(root, modules, newVersion, false);
  }

  // Post-bump reminder
  console.log(
    "\nReminder: Run /gaia-build-configs to regenerate resolved configs (global.yaml was modified)."
  );
}

main();
