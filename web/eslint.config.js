import babelParser from "@babel/eslint-parser";

// 这不是风格检查。只锁已经退场的 UI 库，防止 antd / react-aria 再长回来。
// 用 Babel 解析 TS/TSX：typescript-eslint 8 在 TypeScript 7 上会直接拒绝启动。
const retiredUiMessage = "UI 组件统一使用 shadcn/ui（Radix）与 @/components/ui/*；antd、@ant-design/* 与 react-aria-components 已退场。";

// 源码里还有 react-hooks/exhaustive-deps 的 disable 注释。本闸门不启用 hooks 规则，
// 只挂一个空规则，避免 ESLint 把未知规则名当成错误。
const commentCompatPlugin = {
    rules: {
        "exhaustive-deps": {
            meta: { type: "problem" },
            create() {
                return {};
            },
        },
    },
};

export default [
    {
        ignores: ["dist/**", "node_modules/**", "coverage/**"],
    },
    {
        files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx,mjs}"],
        plugins: {
            "react-hooks": commentCompatPlugin,
        },
        linterOptions: {
            reportUnusedDisableDirectives: "off",
        },
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                sourceType: "module",
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                    presets: [["@babel/preset-typescript", { allExtensions: true, isTSX: true, allowDeclareFields: true }]],
                },
            },
        },
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        { name: "antd", message: retiredUiMessage },
                        { name: "react-aria-components", message: retiredUiMessage },
                    ],
                    patterns: [{ group: ["antd/*", "@ant-design/*"], message: retiredUiMessage }],
                },
            ],
        },
    },
];
