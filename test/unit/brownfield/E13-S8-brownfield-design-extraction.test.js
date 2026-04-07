/**
 * E13-S8: Brownfield Design Extraction — Acceptance Tests (ATDD)
 *
 * RED PHASE — These tests are intentionally failing.
 * The implementation module does not exist yet.
 * All tests must fail until the brownfield-design-extractor is implemented.
 *
 * Story: As a team onboarding a brownfield application, I want GAIA to extract
 * UI tokens and component specs from the existing codebase so that I can seed
 * Figma frames from the current design state without manual recreation.
 *
 * Risk: HIGH | Epic: E13 — Figma MCP Integration
 */

import { describe, it, expect, beforeEach } from "vitest";
import { join, resolve } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";

// Implementation under test — does not exist yet (red phase)
// When implemented, this module must export: extractDesignTokens, readDesignExtractionOutput
import {
  extractDesignTokens,
  readDesignExtractionOutput,
} from "../../../src/brownfield/design-extractor.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TMP_BASE = join(tmpdir(), "gaia-e13-s8-tests");

function createFixtureDir(name) {
  const dir = join(TMP_BASE, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanFixtures() {
  if (existsSync(TMP_BASE)) {
    rmSync(TMP_BASE, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1: Extracts design tokens from all supported source formats
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S8 AC1: Extracts design tokens from all supported source formats", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac1-multi-format");
  });

  it("should extract tokens from CSS custom properties", async () => {
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root {
  --color-primary: #3b82f6;
  --spacing-md: 16px;
  --font-size-base: 1rem;
}`
    );

    const result = await extractDesignTokens(projectDir, { formats: ["css"] });

    expect(result.tokens).toBeDefined();
    expect(result.tokens["color-primary"]).toBeDefined();
    expect(result.tokens["spacing-md"]).toBeDefined();
    expect(result.tokens["font-size-base"]).toBeDefined();
  });

  it("should extract tokens from SCSS variables", async () => {
    writeFileSync(
      join(projectDir, "_variables.scss"),
      `$color-primary: #3b82f6;
$spacing-md: 16px;
$font-size-base: 1rem;`
    );

    const result = await extractDesignTokens(projectDir, { formats: ["scss"] });

    expect(result.tokens).toBeDefined();
    expect(result.tokens["color-primary"]).toBeDefined();
    expect(result.tokens["spacing-md"]).toBeDefined();
  });

  it("should extract tokens from Tailwind config", async () => {
    writeFileSync(
      join(projectDir, "tailwind.config.js"),
      `module.exports = {
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#6366f1',
    },
    spacing: {
      md: '16px',
    },
  },
};`
    );

    const result = await extractDesignTokens(projectDir, {
      formats: ["tailwind"],
    });

    expect(result.tokens).toBeDefined();
    expect(result.tokens["color-primary"]).toBeDefined();
    expect(result.tokens["color-secondary"]).toBeDefined();
    expect(result.tokens["spacing-md"]).toBeDefined();
  });

  it("should extract tokens from Flutter ThemeData", async () => {
    writeFileSync(
      join(projectDir, "theme.dart"),
      `ThemeData(
  colorScheme: ColorScheme(
    primary: Color(0xFF3B82F6),
    secondary: Color(0xFF6366F1),
  ),
  textTheme: TextTheme(
    bodyMedium: TextStyle(fontSize: 16.0),
  ),
)`
    );

    const result = await extractDesignTokens(projectDir, {
      formats: ["flutter"],
    });

    expect(result.tokens).toBeDefined();
    expect(result.tokens["color-primary"]).toBeDefined();
  });

  it("should extract tokens from iOS XIB styles", async () => {
    writeFileSync(
      join(projectDir, "Main.xib"),
      `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <color key="backgroundColor" red="0.231" green="0.510" blue="0.965" alpha="1"/>
  <fontDescription key="fontDescription" pointSize="16" type="system"/>
</document>`
    );

    const result = await extractDesignTokens(projectDir, { formats: ["xib"] });

    expect(result.tokens).toBeDefined();
    expect(result.tokens["color-background"]).toBeDefined();
  });

  it("should extract tokens from Android XML themes", async () => {
    writeFileSync(
      join(projectDir, "themes.xml"),
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="colorPrimary">#3B82F6</color>
  <color name="colorSecondary">#6366F1</color>
  <dimen name="spacing_md">16dp</dimen>
</resources>`
    );

    const result = await extractDesignTokens(projectDir, {
      formats: ["android-xml"],
    });

    expect(result.tokens).toBeDefined();
    expect(result.tokens["color-primary"]).toBeDefined();
    expect(result.tokens["spacing-md"]).toBeDefined();
  });

  it("should extract tokens from Compose MaterialTheme", async () => {
    writeFileSync(
      join(projectDir, "Theme.kt"),
      `val AppTheme = MaterialTheme(
  colorScheme = lightColorScheme(
    primary = Color(0xFF3B82F6),
    secondary = Color(0xFF6366F1),
  ),
  typography = Typography(
    bodyMedium = TextStyle(fontSize = 16.sp),
  ),
)`
    );

    const result = await extractDesignTokens(projectDir, {
      formats: ["compose"],
    });

    expect(result.tokens).toBeDefined();
    expect(result.tokens["color-primary"]).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Generates initial design-tokens.json in W3C DTCG format
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S8 AC2: Generates design-tokens.json in W3C DTCG format", () => {
  let projectDir;
  let outputDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac2-dtcg-format");
    outputDir = join(projectDir, "design-system");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root { --color-primary: #3b82f6; --spacing-md: 16px; }`
    );
  });

  it("should write design-tokens.json to the output directory", async () => {
    await extractDesignTokens(projectDir, { outputDir });

    expect(existsSync(join(outputDir, "design-tokens.json"))).toBe(true);
  });

  it("should produce a JSON file conforming to W3C DTCG structure", async () => {
    await extractDesignTokens(projectDir, { outputDir });

    const { readFile } = await import("fs/promises");
    const raw = await readFile(join(outputDir, "design-tokens.json"), "utf-8");
    const parsed = JSON.parse(raw);

    // W3C DTCG: tokens are objects with a $value and $type field
    const firstTokenKey = Object.keys(parsed).find(
      (k) => !k.startsWith("$")
    );
    expect(firstTokenKey).toBeDefined();
    const token = parsed[firstTokenKey];
    expect(token).toHaveProperty("$value");
    expect(token).toHaveProperty("$type");
  });

  it("should include a $schema or $metadata marker in the output", async () => {
    await extractDesignTokens(projectDir, { outputDir });

    const { readFile } = await import("fs/promises");
    const raw = await readFile(join(outputDir, "design-tokens.json"), "utf-8");
    const parsed = JSON.parse(raw);

    // DTCG files should declare their schema or contain metadata
    const hasSchema =
      "$schema" in parsed ||
      "$metadata" in parsed ||
      "$description" in parsed;
    expect(hasSchema).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: Generates component-specs.yaml with discovered components
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S8 AC3: Generates component-specs.yaml with discovered components", () => {
  let projectDir;
  let outputDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac3-component-specs");
    outputDir = join(projectDir, "design-system");
    mkdirSync(outputDir, { recursive: true });
  });

  it("should write component-specs.yaml to the output directory", async () => {
    writeFileSync(
      join(projectDir, "Button.tsx"),
      `export const Button = ({ label, variant = 'primary', size = 'md' }) =>
  <button className={\`btn btn--\${variant} btn--\${size}\`}>{label}</button>;`
    );

    await extractDesignTokens(projectDir, { outputDir });

    expect(existsSync(join(outputDir, "component-specs.yaml"))).toBe(true);
  });

  it("should include discovered component names in component-specs.yaml", async () => {
    writeFileSync(
      join(projectDir, "Button.tsx"),
      `export const Button = ({ label }) => <button>{label}</button>;`
    );
    writeFileSync(
      join(projectDir, "Card.tsx"),
      `export const Card = ({ title, children }) => <div className="card"><h2>{title}</h2>{children}</div>;`
    );

    await extractDesignTokens(projectDir, { outputDir });

    const { readFile } = await import("fs/promises");
    const yaml = await readFile(join(outputDir, "component-specs.yaml"), "utf-8");

    expect(yaml).toMatch(/Button/);
    expect(yaml).toMatch(/Card/);
  });

  it("should include component properties and structural hints in output", async () => {
    writeFileSync(
      join(projectDir, "Badge.tsx"),
      `export const Badge = ({ count, color = 'blue', size = 'sm' }) =>
  <span className={\`badge badge--\${color} badge--\${size}\`}>{count}</span>;`
    );

    await extractDesignTokens(projectDir, { outputDir });

    const { readFile } = await import("fs/promises");
    const yaml = await readFile(join(outputDir, "component-specs.yaml"), "utf-8");

    // Should capture props
    expect(yaml).toMatch(/props|properties|variants/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4: Output placed in {planning_artifacts}/design-system/ as seed files
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S8 AC4: Output placed in design-system seed directory", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac4-output-path");
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root { --color-primary: #3b82f6; }`
    );
  });

  it("should create the design-system directory if it does not exist", async () => {
    const outputDir = join(projectDir, "design-system");
    expect(existsSync(outputDir)).toBe(false);

    await extractDesignTokens(projectDir, { outputDir });

    expect(existsSync(outputDir)).toBe(true);
  });

  it("should write both seed files to the design-system directory", async () => {
    const outputDir = join(projectDir, "design-system");

    await extractDesignTokens(projectDir, { outputDir });

    expect(existsSync(join(outputDir, "design-tokens.json"))).toBe(true);
    expect(existsSync(join(outputDir, "component-specs.yaml"))).toBe(true);
  });

  it("should return output file paths in the result object", async () => {
    const outputDir = join(projectDir, "design-system");

    const result = await extractDesignTokens(projectDir, { outputDir });

    expect(result.outputPaths).toBeDefined();
    expect(result.outputPaths.tokens).toContain("design-tokens.json");
    expect(result.outputPaths.components).toContain("component-specs.yaml");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: Integrates with /gaia-brownfield — runs after E11 codebase scan
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S8 AC5: Integrates with gaia-brownfield after E11 codebase scan", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac5-integration");
  });

  it("should read E11 scan output as input when present", async () => {
    // E11 scan produces a codebase-manifest.json
    const e11Output = {
      scannedAt: "2026-04-07T00:00:00Z",
      files: [
        { path: "styles.css", type: "stylesheet" },
        { path: "Button.tsx", type: "component" },
      ],
    };
    writeFileSync(
      join(projectDir, "codebase-manifest.json"),
      JSON.stringify(e11Output, null, 2)
    );
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root { --color-primary: #3b82f6; }`
    );

    const result = await extractDesignTokens(projectDir, {
      e11ScanManifest: join(projectDir, "codebase-manifest.json"),
      outputDir: join(projectDir, "design-system"),
    });

    expect(result.source).toBe("e11-manifest");
    expect(result.scannedFiles).toBeGreaterThan(0);
  });

  it("should fall back to filesystem scan when no E11 manifest is provided", async () => {
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root { --color-primary: #3b82f6; }`
    );

    const result = await extractDesignTokens(projectDir, {
      outputDir: join(projectDir, "design-system"),
    });

    expect(result.source).toBe("filesystem-scan");
  });

  it("should expose the extraction as a callable step for brownfield workflow", async () => {
    // The extractor must be importable and callable as a workflow step
    expect(typeof extractDesignTokens).toBe("function");
    expect(extractDesignTokens.length).toBeGreaterThanOrEqual(1); // at least projectDir param
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6: Handles missing or partial design systems gracefully
// ─────────────────────────────────────────────────────────────────────────────
describe("E13-S8 AC6: Handles missing or partial design systems gracefully", () => {
  let projectDir;

  beforeEach(() => {
    cleanFixtures();
    projectDir = createFixtureDir("ac6-graceful");
  });

  it("should not throw when no design source files are found", async () => {
    // Empty project directory — no CSS, SCSS, Tailwind, etc.
    const outputDir = join(projectDir, "design-system");

    await expect(
      extractDesignTokens(projectDir, { outputDir })
    ).resolves.not.toThrow();
  });

  it("should mark unresolvable tokens as TBD in the output", async () => {
    // Only partial design data — some tokens can't be resolved
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root { --color-primary: var(--unknown-reference); }`
    );
    const outputDir = join(projectDir, "design-system");

    const result = await extractDesignTokens(projectDir, { outputDir });

    // Unresolvable tokens should be marked TBD, not throw or be omitted
    const tbdTokens = Object.values(result.tokens || {}).filter(
      (t) => t.$value === "TBD" || t.$value === null || t.unresolved === true
    );
    expect(tbdTokens.length).toBeGreaterThan(0);
  });

  it("should include a gaps report listing what could not be extracted", async () => {
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root { --color-primary: var(--undefined); }`
    );
    const outputDir = join(projectDir, "design-system");

    const result = await extractDesignTokens(projectDir, { outputDir });

    expect(result.gaps).toBeDefined();
    expect(Array.isArray(result.gaps)).toBe(true);
  });

  it("should still write valid seed files even when gaps exist", async () => {
    // Partial — only some formats present
    writeFileSync(
      join(projectDir, "styles.css"),
      `:root { --color-primary: #3b82f6; }`
    );
    // No SCSS, no Tailwind, no Flutter, no iOS, no Android
    const outputDir = join(projectDir, "design-system");

    await extractDesignTokens(projectDir, { outputDir });

    expect(existsSync(join(outputDir, "design-tokens.json"))).toBe(true);
    expect(existsSync(join(outputDir, "component-specs.yaml"))).toBe(true);
  });
});
