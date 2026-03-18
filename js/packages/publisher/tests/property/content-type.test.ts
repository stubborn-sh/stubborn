import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { detectContentType } from "../../src/content-type.js";

describe("content-type property tests", () => {
  it("should_never_throw_for_arbitrary_filenames", () => {
    fc.assert(
      fc.property(fc.string(), (filename) => {
        const result = detectContentType(filename);
        expect(result === null || typeof result === "string").toBe(true);
      }),
    );
  });

  it("should_always_return_yaml_type_for_yaml_extension", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map((name) => `${name}.yaml`),
        (filename) => {
          expect(detectContentType(filename)).toBe("application/x-yaml");
        },
      ),
    );
  });

  it("should_always_return_json_type_for_json_extension", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map((name) => `${name}.json`),
        (filename) => {
          expect(detectContentType(filename)).toBe("application/json");
        },
      ),
    );
  });
});
