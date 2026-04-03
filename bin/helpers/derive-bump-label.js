/**
 * Derive bump label from PR title conventional commit prefix.
 * Used by .github/workflows/pr-title-label.yml (E14-S11, ADR-025).
 *
 * @param {string} title - PR title
 * @param {string} body - PR body
 * @returns {{ label: string, type: string, breaking: boolean } | null}
 *   Returns the derived bump label info, or null if title doesn't match.
 */

const TITLE_REGEX = /^(feat|fix|refactor|perf|test|docs|chore|ci|style)(\(.+\))?(!)?: .+$/;

const TYPE_TO_LABEL = Object.freeze({
  feat: "bump:minor",
  fix: "bump:patch",
  perf: "bump:patch",
  refactor: "bump:none",
  test: "bump:none",
  docs: "bump:none",
  chore: "bump:none",
  ci: "bump:none",
  style: "bump:none",
});

function deriveBumpLabel(title, body) {
  const match = title.match(TITLE_REGEX);
  if (!match) return null;

  const type = match[1];
  const bang = match[3] === "!";
  const bodyBreaking = typeof body === "string" && body.includes("BREAKING CHANGE");
  const breaking = bang || bodyBreaking;

  const label = breaking ? "bump:major" : TYPE_TO_LABEL[type];

  return { label, type, breaking };
}

module.exports = deriveBumpLabel;
module.exports.TITLE_REGEX = TITLE_REGEX;
module.exports.TYPE_TO_LABEL = TYPE_TO_LABEL;
