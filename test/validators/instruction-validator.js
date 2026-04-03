import { readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { PROJECT_ROOT } from "../helpers/project-root.js";

// ─── Constants ──────────────────────────────────────────────

const _GAIA_DIR = join(PROJECT_ROOT, "_gaia");

// Canonical variable set per AC3 — maintained as a single constant for easy updates
export const VALID_VARIABLES = new Set([
  "project-root",
  "project-path",
  "installed_path",
  "planning_artifacts",
  "implementation_artifacts",
  "test_artifacts",
  "creative_artifacts",
  "story_key",
  "story_title_slug",
  "date",
  "data_path",
  "epic_key",
  "version",
  "target",
  "spec_name",
  "sprint_id",
  "cr_id",
  "mode",
  "plan_artifact_path",
  "target_file",
  "memory_path",
  "feature_id",
  "slug",
]);

// Parser configured per ADR-010: preserve attributes, handle CDATA
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  preserveOrder: false,
  processEntities: true,
  htmlEntities: true,
  isArray: () => false,
});

// ─── Helpers ────────────────────────────────────────────────

const fileContentCache = new Map();

function readCached(filePath) {
  if (!fileContentCache.has(filePath)) {
    fileContentCache.set(filePath, readFileSync(filePath, "utf8"));
  }
  return fileContentCache.get(filePath);
}

/**
 * Parse XML with fast-xml-parser. Returns { parsed, error }.
 */
function parseXml(filePath) {
  try {
    const content = readCached(filePath);
    if (!content || content.trim().length === 0) {
      return { parsed: null, error: "Empty or invalid XML" };
    }
    const parsed = parser.parse(content);
    return { parsed, error: null };
  } catch (e) {
    return { parsed: null, error: e.message };
  }
}

/**
 * Recursively collect all elements with a given tag name from a parsed XML object.
 */
function collectElements(obj, tagName, results = []) {
  if (obj === null || obj === undefined) return results;
  if (typeof obj !== "object") return results;

  for (const key of Object.keys(obj)) {
    if (key === tagName) {
      const val = obj[key];
      if (Array.isArray(val)) {
        results.push(...val);
      } else if (val !== null && val !== undefined) {
        results.push(val);
      }
    }
    const val = obj[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        collectElements(item, tagName, results);
      }
    } else if (typeof val === "object" && val !== null) {
      collectElements(val, tagName, results);
    }
  }
  return results;
}

/**
 * Recursively collect ALL text content from a parsed XML object.
 * Returns an array of text strings found.
 */
function collectAllText(obj, texts = []) {
  if (obj === null || obj === undefined) return texts;
  if (typeof obj === "string") {
    texts.push(obj);
    return texts;
  }
  if (typeof obj === "number" || typeof obj === "boolean") {
    texts.push(String(obj));
    return texts;
  }
  if (typeof obj !== "object") return texts;

  for (const key of Object.keys(obj)) {
    if (key.startsWith("@_")) continue;
    const val = obj[key];
    if (typeof val === "string") {
      texts.push(val);
    } else if (typeof val === "number" || typeof val === "boolean") {
      texts.push(String(val));
    } else if (Array.isArray(val)) {
      for (const item of val) collectAllText(item, texts);
    } else if (typeof val === "object" && val !== null) {
      collectAllText(val, texts);
    }
  }
  return texts;
}

/**
 * Resolve a path that may contain {project-root} or {installed_path} variables.
 * Returns the resolved path or null if unresolvable.
 */
function resolveRefPath(refPath, filePath) {
  let resolved = refPath;
  resolved = resolved.replace(/\{project-root\}/g, PROJECT_ROOT);
  // {installed_path} resolves to the directory containing the instructions.xml
  const installedPath = dirname(filePath);
  resolved = resolved.replace(/\{installed_path\}/g, installedPath);
  // If still has unresolvable variables, return null
  if (/\{[a-z_-]+\}/.test(resolved)) return null;
  return resolve(resolved);
}

// ─── AC1: XML Well-formedness ───────────────────────────────

export function validateWellFormedness(filePath) {
  const errors = [];
  try {
    const content = readCached(filePath);
    if (!content || content.trim().length === 0) {
      errors.push(`${filePath}: XML parse error — Empty or invalid XML`);
      return { errors };
    }
    const validationResult = XMLValidator.validate(content, {
      allowBooleanAttributes: true,
    });
    if (validationResult !== true) {
      const err = validationResult.err;
      errors.push(`${filePath}: XML parse error — ${err.msg} (line ${err.line}, col ${err.col})`);
    }
  } catch (e) {
    errors.push(`${filePath}: XML parse error — ${e.message}`);
  }
  return { errors };
}

