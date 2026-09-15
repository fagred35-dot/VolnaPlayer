import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "electron/**", "node_modules/**", "release/**", "android/**", "assets/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    // node-скрипты (smoke-тесты): CommonJS + глобалы Node.js
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        Buffer: "readonly",
        require: "readonly",
        module: "writable",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-empty": "off",
    },
  }
);
