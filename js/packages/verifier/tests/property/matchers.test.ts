import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { byRegex, byType, byEquality } from "../../src/matchers.js";

describe("matchers property tests", () => {
  it("byEquality_should_be_reflexive", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(byEquality(value, value)).toBe(true);
      }),
    );
  });

  it("byEquality_should_be_symmetric", () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (a, b) => {
        expect(byEquality(a, b)).toBe(byEquality(b, a));
      }),
    );
  });

  it("byType_should_match_values_of_same_type", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        (a, b) => {
          if (typeof a === typeof b) {
            expect(byType(a, b)).toBe(true);
          }
        },
      ),
    );
  });

  it("byRegex_should_always_match_dot_star", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(byRegex(value, ".*")).toBe(true);
      }),
    );
  });

  it("byRegex_should_match_string_values_against_exact_pattern", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
        (value) => {
          // Escaping the value to use as exact match pattern
          expect(byRegex(value, value)).toBe(true);
        },
      ),
    );
  });
});
