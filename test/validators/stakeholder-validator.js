import { readFileSync, existsSync } from "fs";
import yaml from "js-yaml";
import { walkFiles } from "../validation/helpers/fs-walk.js";

// ─── Constants ──────────────────────────────────────────────

const REQUIRED_FIELDS = ["name", "role", "expertise", "personality"];
const MAX_LINES_PER_FILE = 100;
const MAX_FILES_IN_DIRECTORY = 50;
const STAKEHOLDER_GLOB = "*.md";

// ─── Finding Builder ────────────────────────────────────────

/**
 * Create a structured finding compatible with Val's finding format.
 * @param {"CRITICAL"|"WARNING"} severity
 * @param {string} section - The validation section (e.g., "stakeholder-schema")
 * @param {string} claim - What was expected
 * @param {string} finding - What was found
 * @param {string} evidence - Supporting evidence
 * @returns {{ severity: string, section: string, claim: string, finding: string, evidence: string }}
 */
function createFinding(severity, section, claim, finding, evidence) {
  return { severity, section, claim, finding, evidence };
}

// ─── T1: Stakeholder File Discovery ─────────────────────────

/**
 * Discover stakeholder .md files in the given directory.
 * Excludes README.md files from the results.
 * @param {string} stakeholderDir - Absolute path to custom/stakeholders/
 * @returns {string[]} Array of absolute file paths
 */
export function discoverStakeholderFiles(stakeholderDir) {
  if (!existsSync(stakeholderDir)) return [];

  const files = walkFiles(stakeholderDir, { namePattern: STAKEHOLDER_GLOB });
  // Exclude README.md — not a stakeholder persona file
  return files.filter((f) => !f.endsWith("/README.md") && !f.endsWith("\\README.md"));
}

// ─── T2: YAML Frontmatter Parser ───────────────────────────

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { success, data, error } where data is the parsed YAML object.
 * On malformed YAML or missing delimiters, returns success=false with error message.
 * @param {string} filePath - Absolute path to the .md file
 * @returns {{ success: boolean, data: object|null, error: string|null }}
 */
export function parseFrontmatter(filePath) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    return { success: false, data: null, error: `Cannot read file: ${err.message}` };
  }

  if (content.length === 0) {
    return { success: false, data: null, error: "Empty file (0 bytes)" };
  }

  // Match frontmatter between --- delimiters
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return { success: false, data: null, error: "No YAML frontmatter delimiters found" };
  }

  const yamlContent = fmMatch[1];
  if (!yamlContent.trim()) {
    return { success: false, data: null, error: "Empty YAML frontmatter" };
  }

  try {
    const data = yaml.load(yamlContent);
    if (typeof data !== "object" || data === null) {
      return { success: false, data: null, error: "Frontmatter parsed but is not an object" };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: `Malformed YAML: ${err.message}` };
  }
}

// ─── T3: Required Field Validation ─────────────────────────

/**
 * Check that all required fields are present in the frontmatter data.
 * @param {object} data - Parsed YAML frontmatter
 * @returns {string[]} Array of missing field names
 */
export function findMissingFields(data) {
  return REQUIRED_FIELDS.filter((field) => !(field in data));
}

// ─── T4: Line Count Validation ─────────────────────────────

/**
 * Count the number of lines in a file.
 * @param {string} filePath - Absolute path to the file
 * @returns {number} Line count
 */
export function countLines(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (content.length === 0) return 0;
  return content.split("\n").length;
}

// ─── Full Validator Pipeline ────────────────────────────────

/**
 * Run the full Tier 1 stakeholder validation pipeline.
 * Validates all .md files in the stakeholder directory for:
 * - Directory file count cap (50)
 * - YAML frontmatter presence and validity
 * - Required fields (name, role, expertise, personality)
 * - Line count limit (100)
 *
 * Returns an array of structured findings compatible with Val.
 *
 * @param {string} stakeholderDir - Absolute path to custom/stakeholders/
 * @returns {{ findings: Array<{severity: string, section: string, claim: string, finding: string, evidence: string}>, filesProcessed: number, filesSkipped: number }}
 */
export function validateStakeholderFiles(stakeholderDir) {
  const findings = [];
  let filesProcessed = 0;
  let filesSkipped = 0;

  // T1: Discover files
  const files = discoverStakeholderFiles(stakeholderDir);

  // T1.2: Check 50-file directory cap
  if (files.length > MAX_FILES_IN_DIRECTORY) {
    findings.push(
      createFinding(
        "WARNING",
        "stakeholder-directory",
        `Directory should contain at most ${MAX_FILES_IN_DIRECTORY} stakeholder files`,
        `Directory contains ${files.length} files, exceeding the ${MAX_FILES_IN_DIRECTORY}-file cap`,
        `custom/stakeholders/ has ${files.length} .md files (FR-164 limit: ${MAX_FILES_IN_DIRECTORY})`
      )
    );
  }

  // Process each file
  for (const filePath of files) {
    // T2: Parse frontmatter
    const parseResult = parseFrontmatter(filePath);

    if (!parseResult.success) {
      filesSkipped++;
      findings.push(
        createFinding(
          "WARNING",
          "stakeholder-frontmatter",
          "File should have valid YAML frontmatter",
          `File skipped: ${parseResult.error}`,
          filePath
        )
      );
      continue;
    }

    filesProcessed++;

    // T3: Check required fields
    const missingFields = findMissingFields(parseResult.data);
    if (missingFields.length > 0) {
      findings.push(
        createFinding(
          "CRITICAL",
          "stakeholder-schema",
          "Stakeholder file must have all required fields: name, role, expertise, personality",
          `Missing required field(s): ${missingFields.join(", ")}`,
          filePath
        )
      );
    }

    // T4: Check line count
    const lineCount = countLines(filePath);
    if (lineCount > MAX_LINES_PER_FILE) {
      findings.push(
        createFinding(
          "WARNING",
          "stakeholder-size",
          `Stakeholder file should not exceed ${MAX_LINES_PER_FILE} lines`,
          `File has ${lineCount} lines, exceeding the ${MAX_LINES_PER_FILE}-line limit`,
          filePath
        )
      );
    }
  }

  return { findings, filesProcessed, filesSkipped };
}
