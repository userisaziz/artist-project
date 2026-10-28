import importPlugin from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";

const FEATURES = [
  "artists",
  "auth",
  "bookings",
  "categories",
  "custom-services",
  "overview",
  "reviews",
];

export default [
  { ignores: ["dist/**", "storybook-static/**", "ds-bundle/**", ".design-sync/**", ".ds-sync/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    // boundary-check only: inline eslint-disable comments target other configs' rules
    linterOptions: { noInlineConfig: true },
    languageOptions: { parser: tsParser },
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": { typescript: { project: "./tsconfig.app.json" } },
    },
    rules: {
      "import/no-restricted-paths": [
        "warn",
        {
          zones: [
            // No cross-feature imports (except own files)
            ...FEATURES.map((f) => ({
              target: `./src/features/${f}`,
              from: "./src/features",
              except: [`./${f}`],
            })),
            // Features must never import from app/ (routes, layouts, providers)
            { target: "./src/features", from: "./src/app" },
            // Shared layers must never import features or app
            {
              target: ["./src/components", "./src/lib"],
              from: ["./src/app", "./src/features"],
            },
          ],
        },
      ],
    },
  },
];
