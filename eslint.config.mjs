import globals from "globals";
import pluginJs from "@eslint/js";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import babelParser from "@babel/eslint-parser";

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        files: ["**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslintPlugin
        },
        languageOptions: {
            parser: babelParser, // Use the TypeScript parser
            parserOptions: {
                requireConfigFile: false, // For Babel parser
                babelOptions: {
                    presets: ["@babel/preset-env", "@babel/preset-typescript"] // Use Babel presets
                }
            }
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    vars: "all",
                    args: "after-used",
                    varsIgnorePattern: "^Construct",
                    ignoreRestSiblings: true
                }
            ]
        }
    },
    {
        files: ["**/*.js"],
        plugins: {
            "@eslint/js": typescriptEslintPlugin
        },
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.node // Add Node.js globals like `process`, `require`, `module`
            }
        },
        ...pluginJs.configs.recommended
    }
];
