/**
 * E13-S8: Brownfield Design Extraction
 *
 * Extracts UI design tokens and component specs from existing brownfield
 * codebases. Supports CSS custom properties, SCSS variables, Tailwind config,
 * Flutter ThemeData, iOS XIB styles, Android XML themes, and Compose MaterialTheme.
 *
 * Output: W3C DTCG design-tokens.json + component-specs.yaml
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// ─── Token classification ───────────────────────────────────────────────────

const TOKEN_TYPE_PATTERNS = [
  { type: "color", keywords: ["color", "background", "border-color"] },
  { type: "spacing", keywords: ["spacing", "margin", "padding", "gap"] },
  { type: "typography", keywords: ["font", "text", "line-height", "letter-spacing"] },
  { type: "borderRadius", keywords: ["radius", "corner"] },
  { type: "shadow", keywords: ["shadow", "elevation"] },
  { type: "opacity", keywords: ["opacity", "alpha"] },
  { type: "dimension", keywords: ["size", "width", "height"] },
  { type: "duration", keywords: ["duration", "delay", "transition"] },
];

/**
 * Classify a token name into a DTCG type based on naming conventions.
 */
function classifyToken(name) {
  const lower = name.toLowerCase();
  for (const { type, keywords } of TOKEN_TYPE_PATTERNS) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "other";
}

/**
 * Convert camelCase to kebab-case.
 */
function camelToKebab(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/^-/, "")
    .toLowerCase();
}

// ─── Shared extraction helpers ──────────────────────────────────────────────

/**
 * Extract Color(0xFFHHHHHH) tokens from Dart/Kotlin source.
 * Used by both Flutter and Compose extractors.
 *
 * @param {string} content - Source file content
 * @param {string} assignOp - Assignment operator to match (":" for Dart, "=" for Kotlin)
 */
function extractHexColorTokens(content, assignOp) {
  const tokens = {};
  const re = new RegExp(`(\\w+)\\s*${assignOp}\\s*Color\\(0x([0-9A-Fa-f]{8,10})\\)`, "g");
  let match;
  while ((match = re.exec(content)) !== null) {
    const hex = match[2].slice(-6);
    tokens[`color-${match[1]}`] = { $value: `#${hex}`, $type: "color" };
  }
  return tokens;
}

/**
 * Parse key-value pairs from a Tailwind theme section block.
 *
 * @param {string} block - Content inside the section braces
 * @param {string} prefix - Token name prefix (e.g., "color", "spacing")
 * @param {string} type - DTCG token type
 */
function parseTailwindThemeSection(block, prefix, type) {
  const tokens = {};
  const re = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    tokens[`${prefix}-${match[1]}`] = { $value: match[2], $type: type };
  }
  return tokens;
}

// ─── Format-specific extractors ─────────────────────────────────────────────

/**
 * Extract CSS custom properties from :root { --name: value; } blocks.
 */
function extractCssTokens(content) {
  const tokens = {};
  const gaps = [];
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    const rawValue = match[2].trim();
    if (/var\(/.test(rawValue)) {
      tokens[name] = { $value: "TBD", $type: classifyToken(name), unresolved: true };
      gaps.push({ token: name, reason: `Unresolvable CSS variable reference: ${rawValue}` });
    } else {
      tokens[name] = { $value: rawValue, $type: classifyToken(name) };
    }
  }
  return { tokens, gaps };
}

/**
 * Extract SCSS variables ($name: value;).
 */