// ─── AC2: Step Number Sequentiality ─────────────────────────

export function validateStepNumbering(filePath) {
  const errors = [];
  const { parsed, error } = parseXml(filePath);
  if (error) {
    errors.push(`${filePath}: Cannot check step numbering — XML parse error`);
    return { errors };
  }

  const steps = collectElements(parsed, "step");
  // Collect step n values, separating pure numbers from interstitial (e.g., "3b", "6a")
  const allBaseNumbers = new Set();
  const pureNumbers = [];
  for (const step of steps) {
    const n = step?.["@_n"];
    if (n !== undefined && n !== null) {
      const nStr = String(n);
      // Extract the numeric base (e.g., "6a" → 6, "3b" → 3, "7" → 7)
      const baseMatch = nStr.match(/^(\d+)/);
      if (baseMatch) {
        const base = parseInt(baseMatch[1], 10);
        allBaseNumbers.add(base);
        if (/^\d+$/.test(nStr)) {
          pureNumbers.push(base);
        }
      }
    }
  }

  // If no steps, pass gracefully (protocol files etc.)
  if (allBaseNumbers.size === 0) return { errors };

  // Check for duplicates in pure numeric steps only
  const seen = new Set();
  for (const n of pureNumbers) {
    if (seen.has(n)) {
      errors.push(`${filePath}: Duplicate step number: ${n}`);
    }
    seen.add(n);
  }

  // Build sorted unique list of all base numbers (including from interstitial steps)
  const sorted = [...allBaseNumbers].sort((a, b) => a - b);

  // Check sequential from 1
  if (sorted[0] !== 1) {
    errors.push(`${filePath}: Step numbering does not start at 1 (starts at ${sorted[0]})`);
  }

  // Check for gaps — a base number is covered if it exists as pure or interstitial
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      for (let missing = sorted[i - 1] + 1; missing < sorted[i]; missing++) {
        errors.push(`${filePath}: Gap in step numbering: step ${missing} missing`);
      }
    }
  }

  return { errors };
}

// ─── AC3: Template-output Variable Validation ───────────────

export function validateTemplateOutputVariables(filePath) {
  const errors = [];
  const { parsed, error } = parseXml(filePath);
  if (error) {
    errors.push(`${filePath}: Cannot check template-output variables — XML parse error`);
    return { errors };
  }

  const templateOutputs = collectElements(parsed, "template-output");
  for (const to of templateOutputs) {
    const fileAttr = to?.["@_file"];
    if (!fileAttr) continue;

    // Extract all {variable} tokens
    const varMatches = fileAttr.match(/\{([a-z][a-z0-9_-]*)\}/gi);
    if (!varMatches) continue;

    for (const match of varMatches) {
      const varName = match.slice(1, -1); // Remove { and }
      if (!VALID_VARIABLES.has(varName)) {
        errors.push(
          `${filePath}: Unrecognized variable: {${varName}} in template-output file="${fileAttr}"`
        );
      }
    }
  }

  return { errors };
}

// ─── AC4: Skill/Knowledge Reference Resolution ─────────────

