import { describe, it, expect } from "vitest";
import { matchRequest } from "../../src/request-matcher.js";
import type { ParsedContract } from "../../src/contract-parser.js";

function contract(overrides: Partial<ParsedContract["request"]> = {}): ParsedContract {
  return {
    name: "test",
    request: {
      method: "POST",
      urlPath: "/api/test",
      ...overrides,
    },
    response: { status: 200 },
  };
}

describe("matchesJsonPath body patterns", () => {
  // --- String equality ---

  it("should_match_string_equality_bracket_notation", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['product'] == 'iPhone 16')]" }],
    });
    const body = { product: "iPhone 16", amount: 999.99 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_string_equality_dot_notation", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.product == 'iPhone 16')]" }],
    });
    const body = { product: "iPhone 16" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_wrong_string_value", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['product'] == 'iPhone 16')]" }],
    });
    const body = { product: "MacBook Pro" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_not_match_missing_field", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['product'] == 'iPhone 16')]" }],
    });
    const body = { name: "something else" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  // --- Numeric equality ---

  it("should_match_numeric_equality", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['amount'] == 999.99)]" }],
    });
    const body = { amount: 999.99 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_integer_equality", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['count'] == 42)]" }],
    });
    const body = { count: 42 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_numeric_string_vs_number", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['amount'] == 999.99)]" }],
    });
    // String "999.99" should NOT match number 999.99 — strict typing
    const body = { amount: "999.99" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  // --- Boolean and null ---

  it("should_match_boolean_true", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['active'] == true)]" }],
    });
    const body = { active: true };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_boolean_false", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['active'] == false)]" }],
    });
    const body = { active: false };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_null_value", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['deletedAt'] == null)]" }],
    });
    const body = { deletedAt: null };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  // --- Multiple patterns (AND logic) ---

  it("should_require_all_patterns_to_match", () => {
    const c = contract({
      bodyPatterns: [
        { matchesJsonPath: "$[?(@.['product'] == 'iPhone 16')]" },
        { matchesJsonPath: "$[?(@.['amount'] == 999.99)]" },
      ],
    });
    const body = { product: "iPhone 16", amount: 999.99 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_fail_when_one_pattern_does_not_match", () => {
    const c = contract({
      bodyPatterns: [
        { matchesJsonPath: "$[?(@.['product'] == 'iPhone 16')]" },
        { matchesJsonPath: "$[?(@.['amount'] == 999.99)]" },
      ],
    });
    const body = { product: "iPhone 16", amount: 1299.99 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  // --- Existence check ($.field path) ---

  it("should_match_existence_check", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.product" }],
    });
    const body = { product: "iPhone 16" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_fail_existence_check_for_missing_field", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.product" }],
    });
    const body = { name: "something" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  // --- Nested field access ---

  it("should_match_nested_field_bracket_notation", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['order'].['id'] == 'ORD-123')]" }],
    });
    const body = { order: { id: "ORD-123" } };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  // --- Edge cases ---

  it("should_handle_empty_body_against_jsonpath", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['field'] == 'value')]" }],
    });
    const result = matchRequest("POST", "/api/test", {}, undefined, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_handle_null_body_against_jsonpath", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['field'] == 'value')]" }],
    });
    const result = matchRequest("POST", "/api/test", {}, null, [c]);
    expect(result.matched).toBe(false);
  });
});