function extractScssTokens(content) {
  const tokens = {};
  const gaps = [];
  const re = /\$([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    tokens[match[1]] = { $value: match[2].trim(), $type: classifyToken(match[1]) };
  }
  return { tokens, gaps };
}

/**
 * Extract Tailwind config theme values.
 */
function extractTailwindTokens(content) {
  const tokens = {};
  const gaps = [];

  const themeMatch = content.match(/theme\s*:\s*\{([\s\S]*)\}/);
  if (!themeMatch) return { tokens, gaps };

  const themeBlock = themeMatch[1];

  const sections = [
    { re: /colors\s*:\s*\{([^}]+)\}/, prefix: "color", type: "color" },
    { re: /spacing\s*:\s*\{([^}]+)\}/, prefix: "spacing", type: "spacing" },
  ];

  for (const { re, prefix, type } of sections) {
    const sectionMatch = themeBlock.match(re);
    if (sectionMatch) {
      Object.assign(tokens, parseTailwindThemeSection(sectionMatch[1], prefix, type));
    }
  }

  return { tokens, gaps };
}

/**
 * Extract Flutter ThemeData color and text values.
 */
function extractFlutterTokens(content) {
  const tokens = extractHexColorTokens(content, ":");
  const gaps = [];

  const fontRe = /fontSize\s*:\s*([0-9.]+)/g;
  let match;
  while ((match = fontRe.exec(content)) !== null) {
    tokens["typography-font-size"] = { $value: `${match[1]}px`, $type: "typography" };
  }

  return { tokens, gaps };
}

/**
 * Extract iOS XIB named colors and font descriptions.
 */
function extractXibTokens(content) {
  const tokens = {};
  const gaps = [];

  const colorRe = /<color\s+key="(\w+)"\s+red="([^"]+)"\s+green="([^"]+)"\s+blue="([^"]+)"/g;
  let match;
  while ((match = colorRe.exec(content)) !== null) {
    const name = match[1].replace("Color", "").toLowerCase() || "color";
    const r = Math.round(parseFloat(match[2]) * 255);
    const g = Math.round(parseFloat(match[3]) * 255);
    const b = Math.round(parseFloat(match[4]) * 255);
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    tokens[`color-${name}`] = { $value: hex, $type: "color" };
  }

  const fontRe2 = /<fontDescription\s+key="[^"]*"\s+pointSize="([^"]+)"/g;
  while ((match = fontRe2.exec(content)) !== null) {
    tokens["typography-font-size"] = { $value: `${match[1]}px`, $type: "typography" };
  }

  return { tokens, gaps };
}

/**
 * Extract Android XML theme colors and dimensions.
 */
function extractAndroidXmlTokens(content) {
  const tokens = {};
  const gaps = [];

  const colorRe = /<color\s+name="(\w+)">([^<]+)<\/color>/g;
  let match;
  while ((match = colorRe.exec(content)) !== null) {
    const name = camelToKebab(match[1].replace(/^color/i, ""));
    tokens[`color-${name}`] = { $value: match[2].trim(), $type: "color" };
  }

  const dimenRe = /<dimen\s+name="(\w+)">([^<]+)<\/dimen>/g;
  while ((match = dimenRe.exec(content)) !== null) {
    const rawName = match[1].replace(/_/g, "-");
    const name = rawName.startsWith("spacing-") ? rawName : `spacing-${rawName}`;
    tokens[name] = { $value: match[2].trim(), $type: "spacing" };
  }

  return { tokens, gaps };
}

/**
 * Extract Kotlin/Compose MaterialTheme tokens.
 */
function extractComposeTokens(content) {
  const tokens = extractHexColorTokens(content, "=");
  const gaps = [];

  const fontRe = /fontSize\s*=\s*([0-9.]+)\.sp/g;
  let match;
  while ((match = fontRe.exec(content)) !== null) {
    tokens["typography-font-size"] = { $value: `${match[1]}sp`, $type: "typography" };
  }

  return { tokens, gaps };
}

// ─── Format registry ────────────────────────────────────────────────────────

const FORMAT_EXTENSIONS = {
  css: [".css"],
  scss: [".scss"],
  tailwind: ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.mjs"],
  flutter: [".dart"],
  xib: [".xib", ".storyboard"],
  "android-xml": [".xml"],
  compose: [".kt"],
};

const FORMAT_EXTRACTORS = {
  css: extractCssTokens,
  scss: extractScssTokens,
  tailwind: extractTailwindTokens,
  flutter: extractFlutterTokens,
  xib: extractXibTokens,
  "android-xml": extractAndroidXmlTokens,
  compose: extractComposeTokens,
};

/**
 * Determine which formats apply to a given file path.
 */
function getFileFormats(filePath) {
  const formats = [];
  for (const [format, extensions] of Object.entries(FORMAT_EXTENSIONS)) {
    if (extensions.some((ext) => filePath.endsWith(ext))) {
      formats.push(format);
    }
  }
  return formats;
}

// ─── File discovery ─────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"]);

/**
 * Recursively list files in a directory, skipping common non-source directories.
 */
function listFiles(dir, prefix = "") {
  const entries = [];
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const relPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isFile()) {
        entries.push(relPath);
      } else if (item.isDirectory() && !item.name.startsWith(".") && !IGNORED_DIRS.has(item.name)) {
        entries.push(...listFiles(join(dir, item.name), relPath));
      }
    }
  } catch {
    // Directory not readable — skip silently
  }
  return entries;
}

