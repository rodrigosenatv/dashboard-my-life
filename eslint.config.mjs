import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Diálogos reiniciam o formulário ao abrir; o padrão é intencional.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  { files: ["tests/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bibliotecas copiadas como estão (foliate-js) e arquivos gerados do pdf.js
    "src/vendor/**",
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
