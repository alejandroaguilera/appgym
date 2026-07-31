import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // §5.5 requires computing elapsed time as (Date.now() - startedAt) on
      // every render/tick rather than accumulating via setInterval — that's
      // the correct durability pattern here, not an impurity bug. Standard
      // "fetch on mount" effects also trip the new set-state-in-effect rule.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
