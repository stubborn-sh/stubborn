/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.workspace.ts",
    project: "unit",
  },
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: ["packages/*/src/**/*.ts", "!packages/*/src/index.ts"],
  thresholds: {
    high: 90,
    low: 80,
    break: 80,
  },
  mutator: {
    excludedMutations: [],
  },
};