// ─── Component discovery ────────────────────────────────────────────────────

const COMPONENT_FILE_PATTERN = /\.(tsx|jsx|vue|svelte)$/;

/**
 * Discover component definitions from React/JSX/TSX/Vue/Svelte files.
 */
function discoverComponents(projectDir, filesToScan) {
  const components = [];
  const componentFiles = filesToScan.filter((f) => COMPONENT_FILE_PATTERN.test(f));

  for (const filePath of componentFiles) {
    try {
      const content = readFileSync(join(projectDir, filePath), "utf-8");
      const funcRe = /export\s+(?:const|function)\s+(\w+)\s*=?\s*\(\s*\{([^}]*)\}/g;
      let match;
      while ((match = funcRe.exec(content)) !== null) {
        const props = match[2]
          .split(",")
          .map((p) => p.trim().split("=")[0].trim())
          .filter(Boolean);

        components.push({
          name: match[1],
          file: filePath,
          props,
          structural_hints: detectStructuralHints(content),
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return components;
}

/**
 * Detect structural hints from component code (CSS class patterns).
 */
function detectStructuralHints(content) {
  const hints = [];
  const classRe = /className\s*=\s*[{"`']([^"}`']+)/g;
  let match;
  while ((match = classRe.exec(content)) !== null) {
    hints.push(`css-class: ${match[1].slice(0, 50)}`);
  }
  return hints.length > 0 ? hints : ["no structural hints detected"];
}

// ─── Output generation ──────────────────────────────────────────────────────

/**
 * Generate component-specs.yaml content from discovered components.
 */
function generateComponentSpecsYaml(components) {
  if (components.length === 0) {
    return [
      "# Component Specs — Brownfield Extraction",
      "# No components discovered. Mark as TBD.",
      "source: brownfield-extraction",
      "components: []",
      "status: TBD",
      "",
    ].join("\n");
  }

  const lines = [
    "# Component Specs — Brownfield Extraction",
    "source: brownfield-extraction",
    "components:",
  ];

  for (const comp of components) {
    lines.push(`  - name: ${comp.name}`);
    lines.push(`    file: ${comp.file}`);
    lines.push("    props:");
    if (comp.props.length > 0) {
      for (const prop of comp.props) {
        lines.push(`      - ${prop}`);
      }
    } else {
      lines.push("      []");
    }
    lines.push("    structural_hints:");
    for (const hint of comp.structural_hints) {
      lines.push(`      - "${hint}"`);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Build W3C DTCG output object from extracted tokens.
 */
function buildDtcgOutput(tokens, scannedFiles) {
  return {
    $description: "Design tokens extracted from brownfield codebase",
    $metadata: {
      source: "brownfield-extraction",
      generatedAt: new Date().toISOString(),
      scannedFiles,
    },
    ...tokens,
  };
}

// ─── Main extraction function ───────────────────────────────────────────────

/**
 * Extract design tokens from a brownfield project.
 *
 * @param {string} projectDir - Root directory of the project to scan
 * @param {object} [options] - Extraction options
 * @param {string[]} [options.formats] - Limit to specific formats
 * @param {string} [options.outputDir] - Directory to write output files
 * @param {string} [options.e11ScanManifest] - Path to E11 codebase-manifest.json
 * @returns {Promise<{tokens, outputPaths, gaps, source, scannedFiles}>}
 */
export async function extractDesignTokens(projectDir, options = {}) {
  const { formats, outputDir, e11ScanManifest } = options;

  // Determine file list from E11 manifest or filesystem scan
  const { filesToScan, source } = resolveFileList(projectDir, e11ScanManifest);

  // Run format-specific extractors on matching files
  const { tokens, gaps, scannedFiles } = runExtractors(projectDir, filesToScan, formats);

  // Discover UI components
  const components = discoverComponents(projectDir, filesToScan);

  // Write output files
  const outputPaths = outputDir
    ? writeOutputFiles(outputDir, tokens, components, scannedFiles)
    : { tokens: "", components: "" };

  return { tokens, outputPaths, gaps, source, scannedFiles };
}

/**
 * Resolve the list of files to scan, preferring E11 manifest when available.
 */
function resolveFileList(projectDir, e11ScanManifest) {
  if (e11ScanManifest && existsSync(e11ScanManifest)) {
    try {
      const manifest = JSON.parse(readFileSync(e11ScanManifest, "utf-8"));
      if (manifest.files && Array.isArray(manifest.files)) {
        return {
          filesToScan: manifest.files.map((f) => f.path || f),
          source: "e11-manifest",
        };
      }
    } catch {
      // Fall through to filesystem scan
    }
  }
  return { filesToScan: listFiles(projectDir), source: "filesystem-scan" };
}

/**
 * Run all applicable extractors across the file list.
 */
function runExtractors(projectDir, filesToScan, formatFilter) {
  const allTokens = {};
  const allGaps = [];
  let scannedCount = 0;

  for (const relPath of filesToScan) {
    let fileFormats = getFileFormats(relPath);
    if (fileFormats.length === 0) continue;

    if (formatFilter) {
      fileFormats = fileFormats.filter((f) => formatFilter.includes(f));
      if (fileFormats.length === 0) continue;
    }

    let content;
    try {
      content = readFileSync(join(projectDir, relPath), "utf-8");
    } catch {
      continue;
    }

    scannedCount++;

    for (const fmt of fileFormats) {
      const extractor = FORMAT_EXTRACTORS[fmt];
      if (!extractor) continue;
      const { tokens, gaps } = extractor(content);
      Object.assign(allTokens, tokens);
      allGaps.push(...gaps);
    }
  }

  return { tokens: allTokens, gaps: allGaps, scannedFiles: scannedCount };
}

/**
 * Write design-tokens.json and component-specs.yaml to the output directory.
 */
function writeOutputFiles(outputDir, tokens, components, scannedFiles) {
  mkdirSync(outputDir, { recursive: true });

  const tokensPath = join(outputDir, "design-tokens.json");
  writeFileSync(tokensPath, JSON.stringify(buildDtcgOutput(tokens, scannedFiles), null, 2));

  const componentsPath = join(outputDir, "component-specs.yaml");
  writeFileSync(componentsPath, generateComponentSpecsYaml(components));

  return { tokens: tokensPath, components: componentsPath };
}

/**
 * Read design extraction output from a directory.
 *
 * @param {string} outputDir - Directory containing extraction output files
 * @returns {Promise<{tokens: object, components: string}>}
 */
export async function readDesignExtractionOutput(outputDir) {
  const tokensPath = join(outputDir, "design-tokens.json");
  const componentsPath = join(outputDir, "component-specs.yaml");

  const tokens = existsSync(tokensPath)
    ? JSON.parse(readFileSync(tokensPath, "utf-8"))
    : {};

  const components = existsSync(componentsPath)
    ? readFileSync(componentsPath, "utf-8")
    : "";

  return { tokens, components };
}
