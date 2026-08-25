import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/supertest.ts"],
  format: ["esm", "cjs"],
  dts: false,
  clean: true,
  sourcemap: true,
  // supertest is an optional peer dependency, loaded at run time.
  external: ["@stubborn-sh/broker-client", "@stubborn-sh/stub-server", "supertest"],
});
