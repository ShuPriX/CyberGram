import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "out/**", "build/**", "drizzle/**", ".data/**", "next-env.d.ts"],
  },
  {
    // CommonJS by necessity: this file is preloaded with `node --require`.
    files: ["scripts/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    rules: {
      // User media is resized and re-encoded at upload time and served from our own
      // authenticated file route, so plain <img> is the right primitive for it.
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
