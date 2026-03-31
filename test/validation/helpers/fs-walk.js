import { readdirSync, statSync, realpathSync } from "fs";
import { join } from "path";

/**
 * Match a filename against a simple glob pattern.
 * Supports: exact match ("workflow.yaml"), prefix glob ("gaia*.md"),
 * suffix glob ("*-template.md"), and contains glob ("*something*").
 * Only handles a single `*` wildcard in one segment — no `**` or `?`.
 *
 * @param {string} name - The filename to test
 * @param {string} pattern - The glob pattern
 * @returns {boolean}
 */
function matchGlob(name, pattern) {
  if (!pattern.includes("*")) {
    return name === pattern;
  }

  const starIndex = pattern.indexOf("*");
  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);

  // If there's a second *, treat it as a contains match
  if (suffix.includes("*")) {
    // e.g., "*something*" — just check contains for the middle part
    const middle = suffix.slice(0, suffix.indexOf("*"));
    return name.includes(middle);
  }

  return (
    name.startsWith(prefix) && name.endsWith(suffix) && name.length >= prefix.length + suffix.length
  );
}

/**
 * Recursively walk a directory tree and return matching file paths.
 *
 * Uses Node.js built-in `fs.readdirSync({ recursive: true })` (Node 20+).
 * Returns absolute paths normalized to forward slashes.
 *
 * @param {string} dir - Absolute path to the directory to walk
 * @param {Object} [options]
 * @param {string} [options.namePattern] - Glob pattern for filename matching (e.g., "workflow.yaml", "gaia*.md", "*-template.md")
 * @param {string[]} [options.exclude] - Directory names to exclude (e.g., ["node_modules", "_backups"])
 * @param {boolean} [options.followSymlinks=false] - Whether to follow symbolic links (matching `find -L` behavior)
 * @returns {string[]} Array of absolute file paths, normalized to forward slashes
 */
export function walkFiles(dir, options = {}) {
  const { namePattern, exclude = [], followSymlinks = false } = options;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  // Track visited real paths to prevent circular symlink loops
  const visited = followSymlinks ? new Set() : null;
  if (followSymlinks) {
    try {
      visited.add(realpathSync(dir));
    } catch {
      // If we can't resolve the root, continue without cycle detection
    }
  }

  const results = [];

  for (const entry of entries) {
    // Build absolute path using parentPath (Node 21+) or path (Node 20)
    const parentDir = entry.parentPath || entry.path;
    const absPath = join(parentDir, entry.name);

    // Normalize to forward slashes for cross-platform consistency
    const normalized = absPath.split("\\").join("/");

    // Check exclusions against path segments
    if (exclude.length > 0) {
      const segments = normalized.split("/");
      const excluded = exclude.some((exc) => segments.includes(exc));
      if (excluded) continue;
    }

    // Determine if this is a file (following symlinks if requested)
    let isFile;
    if (followSymlinks) {
      try {
        const realPath = realpathSync(absPath);
        if (visited.has(realPath)) continue; // Circular symlink — skip
        visited.add(realPath);
        const stat = statSync(absPath);
        isFile = stat.isFile();
      } catch {
        // Can't resolve — skip this entry
        continue;
      }
    } else {
      isFile = entry.isFile();
    }

    if (!isFile) continue;

    // Match against name pattern
    if (namePattern) {
      if (!matchGlob(entry.name, namePattern)) continue;
    }

    results.push(normalized);
  }

  return results;
}
