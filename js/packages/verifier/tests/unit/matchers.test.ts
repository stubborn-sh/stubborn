import { describe, it, expect } from "vitest";
import { byRegex, byType, byEquality } from "../../src/matchers.js";

describe("byRegex", () => {
  it("should_match_string_against_regex", () => {
    expect(byRegex("123", "[0-9]+")).toBe(true);
    expect(byRegex("abc", "[0-9]+")).toBe(false);
  });

  it("should_match_number_converted_to_string", () => {
    expect(byRegex(42, "[0-9]+")).toBe(true);
  });

  it("should_require_full_match", () => {
    expect(byRegex("abc123", "[0-9]+")).toBe(false);
    expect(byRegex("123", "^[0-9]+$")).toBe(true);
  });

  it("should_return_false_for_non_string_non_number", () => {
    expect(byRegex(null, ".*")).toBe(false);
    expect(byRegex(undefined, ".*")).toBe(false);
    expect(byRegex({}, ".*")).toBe(false);
    expect(byRegex([], ".*")).toBe(false);
    expect(byRegex(true, ".*")).toBe(false);
  });

  it("should_handle_uuid_pattern", () => {
    expect(
      byRegex(
        "550e8400-e29b-41d4-a716-446655440000",
        "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
      ),
    ).toBe(true);
  });
});

describe("byType", () => {
  it("should_match_same_type", () => {
    expect(byType("hello", "world")).toBe(true);
    expect(byType(42, 100)).toBe(true);
    expect(byType(true, false)).toBe(true);
  });

  it("should_not_match_different_types", () => {
    expect(byType("hello", 42)).toBe(false);
    expect(byType(42, "hello")).toBe(false);
  });

  it("should_return_false_for_null_value", () => {
    expect(byType(null, "hello")).toBe(false);
  });

  it("should_return_false_for_undefined_value", () => {
    expect(byType(undefined, "hello")).toBe(false);
  });

  it("should_return_false_when_expected_is_null", () => {
    expect(byType("hello", null)).toBe(false);
  });
});

describe("byEquality", () => {
  it("should_match_equal_primitives", () => {
    expect(byEquality("hello", "hello")).toBe(true);
    expect(byEquality(42, 42)).toBe(true);
    expect(byEquality(true, true)).toBe(true);
  });

  it("should_not_match_different_primitives", () => {
    expect(byEquality("hello", "world")).toBe(false);
    expect(byEquality(42, 43)).toBe(false);
  });

  it("should_deep_equal_objects", () => {
    expect(byEquality({ a: 1, b: "two" }, { a: 1, b: "two" })).toBe(true);
    expect(byEquality({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("should_deep_equal_arrays", () => {
    expect(byEquality([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(byEquality([1, 2], [1, 2, 3])).toBe(false);
  });

  it("should_deep_equal_nested_objects", () => {
    expect(byEquality({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
    expect(byEquality({ a: { b: [1, 2] } }, { a: { b: [1, 3] } })).toBe(false);
  });

  it("should_handle_null_values", () => {
    expect(byEquality(null, null)).toBe(true);
    expect(byEquality(null, "hello")).toBe(false);
  });
});
