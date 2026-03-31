import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync } from "fs";
import { join, isAbsolute } from "path";
import { walkFiles } from "../validation/helpers/fs-walk.js";

// ─── Temporary fixture directory ────────────────────────────

const FIXTURE_ROOT = join(import.meta.dirname, "__fixtures_fs_walk__");

function fixture(...segments) {
  return join(FIXTURE_ROOT, ...segments);
}

beforeAll(() => {
  // Clean up any leftover fixture directory
  if (existsSync(FIXTURE_ROOT)) rmSync(FIXTURE_ROOT, { recursive: true });

  // Create fixture tree:
  // __fixtures_fs_walk__/
  //   a/
  //     workflow.yaml
  //     nested/
  //       workflow.yaml
  //       other.txt
  //   b/
  //     workflow.yaml
  //   node_modules/
  //     pkg/
  //       workflow.yaml
  //   _backups/
  //     workflow.yaml
  //   .resolved/
  //     create-story.yaml
  //   templates/
  //     prd-template.md
  //     story-template.md
  //   commands/
  //     gaia-help.md
  //     gaia-dev-story.md
  //     gaia-agent-dev-typescript.md
  //     readme.md
  //   empty/
  //   symlinked-target/
  //     workflow.yaml

  mkdirSync(fixture("a", "nested"), { recursive: true });
  mkdirSync(fixture("b"), { recursive: true });
  mkdirSync(fixture("node_modules", "pkg"), { recursive: true });
  mkdirSync(fixture("_backups"), { recursive: true });
  mkdirSync(fixture(".resolved"), { recursive: true });
  mkdirSync(fixture("templates"), { recursive: true });
  mkdirSync(fixture("commands"), { recursive: true });
  mkdirSync(fixture("empty"), { recursive: true });
  mkdirSync(fixture("symlinked-target"), { recursive: true });

  writeFileSync(fixture("a", "workflow.yaml"), "name: a");
  writeFileSync(fixture("a", "nested", "workflow.yaml"), "name: nested");
  writeFileSync(fixture("a", "nested", "other.txt"), "not yaml");
  writeFileSync(fixture("b", "workflow.yaml"), "name: b");
  writeFileSync(fixture("node_modules", "pkg", "workflow.yaml"), "name: pkg");
  writeFileSync(fixture("_backups", "workflow.yaml"), "name: backup");
  writeFileSync(fixture(".resolved", "create-story.yaml"), "name: resolved");
  writeFileSync(fixture("templates", "prd-template.md"), "# PRD Template");
  writeFileSync(fixture("templates", "story-template.md"), "# Story Template");
  writeFileSync(fixture("commands", "gaia-help.md"), "---\nname: help\n---");
  writeFileSync(fixture("commands", "gaia-dev-story.md"), "---\nname: dev-story\n---");
  writeFileSync(fixture("commands", "gaia-agent-dev-typescript.md"), "---\nname: agent\n---");
  writeFileSync(fixture("commands", "readme.md"), "# readme");
  writeFileSync(fixture("symlinked-target", "workflow.yaml"), "name: symlinked");

  // Create a symlink: linked/ -> symlinked-target/
  try {
    symlinkSync(fixture("symlinked-target"), fixture("linked"), "dir");
  } catch {
    // Symlink creation may fail on some platforms — tests guard against this
  }
});

afterAll(() => {
  if (existsSync(FIXTURE_ROOT)) rmSync(FIXTURE_ROOT, { recursive: true });
});

// ─── AC1, AC5, AC9: Basic walkFiles behavior ───────────────

describe("walkFiles — basic behavior", () => {
  it("should find all workflow.yaml files recursively (AC1)", () => {
    const results = walkFiles(FIXTURE_ROOT, { namePattern: "workflow.yaml" });
    // Normalize FIXTURE_ROOT to forward slashes to match walkFiles output
    const root = FIXTURE_ROOT.replace(/\\/g, "/");
    const names = results.map((p) => p.replace(root, ""));
    // Should find: a/workflow.yaml, a/nested/workflow.yaml, b/workflow.yaml,
    // node_modules/pkg/workflow.yaml, _backups/workflow.yaml, symlinked-target/workflow.yaml,
    // and possibly linked/workflow.yaml
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(names).toContain("/a/workflow.yaml");
    expect(names).toContain("/a/nested/workflow.yaml");
    expect(names).toContain("/b/workflow.yaml");
  });

  it("should return absolute paths (AC5)", () => {
    const results = walkFiles(FIXTURE_ROOT, { namePattern: "workflow.yaml" });
    for (const p of results) {
      expect(isAbsolute(p), `Path should be absolute: ${p}`).toBe(true);
    }
  });

  it("should return empty array for missing directory (AC9)", () => {
    const results = walkFiles(join(FIXTURE_ROOT, "does-not-exist"), {
      namePattern: "workflow.yaml",
    });
    expect(results).toEqual([]);
  });

  it("should return empty array for empty directory (AC9)", () => {
    const results = walkFiles(fixture("empty"), { namePattern: "workflow.yaml" });
    expect(results).toEqual([]);
  });
});

