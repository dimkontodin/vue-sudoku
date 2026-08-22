import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import pluginVitest from "@vitest/eslint-plugin";
import pluginOxlint from "eslint-plugin-oxlint";
import skipFormatting from "eslint-config-prettier/flat";
import baseConfig from "../../eslint.config.mjs";

export default defineConfigWithVueTs(
    ...baseConfig,
    { files: ["**/*.{vue,ts,mts,tsx}"] },
    ...pluginVue.configs["flat/essential"],
    vueTsConfigs.recommended,
    { ...pluginVitest.configs.recommended, files: ["src/**/__tests__/*"] },
    ...pluginOxlint.buildFromOxlintConfigFile("../../.oxlintrc.json"),
    skipFormatting,
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.vue"],
        rules: {
            "vue/multi-word-component-names": "off",
            "@typescript-eslint/no-non-null-assertion": "off"
        }
    }
);
