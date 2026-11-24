import { describe, it, expect } from "vitest";
import { javaFullMatchRegex } from "@stubborn-sh/stub-server";
import { PREDEFINED_PATTERNS, predefinedPattern } from "../../src/predefined-patterns.js";

/**
 * One value each predefined regex accepts and one it rejects. The outcomes were checked with
 * `String.matches` against the JVM's own `RegexPatterns` (spec-java), whose pattern text
 * PREDEFINED_PATTERNS reproduces.
 */
const SAMPLES: Record<string, readonly [accepted: string, rejected: string]> = {
  only_alpha_unicode: ["Zażółć", "abc1"],
  number: ["-3.5", "1e5"],
  any_double: ["0.5", "5"],
  any_boolean: ["true", "yes"],
  ip_address: ["192.168.0.1", "256.1.1.1"],
  hostname: ["https://example.com:8080", "example.com"],
  email: ["a.b@example.org", "a@b"],
  url: ["https://example.com/path?x=1", "not a url"],
  uuid: ["123e4567-e89b-12d3-a456-426614174000", "123E4567-E89B-12D3-A456-426614174000"],
  iso_date: ["2024-02-29", "2024-2-29"],
  iso_date_time: ["2024-02-29T23:59:59", "2024-02-29T23:59:59Z"],
  iso_time: ["23:59:59", "24:00:00"],
  iso_8601_with_offset: ["2024-02-29T23:59:59.123+01:00", "2024-02-29T23:59:59"],
  non_empty: [" ", ""],
  non_blank: [" a ", "   "],
};

describe("predefined regexes", () => {
  it("should_define_every_YamlContract_PredefinedRegex_name", () => {
    expect(Object.keys(PREDEFINED_PATTERNS).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  for (const [name, [accepted, rejected]] of Object.entries(SAMPLES)) {
    it(`should_match_${name}_as_the_jvm_does`, () => {
      const regex = javaFullMatchRegex(predefinedPattern(name) ?? "", { dotAll: false });
      expect(regex).not.toBeNull();
      expect(regex?.test(accepted)).toBe(true);
      expect(regex?.test(rejected)).toBe(false);
    });
  }

  it("should_not_resolve_an_unknown_or_inherited_name", () => {
    expect(predefinedPattern("uuid4")).toBeUndefined();
    expect(predefinedPattern("toString")).toBeUndefined();
  });
});
