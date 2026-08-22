import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVitest from "@vitest/eslint-plugin";
import pluginOxlint from "eslint-plugin-oxlint";
import skipFormatting from "eslint-config-prettier/flat";
import baseConfig from "../../eslint.config.mjs";

export default defineConfigWithVueTs(
    ...baseConfig,
    { files: ["**/*.{ts,mts,tsx}"] },
    vueTsConfigs.recommended,
    { ...pluginVitest.configs.recommended, files: ["src/**/__tests__/*"] },
    ...pluginOxlint.buildFromOxlintConfigFile("../../.oxlintrc.json"),
    skipFormatting,
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: { "@typescript-eslint/no-non-null-assertion": "off" }
    }
);
