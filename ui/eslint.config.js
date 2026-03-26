import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import boundaries from "eslint-plugin-boundaries";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node", "node_modules", "target", "*.config.*", "postcss.config.js"] },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript strict + stylistic rules
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React hooks rules
  {
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // React refresh (HMR safety)
  {
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // Security rules
  security.configs.recommended,

  // Accessibility rules
  jsxA11y.flatConfigs.recommended,

  // Feature-slice boundary enforcement
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "feature", pattern: "src/features/*", capture: ["feature"] },
        { type: "shared", pattern: "src/shared/*" },
        { type: "app", pattern: "src", mode: "file" },
      ],
      "boundaries/ignore": ["**/*.test.*", "**/*.spec.*"],
    },
    rules: {
      // Features cannot import from other features — must go through shared
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // Features can import from shared
            { from: "feature", allow: ["shared"] },
            // Features can import from themselves
            {
              from: [["feature", { feature: "${feature}" }]],
              allow: [["feature", { feature: "${feature}" }]],
            },
            // Shared can only import from shared
            { from: "shared", allow: ["shared"] },
            // App root can import from features and shared
            { from: "app", allow: ["feature", "shared"] },
          ],
        },
      ],
      // Prevent cross-feature private imports
      "boundaries/no-private": ["error"],
    },
  },

  // Global settings
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Relax some rules that are too noisy for React
  {
    rules: {
      // Allow non-null assertions in tests and type-safe contexts
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Allow empty interfaces for React component props
      "@typescript-eslint/no-empty-object-type": "off",
      // Template literals are fine
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      // Allow void for fire-and-forget
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true },
      ],
      // Allow unused vars starting with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Test file overrides
  {
    files: ["tests/**/*", "**/*.test.*", "**/*.spec.*"],
    rules: {
      // Relax type-checked rules in tests for readability
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },

  // Prettier must be last — disables formatting-related rules
  prettier,
);