describe("matches (regex) body patterns", () => {
  it("should_match_simple_regex_against_raw_body", () => {
    const c = contract({
      bodyPatterns: [{ matches: ".*iPhone.*" }],
    });
    const rawBody = '{"product":"iPhone 16"}';
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_when_regex_fails", () => {
    const c = contract({
      bodyPatterns: [{ matches: ".*iPhone.*" }],
    });
    const rawBody = '{"product":"MacBook"}';
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(false);
  });

  it("should_match_multipart_regex_pattern", () => {
    // SCC generates these regex patterns for multipart requests
    const multipartRegex =
      '.*--(.*)\r?\nContent-Disposition: form-data; name="file"; filename=".+"' +
      "\r?\n(Content-Type: .*\r?\n)?(Content-Transfer-Encoding: .*\r?\n)?" +
      "(Content-Length: \\d+\r?\n)?\r?\n.+\r?\n--.*";

    const c = contract({
      bodyPatterns: [{ matches: multipartRegex }],
    });

    const rawBody =
      "------WebKitBoundary\r\n" +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
      "Content-Type: text/plain\r\n" +
      "\r\n" +
      "file content here\r\n" +
      "------WebKitBoundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });

  it("should_match_multipart_param_regex_pattern", () => {
    const paramRegex =
      '.*--(.*)\r?\nContent-Disposition: form-data; name="name"\r?\n' +
      "(Content-Type: .*\r?\n)?(Content-Transfer-Encoding: .*\r?\n)?" +
      "(Content-Length: \\d+\r?\n)?\r?\nfileName.md\r?\n--.*";

    const c = contract({
      bodyPatterns: [{ matches: paramRegex }],
    });

    const rawBody =
      "------WebKitBoundary\r\n" +
      'Content-Disposition: form-data; name="name"\r\n' +
      "\r\n" +
      "fileName.md\r\n" +
      "------WebKitBoundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });

  it("should_require_all_multipart_patterns_to_match", () => {
    const fileRegex =
      '.*--(.*)\r?\nContent-Disposition: form-data; name="file"; filename=".+"' +
      "\r?\n(Content-Type: .*\r?\n)?\r?\n.+\r?\n--.*";
    const paramRegex =
      '.*--(.*)\r?\nContent-Disposition: form-data; name="name"\r?\n' + "\r?\nfileName.md\r?\n--.*";

    const c = contract({
      bodyPatterns: [{ matches: fileRegex }, { matches: paramRegex }],
    });

    const rawBody =
      "------Boundary\r\n" +
      'Content-Disposition: form-data; name="name"\r\n' +
      "\r\n" +
      "fileName.md\r\n" +
      "------Boundary\r\n" +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
      "Content-Type: text/plain\r\n" +
      "\r\n" +
      "file content\r\n" +
      "------Boundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });

  it("should_use_json_stringify_when_no_raw_body", () => {
    const c = contract({
      bodyPatterns: [{ matches: '.*"product".*' }],
    });
    const body = { product: "iPhone" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });
});

describe("matchesJsonPath regex (=~) patterns (SCC-generated)", () => {
  it("should_match_regex_filter_with_bracket_notation", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['duck'] =~ /([0-9]{3})/)]" }],
    });
    const body = { duck: "123" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_regex_filter_when_value_doesnt_match", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['duck'] =~ /([0-9]{3})/)]" }],
    });
    const body = { duck: "ab" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_match_email_regex_pattern", () => {
    const c = contract({
      bodyPatterns: [
        {
          matchesJsonPath:
            "$[?(@.['email'] =~ /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6})?/)]",
        },
      ],
    });
    const body = { email: "user@example.com" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_regex_filter_with_dot_notation", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.alpha =~ /([a-zA-Z]*)/)]" }],
    });
    const body = { alpha: "HelloWorld" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_numeric_field_against_regex", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.count =~ /[0-9]+/)]" }],
    });
    const body = { count: 42 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });
});

describe("matchesJsonPath size() constraints (SCC-generated)", () => {
  it("should_match_size_gte_constraint", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.items.size() >= 1)]" }],
    });
    const body = { items: ["a", "b"] };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_size_gte_when_array_too_small", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.items.size() >= 3)]" }],
    });
    const body = { items: ["a", "b"] };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_match_size_lte_constraint", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.items.size() <= 3)]" }],
    });
    const body = { items: ["a"] };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_size_when_field_is_not_array", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.name.size() >= 1)]" }],
    });
    const body = { name: "not an array" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_match_empty_array_with_size_gte_0", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.items.size() >= 0)]" }],
    });
    const body = { items: [] };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });
});

describe("mixed body patterns", () => {
  it("should_match_equalToJson_and_matchesJsonPath_together", () => {
    const c = contract({
      bodyPatterns: [
        { equalToJson: '{"product":"iPhone 16","amount":999.99}' },
        { matchesJsonPath: "$[?(@.['product'] == 'iPhone 16')]" },
      ],
    });
    const body = { product: "iPhone 16", amount: 999.99 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_fail_when_equalToJson_matches_but_jsonpath_fails", () => {
    const c = contract({
      bodyPatterns: [
        { equalToJson: '{"product":"iPhone 16","amount":999.99}' },
        { matchesJsonPath: "$[?(@.['amount'] == 1299.99)]" },
      ],
    });
    const body = { product: "iPhone 16", amount: 999.99 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(false);
  });
});
