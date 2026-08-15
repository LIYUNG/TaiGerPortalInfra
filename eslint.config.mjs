import globals from "globals";
import pluginJs from "@eslint/js";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ["dist/**", "cdk.out/**", "node_modules/**", "coverage/**"]
    },
    {
        files: ["**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslintPlugin
        },
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./tsconfig.json"
            },
            globals: {
                ...globals.node
            }
        },
        rules: {
            ...typescriptEslintPlugin.configs.recommended.rules,
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    vars: "all",
                    args: "after-used",
                    varsIgnorePattern: "^Construct",
                    argsIgnorePattern: "^_",
                    ignoreRestSiblings: true
                }
            ],
            // Lambda logging goes to CloudWatch via console.
            "no-console": "off"
        }
    },
    {
        // Tooling config files that stay plain JS/ESM.
        files: ["**/*.js", "**/*.mjs"],
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.node
            }
        },
        ...pluginJs.configs.recommended
    }
];
