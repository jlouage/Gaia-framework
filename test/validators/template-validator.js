import { readFileSync, existsSync } from "fs";
import { join, resolve, relative } from "path";
import { execSync } from "child_process";

// ─── Shared Helpers ──────────────────────────────────────────

const fileContentCache = new Map();

function readCached(filePath) {
  if (!fileContentCache.has(filePath)) {
    fileContentCache.set(filePath, readFileSync(filePath, "utf8"));
  }
  return fileContentCache.get(filePath);
}

/** Run `find` under a directory with a name pattern, excluding node_modules. */
function findFiles(dir, namePattern, extraExcludes = []) {
  const excludes = ["*/node_modules/*", ...extraExcludes].map((e) => `-not -path "${e}"`).join(" ");
  return execSync(`find "${dir}" -name "${namePattern}" ${excludes}`, {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
}

/** Read the installed_path field from a workflow.yaml, resolving {project-root}. */
function readInstalledPathFromWorkflow(workflowYamlPath, frameworkRoot) {
  const content = readCached(workflowYamlPath);
  const match = content.match(/^installed_path:\s*["']?(.+?)["']?\s*$/m);
  if (!match) return null;
  return resolve(match[1].replace(/\{project-root\}/g, frameworkRoot));
}

// ─── T1.1: Template Discovery ────────────────────────────────

/**
 * Discover all template files via dual-glob strategy.
 * - Primary: _gaia/lifecycle/templates/*-template.md
 * - Secondary: _gaia/**\/template.md (co-located)
 * Returns array of absolute paths.
 */
export function discoverTemplates(frameworkRoot) {
  const gaiaDir = join(frameworkRoot, "_gaia");
  const results = [];

  // Primary: lifecycle templates
  const lifecycleDir = join(gaiaDir, "lifecycle", "templates");
  if (existsSync(lifecycleDir)) {
    results.push(...findFiles(lifecycleDir, "*-template.md"));
  }

  // Secondary: co-located templates (template.md files anywhere under _gaia/)
  results.push(...findFiles(gaiaDir, "template.md", ["*/templates/*"]));

  return results.sort();
}

// ─── T1.2: Reference Scanner ─────────────────────────────────

/**
 * Scan for template references from two sources:
 * (a) workflow.yaml `template:` fields
 * (b) <action> text in instructions.xml referencing template paths
 *
 * Does NOT count <template-output> as references.
 * Only matches paths ending in -template.md or template.md.
 *
 * Returns array of { normalizedPath, source, rawMatch, workflow }
 */
export function scanReferences(frameworkRoot) {
  const gaiaDir = join(frameworkRoot, "_gaia");
  const refs = [];

  // Source A: workflow.yaml template: fields
  const workflowFiles = findFiles(gaiaDir, "workflow.yaml", ["*/.resolved/*"]);

  for (const wf of workflowFiles) {
    const content = readCached(wf);
    const match = content.match(/^template:\s*["']?(.+?)["']?\s*$/m);
    if (match) {
      const templatePath = match[1];
      // Only count if it ends in -template.md or template.md
      if (templatePath.match(/(?:-template|\/template)\.md$/)) {
        const normalized = resolveTemplatePath(templatePath, wf, frameworkRoot);
        refs.push({
          normalizedPath: normalized,
          source: "workflow.yaml",
          rawMatch: match[0],
          workflow: relative(gaiaDir, wf),
        });
      }
    }
  }

  // Source B: <action>/<check> text in instructions.xml referencing template paths
  const instructionFiles = findFiles(gaiaDir, "instructions.xml");

  for (const instrFile of instructionFiles) {
    const content = readCached(instrFile);

    // Extract <action> and <check> elements content (NOT <template-output>)
    // Match action/check content that references template files
    const actionRegex = /<(?:action|check)[^>]*>([\s\S]*?)<\/(?:action|check)>/g;
    let actionMatch;
    while ((actionMatch = actionRegex.exec(content)) !== null) {
      const actionText = actionMatch[1];

      // Find template path references ending in -template.md or template.md
      // Matches patterns like:
      //   {installed_path}/../../templates/prd-template.md
      //   {project-root}/_gaia/lifecycle/templates/story-template.md
      //   templates/story-template.md
      const templateRefRegex =
        /(\{[^}]+\}(?:\/[^\s,'"<>]+)?\/(?:[a-z][\w-]*-template|template)\.md)/gi;
      let refMatch;
      while ((refMatch = templateRefRegex.exec(actionText)) !== null) {
        const templatePath = refMatch[1];
        const normalized = resolveTemplatePath(templatePath, instrFile, frameworkRoot);
        refs.push({
          normalizedPath: normalized,
          source: "instructions.xml",
          rawMatch: actionMatch[0].substring(0, 120),
          workflow: relative(gaiaDir, instrFile),
        });
      }

      // Also match bare filename references like "story-template.md structure"
      const bareRefRegex = /\b([a-z][\w-]*-template\.md)\b/gi;
      let bareMatch;
      while ((bareMatch = bareRefRegex.exec(actionText)) !== null) {
        const filename = bareMatch[1];
        // Resolve bare filename to lifecycle templates dir
        const resolved = join(frameworkRoot, "_gaia", "lifecycle", "templates", filename);
        if (existsSync(resolved)) {
          refs.push({
            normalizedPath: resolved,
            source: "instructions.xml",
            rawMatch: actionMatch[0].substring(0, 120),
            workflow: relative(gaiaDir, instrFile),
          });
        }
      }
    }
  }

  return refs;
}

/**
 * Resolve a template path with variables to an absolute filesystem path.
 * Handles {project-root}, {installed_path}, and relative paths.
 */
function resolveTemplatePath(templatePath, sourceFile, frameworkRoot) {
  let resolved = templatePath;

  resolved = resolved.replace(/\{project-root\}/g, frameworkRoot);

  if (resolved.includes("{installed_path}")) {
    // Try reading installed_path from the source or sibling workflow.yaml
    const wfYaml = sourceFile.endsWith("workflow.yaml")
      ? sourceFile
      : join(resolve(sourceFile, ".."), "workflow.yaml");

    const installedPath =
      (existsSync(wfYaml) && readInstalledPathFromWorkflow(wfYaml, frameworkRoot)) ||
      join(frameworkRoot, "_gaia");

    resolved = resolved.replace(/\{installed_path\}/g, installedPath);
  }

  return resolve(resolved);
}

// ─── T1.3: Orphan Detection ─────────────────────────────────

/**
 * Compare discovered templates against references, return orphaned paths.
 */
export function findOrphans(templates, references) {
  const referencedPaths = new Set(references.map((r) => r.normalizedPath));
  return templates.filter((t) => !referencedPaths.has(t));
}

// ─── T1.4: Variable Placeholder Classifier ───────────────────

/**
 * Extract {…} patterns from content and classify into three categories:
 * - system: variables that exist in the knownRegistry (validated)
 * - content: variables NOT in registry (bare words or underscore-separated — skipped)
 * - inlineChoice: contains spaces or slashes (skipped)
 *
 * Classification strategy:
 * 1. Inline choice (spaces/slashes) → always skipped
 * 2. In known registry → system (validated)
 * 3. Underscore/hyphen-separated but NOT in registry → content (template-fill prompts)
 * 4. Bare single words not in registry → content
 *
 * The registry is the source of truth. Heuristic pattern matching (underscore separation)
 * is only used when NO registry is provided (unit test fallback).
 *
 * @param {string} content - Template content (outside YAML frontmatter)
 * @param {Set<string>} [knownRegistry] - Known variable names — if provided, ONLY registry
 *   members are classified as system vars. If absent, falls back to pattern heuristic.
 * @returns {{ system: string[], content: string[], inlineChoice: string[] }}
 */
export function classifyPlaceholders(content, knownRegistry) {
  const placeholderRegex = /\{([^}]+)\}/g;
  const system = [];
  const contentPlaceholders = [];
  const inlineChoice = [];
  const seen = new Set();

  let match;
  while ((match = placeholderRegex.exec(content)) !== null) {
    const inner = match[1].trim();
    if (seen.has(inner)) continue;
    seen.add(inner);

    // Inline choice: contains spaces or slashes
    if (/[\s/]/.test(inner)) {
      inlineChoice.push(inner);
      continue;
    }

    if (knownRegistry) {
      // Registry-based classification: registry is source of truth
      if (knownRegistry.has(inner)) {
        system.push(inner);
      } else {
        contentPlaceholders.push(inner);
      }
    } else {
      // Fallback heuristic (no registry): underscore/hyphen-separated → system
      const isMultiWord = /^[a-z][a-z0-9]*([_-][a-z][a-z0-9]*)+$/i.test(inner);
      if (isMultiWord) {
        system.push(inner);
      } else {
        contentPlaceholders.push(inner);
      }
    }
  }

  return { system, content: contentPlaceholders, inlineChoice };
}

// ─── T1.5: Known Variable Registry ──────────────────────────

/**
 * Build a Set of known variable names from global.yaml keys,
 * system variables, and workflow-level variables.
 */
export function buildKnownVariableRegistry(frameworkRoot) {
  const registry = new Set();

  // System variables (always available)
  const systemVars = ["project-root", "project-path", "installed_path", "date"];
  for (const v of systemVars) registry.add(v);

  // Workflow-level variables (used across workflows)
  const workflowVars = [
    "story_key",
    "story_title_slug",
    "sprint_number",
    "sprint_id",
    "epic_name",
    "epic_key",
    "agent_name",
    "requirement_id",
    "agent_model_name_version",
    "story_title",
    "story_points",
    "creation_date",
    "mode",
    "has_apis",
    "has_frontend",
    "has_events",
    "topic",
  ];
  for (const v of workflowVars) registry.add(v);

  // Parse global.yaml keys
  const globalPath = join(frameworkRoot, "_gaia", "_config", "global.yaml");
  if (existsSync(globalPath)) {
    const content = readCached(globalPath);
    const lines = content.split("\n");
    for (const line of lines) {
      // Match top-level YAML keys (not comments, not nested)
      const keyMatch = line.match(/^([a-z][a-z_]*)\s*:/);
      if (keyMatch) {
        registry.add(keyMatch[1]);
      }
    }
  }

  return registry;
}

// ─── T1.6: Variable Validation ───────────────────────────────

/**
 * Validate system/config placeholders in template files against the registry.
 * With registry-based classification, classifyPlaceholders only marks registry
 * members as system — so this function verifies there are no false positives
 * and returns classification results per template for reporting.
 *
 * Returns array of { file, system: string[], content: string[], unknowns: string[] }.
 * unknowns is always empty with a valid registry (all system vars ARE in the registry).
 * It serves as a safety net if the registry is incomplete.
 */
export function validateVariables(templatePaths, registry) {
  const results = [];

  for (const filePath of templatePaths) {
    const content = readCached(filePath);
    const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n?/, "");

    const classified = classifyPlaceholders(bodyContent, registry);
    const unknowns = classified.system.filter((v) => !registry.has(v));

    results.push({ file: filePath, unknowns, ...classified });
  }

  return results;
}

// ─── T1.7: used_by Frontmatter Cross-check ──────────────────

/**
 * Parse YAML frontmatter from templates for `used_by` arrays,
 * verify bidirectional consistency with actual workflow references.
 *
 * Returns array of findings:
 * - { type: 'missing-frontmatter', file } — no frontmatter at all
 * - { type: 'used_by-not-referenced', file, workflow } — used_by lists workflow but workflow doesn't reference template
 * - { type: 'referenced-not-in-used_by', file, workflow } — workflow references template but not in used_by
 */
export function checkUsedByFrontmatter(templates, references) {
  const findings = [];

  // Build a map: template path → set of workflow names that reference it
  const refsByTemplate = new Map();
  for (const ref of references) {
    if (!refsByTemplate.has(ref.normalizedPath)) {
      refsByTemplate.set(ref.normalizedPath, new Set());
    }
    // Extract workflow name from the workflow path
    // e.g., "lifecycle/workflows/4-implementation/create-story/workflow.yaml" → "create-story"
    const parts = ref.workflow.split("/");
    const workflowName = parts[parts.length - 2]; // directory name before workflow.yaml or instructions.xml
    refsByTemplate.get(ref.normalizedPath).add(workflowName);
  }

  for (const templatePath of templates) {
    const content = readCached(templatePath);

    // Parse frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      findings.push({ type: "missing-frontmatter", file: templatePath });
      continue;
    }

    // Extract used_by array
    const usedByMatch = fmMatch[1].match(/used_by:\s*\[([^\]]*)\]/);
    if (!usedByMatch) {
      // Has frontmatter but no used_by field — treat as missing
      findings.push({ type: "missing-frontmatter", file: templatePath });
      continue;
    }

    const usedByWorkflows = usedByMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .filter((s) => s.length > 0);

    const actualRefs = refsByTemplate.get(templatePath) || new Set();

    // Check: used_by declares workflow but workflow doesn't reference this template
    for (const wf of usedByWorkflows) {
      if (!actualRefs.has(wf)) {
        findings.push({
          type: "used_by-not-referenced",
          file: templatePath,
          workflow: wf,
        });
      }
    }

    // Check: workflow references template but not listed in used_by
    for (const wf of actualRefs) {
      if (!usedByWorkflows.includes(wf)) {
        findings.push({
          type: "referenced-not-in-used_by",
          file: templatePath,
          workflow: wf,
        });
      }
    }
  }

  return findings;
}
