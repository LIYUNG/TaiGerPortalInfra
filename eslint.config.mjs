import babelParser from "@babel/eslint-parser";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

export default [
    {
        files: ["**/*.ts", "**/*.js"],
        plugins: {
            "@typescript-eslint": typescriptEslintPlugin,
            "unused-imports": unusedImportsPlugin
        },
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false, // For Babel parser
                babelOptions: {
                    presets: ["@babel/preset-env", "@babel/preset-typescript"] // Use Babel presets
                }
            }
        },
        rules: {
            // TypeScript unused variables
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_"
                }
            ],
            // Unused imports
            "unused-imports/no-unused-imports": "error", // Reports and autofixes unused imports
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_"
                }
            ]
        }
    }
];
