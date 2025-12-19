import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      // Guardrails against leaking environment variables and stack traces.
      // These are lint-only and do not change runtime behavior; they just
      // prevent future code from reintroducing secret-logging patterns.
      "no-restricted-syntax": [
        "error",
        {
          // Disallow logging process.env via console.*
          selector:
            "CallExpression[callee.object.name='console'][callee.property.name=/^(log|info|warn|error|debug)$/] MemberExpression[object.name='process'][property.name='env']",
          message:
            "Do not log process.env or environment variables; this can leak secrets to logs.",
        },
        {
          // Disallow JSON.stringify(process.env) anywhere.
          selector:
            "CallExpression[callee.object.name='JSON'][callee.property.name='stringify'] MemberExpression[object.name='process'][property.name='env']",
          message:
            "Do not serialize process.env; this can leak all environment variables.",
        },
        {
          // Disallow including a `stack` property in objects returned via NextResponse.json.
          selector:
            "CallExpression[callee.object.name='NextResponse'][callee.property.name='json'] ObjectExpression > Property[key.name='stack']",
          message:
            "Do not include error.stack in JSON responses; it can expose internal details.",
        },
        {
          // Fallback: any .json(...) call that includes a `stack` property in the payload.
          selector:
            "CallExpression[callee.property.name='json'] ObjectExpression > Property[key.name='stack']",
          message:
            "Do not include error.stack in JSON responses; it can expose internal details.",
        },
      ],
    },
  },
];

export default eslintConfig;
