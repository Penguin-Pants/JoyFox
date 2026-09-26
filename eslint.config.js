import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/consistent-type-imports": "error" } },
  // Extension code reports real failures with console.warn and console.error.
  // Debug output goes only through the diagnostics flag (logDiagnostic).
  {
    files: ["src/**/*.ts"],
    rules: { "no-console": ["error", { allow: ["warn", "error"] }] },
  },
  {
    files: ["src/content/diagnostics.ts"],
    rules: { "no-console": ["error", { allow: ["warn", "error", "debug"] }] },
  },
);
