/**
 * PR bump label validation for staging merge enforcement.
 * Used by .github/workflows/label-check.yml (E14-S6, ADR-025).
 */

const VALID_BUMP_LABELS = Object.freeze([
  "bump:major",
  "bump:minor",
  "bump:patch",
  "bump:none",
]);

/**
 * Validate that exactly one bump:* label is present on a PR.
 *
 * @param {string[]} labels - Array of label names from the PR
 * @returns {{ pass: boolean, message: string }} Validation result
 */
function validateBumpLabels(labels) {
  const bumpLabels = labels.filter((label) => VALID_BUMP_LABELS.includes(label));

  if (bumpLabels.length === 0) {
    return {
      pass: false,
      message: `No bump label found. Add one of: ${VALID_BUMP_LABELS.join(", ")}`,
    };
  }

  if (bumpLabels.length > 1) {
    return {
      pass: false,
      message: `Multiple bump labels found: ${bumpLabels.join(", ")}. Exactly one required.`,
    };
  }

  return {
    pass: true,
    message: `Valid bump label: ${bumpLabels[0]}`,
  };
}

module.exports = validateBumpLabels;
module.exports.VALID_BUMP_LABELS = VALID_BUMP_LABELS;
