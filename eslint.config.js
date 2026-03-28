const js = require("@eslint/js");
const globals = require("globals");
const eslintConfigPrettier = require("eslint-config-prettier");

// Shared rules for both CJS (bin/) and ESM (test/) scopes
const sharedRules = {
  ...js.configs.recommended.rules,
  "no-console": "off",
  "no-eval": "error",
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrors: "none",
    },
  ],
};

module.exports = [
  // Global ignores
  {
    ignores: ["node_modules/", "coverage/"],
  },

  // bin/**/*.js — CJS, Node.js globals
  {
    files: ["bin/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },

  // test/**/*.js — ESM, Node.js globals + Vitest globals
  {
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        describe: true,
        it: true,
        expect: true,
        vi: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true,
      },
    },
    rules: sharedRules,
  },

  // Disable ESLint rules that conflict with Prettier (eslint-config-prettier)
  eslintConfigPrettier,
];
