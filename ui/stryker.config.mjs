/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "!src/main.tsx",
    "!src/index.css",
    "!src/**/index.ts",
  ],
  reporters: ["html", "clear-text", "progress"],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  vitest: {
    configFile: "vitest.config.ts",
  },
};