export function validateSkillKnowledgeReferences(filePath) {
  const errors = [];
  const { error } = parseXml(filePath);
  if (error) {
    errors.push(`${filePath}: Cannot check skill/knowledge references — XML parse error`);
    return { errors };
  }

  const content = readCached(filePath);

  // Pattern: text-embedded paths in action content
  // Matches {project-root}/_gaia/dev/skills/*.md and {project-root}/_gaia/*/knowledge/**/*.md
  const textPathPattern =
    /\{project-root\}\/_gaia\/(?:dev\/skills\/[^\s"<>]+\.md|[^\s"<>]+\/knowledge\/[^\s"<>]+\.md)/g;
  const matches = content.match(textPathPattern) || [];

  for (const match of matches) {
    // Strip trailing section references like ` — section "commits"`
    const cleanPath = match.split(/\s+[—–-]+\s+/)[0].trim();
    const resolved = cleanPath.replace(/\{project-root\}/g, PROJECT_ROOT);
    if (!existsSync(resolved)) {
      errors.push(`${filePath}: Skill/knowledge file not found: ${cleanPath}`);
    }
  }

  return { errors };
}

// ─── AC5: invoke-task Reference Resolution ──────────────────

export function validateInvokeTaskReferences(filePath) {
  const errors = [];
  const { parsed, error } = parseXml(filePath);
  if (error) {
    errors.push(`${filePath}: Cannot check invoke-task references — XML parse error`);
    return { errors };
  }

  // Structured: <invoke-task> elements with file/reference attributes
  const invokeTasks = collectElements(parsed, "invoke-task");
  for (const it of invokeTasks) {
    const ref = it?.["@_file"] || it?.["@_reference"] || it?.["@_target"] || it?.["@_ref"];
    if (!ref) continue;
    const resolved = resolveRefPath(ref, filePath);
    if (resolved && !existsSync(resolved)) {
      errors.push(`${filePath}: Task file not found: ${ref}`);
    }
  }

  // Text-embedded: task paths inside <action> text content
  const content = readCached(filePath);
  const taskPathPattern = /\{project-root\}\/_gaia\/core\/tasks\/[^\s"<>]+\.xml/g;
  const matches = content.match(taskPathPattern) || [];
  for (const match of matches) {
    const resolved = match.replace(/\{project-root\}/g, PROJECT_ROOT);
    if (!existsSync(resolved)) {
      errors.push(`${filePath}: Task file not found: ${match}`);
    }
  }

  return { errors };
}

// ─── AC6: invoke-workflow Reference Resolution ──────────────

export function validateInvokeWorkflowReferences(filePath) {
  const errors = [];
  const { parsed, error } = parseXml(filePath);
  if (error) {
    errors.push(`${filePath}: Cannot check invoke-workflow references — XML parse error`);
    return { errors };
  }

  const invokeWorkflows = collectElements(parsed, "invoke-workflow");
  for (const iw of invokeWorkflows) {
    const target = iw?.["@_target"];
    if (target) {
      const resolved = resolveRefPath(target, filePath);
      if (resolved && !existsSync(resolved)) {
        errors.push(`${filePath}: Workflow file not found: ${target}`);
      }
    }
    // ref-only invocations are treated as warnings (per dev notes) — not errors
  }

  return { errors };
}

// ─── AC8: invoke-protocol Reference Resolution ──────────────

export function validateInvokeProtocolReferences(filePath) {
  const errors = [];
  const { parsed, error } = parseXml(filePath);
  if (error) {
    errors.push(`${filePath}: Cannot check invoke-protocol references — XML parse error`);
    return { errors };
  }

  const invokeProtocols = collectElements(parsed, "invoke-protocol");
  for (const ip of invokeProtocols) {
    // Schema (b): explicit file attribute
    const fileAttr = ip?.["@_file"];
    if (fileAttr) {
      const resolved = resolveRefPath(fileAttr, filePath);
      if (resolved && !existsSync(resolved)) {
        errors.push(`${filePath}: Protocol file not found: ${fileAttr}`);
      }
      continue;
    }

    // Schema (a): ref="name" — resolve by name in core/protocols/ and core/engine/protocols/
    const ref = ip?.["@_ref"] || ip?.["@_name"];
    if (!ref) continue;

    const candidates = [
      join(PROJECT_ROOT, "_gaia", "core", "protocols", `${ref}.xml`),
      join(PROJECT_ROOT, "_gaia", "core", "engine", "protocols", `${ref}.xml`),
      join(PROJECT_ROOT, "_gaia", "core", "protocols", `${ref}.md`),
    ];

    const found = candidates.some((c) => existsSync(c));
    if (!found) {
      errors.push(
        `${filePath}: Protocol file not found for ref="${ref}" (searched: ${candidates.join(", ")})`
      );
    }
  }

  return { errors };
}

// ─── AC9: Check Element Validation ──────────────────────────

export function validateCheckElements(filePath) {
  const errors = [];
  const { parsed, error } = parseXml(filePath);
  if (error) {
    errors.push(`${filePath}: Cannot check <check> elements — XML parse error`);
    return { errors };
  }

  const checks = collectElements(parsed, "check");
  for (const check of checks) {
    // Check if attribute — if present, must be non-empty
    const ifAttr = check?.["@_if"];
    if (ifAttr !== undefined && ifAttr !== null) {
      if (String(ifAttr).trim() === "") {
        errors.push(`${filePath}: Empty condition in check element`);
      }
    }

    // Check body — must be non-empty
    // Body can be #text or nested content
    const bodyTexts = [];
    if (typeof check === "string") {
      bodyTexts.push(check);
    } else if (typeof check === "object" && check !== null) {
      collectAllText(check, bodyTexts);
    }

    // Filter out attribute-only text
    const bodyContent = bodyTexts.join("").trim();
    if (bodyContent.length === 0) {
      errors.push(`${filePath}: Empty body in check element`);
    }
  }

  return { errors };
}
