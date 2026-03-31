#!/usr/bin/env node
"use strict";

/**
 * version-bump.js — Automate version sync across GAIA framework files.
 *
 * Usage:
 *   node scripts/version-bump.js <patch|minor|major|X.Y.Z> [--modules mod1,mod2] [--dry-run]
 *
 * Updates 5 global files atomically. Optionally updates module config.yaml
 * and manifest.yaml entries when --modules is provided.
 *
 * Zero runtime dependencies (ADR-005). File-based regex patterns (ADR-006).
 */

const fs = require("node:fs");
const path = require("node:path");

// ── Configuration ───────────────────────────────────────────────────────────

const VALID_MODULES = ["core", "lifecycle", "dev", "creative", "testing"];
const BUMP_TYPES = ["patch", "minor", "major"];
const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)/;

/**
 * Build a version-pattern descriptor for a single file.
 * @param {string} file   Absolute path
 * @param {string} label  Human-readable label
 * @param {RegExp} readRe Regex with one capture group for the version
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
 * The 5 global version targets. Two entries share README.md (badge + code block).
 * gaia-install.sh was removed — it now reads version from package.json at runtime.
 */
function globalFilePatterns(root) {
  const j = (...segs) => path.join(root, ...segs);
  return [
    pat(
      j("package.json"),
      "package.json",
      /"version"\s*:\s*"(\d+\.\d+\.\d+)"/,
      /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/
    ),
    pat(
      j("_gaia", "_config", "global.yaml"),
      "_gaia/_config/global.yaml",
      /framework_version:\s*"(\d+\.\d+\.\d+)"/,
      /(framework_version:\s*")(\d+\.\d+\.\d+)(")/
    ),
    pat(
      j("CLAUDE.md"),
      "CLAUDE.md",
      /# GAIA Framework v(\d+\.\d+\.\d+)/,
      /(# GAIA Framework v)(\d+\.\d+\.\d+)()/
    ),
    pat(
      j("README.md"),
      "README.md (badge)",
      /badge\/framework-v(\d+\.\d+\.\d+)-blue/,
      /(badge\/framework-v)(\d+\.\d+\.\d+)(-blue)/
    ),
    pat(
      j("README.md"),
      "README.md (code block)",
      /framework_version:\s*"(\d+\.\d+\.\d+)"/,
      /(framework_version:\s*")(\d+\.\d+\.\d+)(")/
    ),
  ];
}

// ── Semver helpers (inline, no deps — ADR-005) ─────────────────────────────

function parseSemver(ver) {
  const m = ver.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
}

function incrementSemver(ver, type) {
  const s = parseSemver(ver);
  if (!s) throw new Error(`Cannot parse version: ${ver}`);
  if (type === "major") return `${s.major + 1}.0.0`;
  if (type === "minor") return `${s.major}.${s.minor + 1}.0`;
  return `${s.major}.${s.minor}.${s.patch + 1}`;
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

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") {
      dryRun = true;
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

  if (!bumpType && !explicitVersion) {
    console.error(
      "Usage: node scripts/version-bump.js <patch|minor|major|X.Y.Z> [--modules mod1,mod2] [--dry-run]"
    );
    process.exit(1);
  }

  return { bumpType, explicitVersion, modules, dryRun };
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
      // Explicit version mode: log drift as warning but proceed
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
  const newVersion = explicitVersion || incrementSemver(currentVersion, bumpType);

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
