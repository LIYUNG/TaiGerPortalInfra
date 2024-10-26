import babelParser from "@babel/eslint-parser";

export default [
    {
        files: ["**/*.ts"],
        plugins: {},
        languageOptions: {
            parser: babelParser
        },
        rules: {}
    }
];