// ─── AC2, AC3: Exclusion patterns ──────────────────────────

describe("walkFiles — exclusion patterns", () => {
  it("should exclude node_modules when specified (AC2)", () => {
    const results = walkFiles(FIXTURE_ROOT, {
      namePattern: "workflow.yaml",
      exclude: ["node_modules"],
    });
    const hasNodeModules = results.some((p) => p.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
  });

  it("should exclude _backups when specified (AC2)", () => {
    const results = walkFiles(FIXTURE_ROOT, {
      namePattern: "workflow.yaml",
      exclude: ["_backups"],
    });
    const hasBackups = results.some((p) => p.includes("_backups"));
    expect(hasBackups).toBe(false);
  });

  it("should exclude .resolved when specified (AC2)", () => {
    const results = walkFiles(FIXTURE_ROOT, {
      namePattern: "*.yaml",
      exclude: [".resolved"],
    });
    const hasResolved = results.some((p) => p.includes(".resolved"));
    expect(hasResolved).toBe(false);
  });

  it("should exclude multiple directories at once", () => {
    const results = walkFiles(FIXTURE_ROOT, {
      namePattern: "workflow.yaml",
      exclude: ["node_modules", "_backups"],
    });
    const hasExcluded = results.some((p) => p.includes("node_modules") || p.includes("_backups"));
    expect(hasExcluded).toBe(false);
  });
});

// ─── AC3: Glob pattern matching ────────────────────────────

describe("walkFiles — glob pattern matching", () => {
  it("should match exact file name (AC3)", () => {
    const results = walkFiles(fixture("commands"), { namePattern: "readme.md" });
    expect(results).toHaveLength(1);
    expect(results[0]).toContain("readme.md");
  });

  it("should match prefix glob pattern gaia*.md (AC3)", () => {
    const results = walkFiles(fixture("commands"), { namePattern: "gaia*.md" });
    expect(results).toHaveLength(3); // gaia-help.md, gaia-dev-story.md, gaia-agent-dev-typescript.md
    for (const p of results) {
      const name = p.split("/").pop();
      expect(name.startsWith("gaia")).toBe(true);
      expect(name.endsWith(".md")).toBe(true);
    }
  });

  it("should match suffix glob pattern *-template.md (AC3)", () => {
    const results = walkFiles(fixture("templates"), { namePattern: "*-template.md" });
    expect(results).toHaveLength(2); // prd-template.md, story-template.md
    for (const p of results) {
      const name = p.split("/").pop();
      expect(name.endsWith("-template.md")).toBe(true);
    }
  });

  it("should match gaia-agent-*.md pattern (AC3)", () => {
    const results = walkFiles(fixture("commands"), { namePattern: "gaia-agent-*.md" });
    expect(results).toHaveLength(1); // only gaia-agent-dev-typescript.md
    expect(results[0]).toContain("gaia-agent-dev-typescript.md");
  });

  it("should not match non-matching patterns", () => {
    const results = walkFiles(fixture("commands"), { namePattern: "*.yaml" });
    expect(results).toHaveLength(0);
  });
});

// ─── AC7: Path normalization ───────────────────────────────

describe("walkFiles — path normalization (AC7)", () => {
  it("should return forward-slash paths", () => {
    const results = walkFiles(FIXTURE_ROOT, { namePattern: "workflow.yaml" });
    for (const p of results) {
      expect(p.includes("\\"), `Path should use forward slashes: ${p}`).toBe(false);
    }
  });
});

// ─── AC8: Symlink following ────────────────────────────────

describe("walkFiles — symlink following (AC8)", () => {
  it("should follow symlinks when followSymlinks is true", () => {
    // Skip if symlink was not created (e.g., Windows without privileges)
    if (!existsSync(fixture("linked"))) return;

    const results = walkFiles(FIXTURE_ROOT, {
      namePattern: "workflow.yaml",
      followSymlinks: true,
    });
    const hasLinked = results.some((p) => p.includes("linked"));
    // Should find workflow.yaml inside the symlinked directory
    expect(hasLinked).toBe(true);
  });

  it("should not infinitely loop on circular symlinks (AC8)", () => {
    // Create circular symlink: circular/ -> FIXTURE_ROOT (which contains circular/)
    const circularPath = fixture("circular");
    try {
      if (!existsSync(circularPath)) {
        symlinkSync(FIXTURE_ROOT, circularPath, "dir");
      }
      // This should complete without hanging
      const results = walkFiles(FIXTURE_ROOT, {
        namePattern: "workflow.yaml",
        followSymlinks: true,
      });
      expect(Array.isArray(results)).toBe(true);
    } finally {
      // Clean up circular symlink
      if (existsSync(circularPath)) rmSync(circularPath);
    }
  });
});
