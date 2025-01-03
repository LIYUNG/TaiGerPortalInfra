import babelParser from "@babel/eslint-parser";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";

export default [
    {
        files: ["**/*.ts", "**/*.js"],
        plugins: {
            "@typescript-eslint": typescriptEslintPlugin
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
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error"]
        }
    }
];
