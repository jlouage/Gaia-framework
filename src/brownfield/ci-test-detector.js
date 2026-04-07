/**
 * E19-S13: Brownfield CI Test Execution Detection
 *
 * Detects whether a project runs tests in CI by scanning CI configuration
 * files for test execution steps. Supports GitHub Actions, GitLab CI,
 * CircleCI, Azure Pipelines, Jenkins, and Bitbucket Pipelines.
 *
 * Traces to: FR-232, NFR-041
 * NFR-041: Zero false positives -- only detect actual test execution steps,
 * not comments, env vars, or non-test CI steps.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// ─── Test command patterns ─────────────────────────────────────────────────
// Applied against the value of run:/script:/sh: fields ONLY,
// never against comments, env vars, or job names.

const TEST_COMMAND_PATTERNS = [
  /\bnpm\s+test\b/,
  /\bnpm\s+run\s+test\b/,
  /\bpytest\b/,
  /\.\/(gradlew|gradlew\.bat)\s+test\b/,
  /\bgo\s+test\b/,
  /\bbats\b/,
  /\bmvn\s+test\b/,
  /\bvitest\b/,
  /\bnpx\s+vitest\b/,
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Safely read a text file. Returns null if not found. */
function readTextSafe(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/** Check if a line is a YAML comment (leading whitespace + #). */
function isYamlComment(line) {
  return /^\s*#/.test(line);
}

/** Check if a string matches any test command pattern. */
function matchesTestCommand(str) {
  return TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(str));
}

/** Check if a run value is a false positive (echo, env assignment, etc.) */
function isFalsePositive(value) {
  return /^\s*echo\s/.test(value.trim());
}

/**
 * Scan lines of a YAML-based CI config for test commands.
 * Accepts a regex to extract command values from each line.
 * Skips YAML comments and false positives.
 *
 * @param {string} content - file content
 * @param {RegExp} linePattern - regex with capture group 1 for the command value
 * @returns {string[]} matched test commands
 */
function extractTestCommandsFromYaml(content, linePattern) {
  const commands = [];
  for (const line of content.split("\n")) {
    if (isYamlComment(line)) continue;
    const match = line.match(linePattern);
    if (!match) continue;
    const value = match[1].trim();
    if (isFalsePositive(value)) continue;
    if (matchesTestCommand(value)) {
      commands.push(value);
    }
  }
  return commands;
}

// ─── CI provider scanners ──────────────────────────────────────────────────

/** run: field pattern used by GitHub Actions and CircleCI */
const YAML_RUN_PATTERN = /^\s*-?\s*run:\s*(.+)$/;

/** script/bash field pattern used by Azure Pipelines */
const AZURE_STEP_PATTERN = /^\s*-?\s*(?:script|bash):\s*(.+)$/;

/** List item pattern used by GitLab CI and Bitbucket Pipelines script arrays */
const YAML_LIST_ITEM_PATTERN = /^\s+-\s+(.+)$/;

/**
 * Scan .github/workflows/*.yml for test execution steps.
 * Reads all workflow files and checks run: field values.
 */
function scanGitHubActions(projectPath) {
  const workflowDir = join(projectPath, ".github", "workflows");
  if (!existsSync(workflowDir)) return null;

  let files;
  try {
    files = readdirSync(workflowDir).filter(
      (f) => f.endsWith(".yml") || f.endsWith(".yaml")
    );
  } catch {
    return null;
  }

  const commands = [];
  for (const file of files) {
    const content = readTextSafe(join(workflowDir, file));
    if (!content) continue;
    commands.push(...extractTestCommandsFromYaml(content, YAML_RUN_PATTERN));
  }

  return commands.length > 0 ? { provider: "github-actions", commands } : null;
}

/** Scan .gitlab-ci.yml for test execution in script: sections. */
function scanGitLabCI(projectPath) {
  return scanSingleYamlFile(
    join(projectPath, ".gitlab-ci.yml"),
    YAML_LIST_ITEM_PATTERN,
    "gitlab"
  );
}

/** Scan .circleci/config.yml for test execution in run: steps. */
function scanCircleCI(projectPath) {
  return scanSingleYamlFile(
    join(projectPath, ".circleci", "config.yml"),
    YAML_RUN_PATTERN,
    "circleci"
  );
}

/** Scan azure-pipelines.yml for test execution in script:/bash: steps. */
function scanAzurePipelines(projectPath) {
  return scanSingleYamlFile(
    join(projectPath, "azure-pipelines.yml"),
    AZURE_STEP_PATTERN,
    "azure"
  );
}

/** Scan bitbucket-pipelines.yml for test execution in script: sections. */
function scanBitbucket(projectPath) {
  return scanSingleYamlFile(
    join(projectPath, "bitbucket-pipelines.yml"),
    YAML_LIST_ITEM_PATTERN,
    "bitbucket"
  );
}

/**
 * Generic scanner for a single YAML CI config file.
 * @param {string} filePath - absolute path to the CI config file
 * @param {RegExp} linePattern - regex to extract command values
 * @param {string} provider - CI provider name
 */
function scanSingleYamlFile(filePath, linePattern, provider) {
  const content = readTextSafe(filePath);
  if (!content) return null;

  const commands = extractTestCommandsFromYaml(content, linePattern);
  return commands.length > 0 ? { provider, commands } : null;
}

/**
 * Scan Jenkinsfile for test execution in sh steps.
 * Jenkinsfile uses Groovy syntax, not YAML.
 */
function scanJenkins(projectPath) {
  const content = readTextSafe(join(projectPath, "Jenkinsfile"));
  if (!content) return null;

  const commands = [];
  for (const line of content.split("\n")) {
    // Skip Groovy comments
    if (/^\s*\/\//.test(line)) continue;

    // Match sh '<command>' or sh "<command>" patterns
    const shMatch = line.match(/\bsh\s+['"](.+?)['"]/);
    if (!shMatch) continue;
    const value = shMatch[1].trim();
    if (isFalsePositive(value)) continue;
    if (matchesTestCommand(value)) {
      commands.push(value);
    }
  }

  return commands.length > 0 ? { provider: "jenkins", commands } : null;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Detect CI test execution at the given project path.
 *
 * Scans CI configuration files for test execution steps in priority order.
 * Returns the first CI provider found that runs tests.
 *
 * Supported providers: github-actions, gitlab, circleci, azure, jenkins, bitbucket
 *
 * @param {string} projectPath -- absolute path to the project root
 * @returns {Promise<{ci_test_execution: string|null, test_commands: string[]}>}
 */
export async function detectCITestExecution(projectPath) {
  const scanners = [
    scanGitHubActions,
    scanGitLabCI,
    scanCircleCI,
    scanAzurePipelines,
    scanJenkins,
    scanBitbucket,
  ];

  for (const scanner of scanners) {
    const result = scanner(projectPath);
    if (result) {
      return {
        ci_test_execution: result.provider,
        test_commands: result.commands,
      };
    }
  }

  return { ci_test_execution: null, test_commands: [] };
}
