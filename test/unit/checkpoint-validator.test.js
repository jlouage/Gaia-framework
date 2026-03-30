import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { createHash } from "crypto";

// Module under test — does not exist yet (RED phase)
import {
  validateCheckpoint,
  validateFilesTouched,
  compareChecksums,
  detectResumeMode,
  parseCheckpointFile,
} from "../../lib/checkpoint-validator.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/checkpoints");
const TMP_DIR = resolve(import.meta.dirname, "../fixtures/tmp");

describe("Checkpoint Validator", () => {
  // --- AC3: Checkpoint format validation ---
  describe("validateCheckpoint — AC3: required fields and value types", () => {
    it("should return valid for a well-formed checkpoint", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 3,
        files_touched: [
          {
            path: "some/file.js",
            checksum: "sha256:" + "a".repeat(64),
            last_modified: "2026-03-24T10:00:00Z",
          },
        ],
        variables: { story_key: "E1-S1" },
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject checkpoint missing 'workflow' field", () => {
      const checkpoint = { step: 3, files_touched: [], variables: {} };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "workflow" }));
    });

    it("should reject checkpoint missing 'step' field", () => {
      const checkpoint = {
        workflow: "dev-story",
        files_touched: [],
        variables: {},
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "step" }));
    });

    it("should reject checkpoint with step = 0", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 0,
        files_touched: [],
        variables: {},
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "step", reason: expect.stringContaining("non-zero") })
      );
    });

    it("should reject checkpoint with non-integer step", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: "three",
        files_touched: [],
        variables: {},
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "step" }));
    });

    it("should reject checkpoint with empty workflow string", () => {
      const checkpoint = {
        workflow: "",
        step: 3,
        files_touched: [],
        variables: {},
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "workflow" }));
    });

    it("should reject checkpoint with null workflow", () => {
      const checkpoint = {
        workflow: null,
        step: 3,
        files_touched: [],
        variables: {},
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
    });

    it("should reject checkpoint missing 'variables' field", () => {
      const checkpoint = { workflow: "dev-story", step: 3, files_touched: [] };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "variables" }));
    });

    it("should reject checkpoint with non-object variables", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 3,
        files_touched: [],
        variables: "not-an-object",
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
    });

    it("should accept checkpoint without files_touched (legacy format)", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 3,
        variables: { story_key: "E1-S1" },
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(true);
    });

    it("should reject checkpoint with non-array files_touched", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 3,
        files_touched: "not-an-array",
        variables: {},
      };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
    });

    it("should collect multiple errors for multiple invalid fields", () => {
      const checkpoint = { step: 0 };
      const result = validateCheckpoint(checkpoint);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- AC3: files_touched entry validation ---
  describe("validateFilesTouched — AC3: sha256 checksum format", () => {
    it("should accept valid files_touched entries", () => {
      const entries = [
        {
          path: "some/file.js",
          checksum: "sha256:" + "abcdef0123456789".repeat(4),
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      const result = validateFilesTouched(entries);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject entry missing path", () => {
      const entries = [
        {
          checksum: "sha256:" + "a".repeat(64),
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      const result = validateFilesTouched(entries);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("path");
    });

    it("should reject entry with invalid checksum format", () => {
      const entries = [
        {
          path: "some/file.js",
          checksum: "md5:abc123",
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      const result = validateFilesTouched(entries);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("sha256");
    });

    it("should reject entry with short hex in checksum", () => {
      const entries = [
        {
          path: "some/file.js",
          checksum: "sha256:abc123",
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      const result = validateFilesTouched(entries);
      expect(result.valid).toBe(false);
    });

    it("should reject entry missing last_modified", () => {
      const entries = [
        {
          path: "some/file.js",
          checksum: "sha256:" + "a".repeat(64),
        },
      ];
      const result = validateFilesTouched(entries);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("last_modified");
    });

    it("should accept empty files_touched array", () => {
      const result = validateFilesTouched([]);
      expect(result.valid).toBe(true);
    });

    it("should validate multiple entries and report all errors", () => {
      const entries = [
        { path: "a.js" }, // missing checksum and last_modified
        { checksum: "bad" }, // missing path and last_modified, bad checksum
      ];
      const result = validateFilesTouched(entries);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- AC2a/AC2b: Checksum comparison ---
  describe("compareChecksums — AC2a/AC2b: detect modifications and deletions", () => {
    const tmpFile = join(TMP_DIR, "checksum-test-file.txt");

    beforeEach(() => {
      if (!existsSync(TMP_DIR)) {
        mkdirSync(TMP_DIR, { recursive: true });
      }
      writeFileSync(tmpFile, "original content", "utf8");
    });

    afterEach(() => {
      try {
        unlinkSync(tmpFile);
      } catch {
        // file may already be deleted by test
      }
    });

    it("should report matched when file checksum matches", () => {
      const checksum = createHash("sha256").update(readFileSync(tmpFile)).digest("hex");
      const filesTouched = [
        {
          path: tmpFile,
          checksum: `sha256:${checksum}`,
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      const result = compareChecksums(filesTouched);
      expect(result.matched).toHaveLength(1);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it("should detect modified file — AC2a", () => {
      const filesTouched = [
        {
          path: tmpFile,
          checksum: "sha256:" + "0".repeat(64), // wrong checksum
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      const result = compareChecksums(filesTouched);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].path).toBe(tmpFile);
    });

    it("should detect deleted file — AC2b", () => {
      unlinkSync(tmpFile); // delete the file
      const filesTouched = [
        {
          path: tmpFile,
          checksum: "sha256:" + "a".repeat(64),
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      const result = compareChecksums(filesTouched);
      expect(result.deleted).toHaveLength(1);
      expect(result.deleted[0].path).toBe(tmpFile);
    });

    it("should handle mixed matched, modified, and deleted files", () => {
      const checksum = createHash("sha256").update(readFileSync(tmpFile)).digest("hex");
      const filesTouched = [
        {
          path: tmpFile,
          checksum: `sha256:${checksum}`,
          last_modified: "2026-03-24T10:00:00Z",
        },
        {
          path: tmpFile + ".modified",
          checksum: "sha256:" + "0".repeat(64),
          last_modified: "2026-03-24T10:00:00Z",
        },
        {
          path: join(TMP_DIR, "nonexistent-file.txt"),
          checksum: "sha256:" + "f".repeat(64),
          last_modified: "2026-03-24T10:00:00Z",
        },
      ];
      // Create the "modified" file with different content
      writeFileSync(tmpFile + ".modified", "different content", "utf8");
      const result = compareChecksums(filesTouched);
      expect(result.matched).toHaveLength(1);
      expect(result.modified).toHaveLength(1);
      expect(result.deleted).toHaveLength(1);
      // cleanup
      try {
        unlinkSync(tmpFile + ".modified");
      } catch {
        /* noop */
      }
    });
  });

  // --- AC5: Legacy checkpoint backward compatibility ---
  describe("detectResumeMode — AC5: legacy checkpoint support", () => {
    it("should return 'validate' when files_touched is present", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 3,
        files_touched: [
          {
            path: "a.js",
            checksum: "sha256:" + "a".repeat(64),
            last_modified: "2026-03-24T10:00:00Z",
          },
        ],
        variables: {},
      };
      expect(detectResumeMode(checkpoint)).toBe("validate");
    });

    it("should return 'skip-validation' when files_touched is missing — AC5", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 2,
        variables: { story_key: "E1-S2" },
      };
      expect(detectResumeMode(checkpoint)).toBe("skip-validation");
    });

    it("should return 'skip-validation' when files_touched is empty array", () => {
      const checkpoint = {
        workflow: "dev-story",
        step: 2,
        files_touched: [],
        variables: {},
      };
      expect(detectResumeMode(checkpoint)).toBe("skip-validation");
    });
  });

  // --- AC1b: Parse checkpoint file with error handling ---
  describe("parseCheckpointFile — AC1b: graceful error handling", () => {
    it("should parse a valid YAML checkpoint file", () => {
      const filePath = join(FIXTURES_DIR, "valid-checkpoint.yaml");
      const result = parseCheckpointFile(filePath);
      expect(result.success).toBe(true);
      expect(result.data.workflow).toBe("dev-story");
      expect(result.data.step).toBe(3);
    });

    it("should return error for missing checkpoint file — AC1b", () => {
      const result = parseCheckpointFile("/nonexistent/path/checkpoint.yaml");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should return error for corrupted YAML — AC1b", () => {
      const filePath = join(FIXTURES_DIR, "invalid-yaml-checkpoint.yaml");
      const result = parseCheckpointFile(filePath);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return error identifying specific missing fields — AC1b", () => {
      const filePath = join(FIXTURES_DIR, "missing-fields-checkpoint.yaml");
      const result = parseCheckpointFile(filePath);
      // File parses as YAML but validation should fail
      expect(result.success).toBe(true); // YAML parses OK
      const validation = validateCheckpoint(result.data);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.field === "step")).toBe(true);
    });

    it("should parse legacy checkpoint without files_touched — AC5", () => {
      const filePath = join(FIXTURES_DIR, "legacy-checkpoint.yaml");
      const result = parseCheckpointFile(filePath);
      expect(result.success).toBe(true);
      expect(result.data.files_touched).toBeUndefined();
      expect(result.data.workflow).toBe("dev-story");
      expect(result.data.step).toBe(2);
    });
  });
});
