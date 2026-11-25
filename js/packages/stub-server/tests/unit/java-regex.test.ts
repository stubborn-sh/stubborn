import { describe, it, expect } from "vitest";
import { javaFullMatchRegex } from "../../src/java-regex.js";
import { matchesJsonPath } from "../../src/json-path.js";

const full = (pattern: string, value: string): boolean | null =>
  javaFullMatchRegex(pattern)?.test(value) ?? null;

describe("javaFullMatchRegex", () => {
  it("should_compile_every_stubborn_contract_RegexPatterns_value", () => {
    // Values from sh.stubborn.contract.spec.internal.RegexPatterns, with a sample each matches.
    const patterns: readonly (readonly [string, string])[] = [
      ["(true|false)", "true"],
      ["[a-zA-Z0-9]+", "a1"],
      ["[\\p{L}]*", "abcŻółć"],
      ["-?(\\d*\\.\\d+|\\d+)", "-1.5"],
      ["-?(\\d+)", "-12"],
      ["([1-9]\\d*)", "10"],
      ["-?(\\d*\\.\\d+)", "0.5"],
      ["[a-fA-F0-9]+", "aF09"],
      ["((http[s]?|ftp):/)/?([^:/\\s]+)(:[0-9]{1,5})?", "https://host:80"],
      ["[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}", "a@b.io"],
      [
        "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
        "123e4567-e89b-12d3-a456-426614174000",
      ],
      ["(\\d\\d\\d\\d)-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])", "2017-01-01"],
      [
        "([0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])",
        "2017-01-01T01:23:45",
      ],
      ["(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])", "01:02:34"],
      ["[\\S\\s]+", "x\ny"],
      ["^\\s*\\S[\\S\\s]*", " x"],
      [
        "([0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\.\\d+)?(Z|[+-][01]\\d:[0-5]\\d)",
        "2017-01-01T01:23:45.1Z",
      ],
    ];
    for (const [pattern, sample] of patterns) {
      expect(full(pattern, sample), pattern).toBe(true);
    }
  });

  it("should_treat_p_L_as_a_letter_class_not_literal_characters", () => {
    expect(full("[\\p{L}]*", "abc")).toBe(true);
    expect(full("[\\p{L}]*", "a1")).toBe(false);
    expect(full("\\pL+", "abc")).toBe(true);
    expect(full("\\P{L}+", "123")).toBe(true);
  });

  it("should_translate_java_only_property_names", () => {
    expect(full("\\p{Alpha}+", "abc")).toBe(true);
    expect(full("\\p{Alpha}+", "ab1")).toBe(false);
    expect(full("[\\p{Digit}x]+", "1x2")).toBe(true);
    expect(full("\\p{IsLatin}+", "abc")).toBe(true);
    expect(full("\\p{IsAlphabetic}+", "abc")).toBe(true);
    expect(full("\\p{javaLowerCase}+", "abc")).toBe(true);
    expect(full("\\p{javaLowerCase}+", "aBc")).toBe(false);
  });

  it("should_reject_what_javascript_cannot_reproduce", () => {
    expect(javaFullMatchRegex("\\p{InGreek}+")).toBeNull();
    expect(javaFullMatchRegex("\\p{NoSuchProperty}")).toBeNull();
    expect(javaFullMatchRegex("(?x) a b")).toBeNull();
  });

  it("should_turn_leading_inline_flags_into_javascript_flags", () => {
    expect(full("(?i)abc", "ABC")).toBe(true);
    expect(full("(?s).*complex.*", "a\ncomplex\n")).toBe(true);
    expect(full("abc", "ABC")).toBe(false);
  });

  it("should_be_dotall_by_default_like_wiremock", () => {
    expect(full("a.b", "a\nb")).toBe(true);
    expect(javaFullMatchRegex("a.b", { dotAll: false })?.test("a\nb")).toBe(false);
  });

  it("should_apply_unicode_classes_in_jsonpath_regex_filters", () => {
    // SCC writes onlyAlphaUnicode() body matchers as $[?(@.['name'] =~ /([\p{L}]*)/)].
    expect(matchesJsonPath({ name: "Zoë" }, "$[?(@.['name'] =~ /([\\p{L}]*)/)]")).toBe(true);
    expect(matchesJsonPath({ name: "Zoë1" }, "$[?(@.['name'] =~ /([\\p{L}]*)/)]")).toBe(false);
  });
});
