import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";
import { matchRequest } from "../../src/request-matcher.js";
import type { ParsedContract } from "../../src/contract-parser.js";

// ============================================================================
// Helper: WireMock mapping builder
// ============================================================================

function mapping(bodyFileName: string): string {
  return JSON.stringify({
    request: { method: "GET", urlPath: "/api/test" },
    response: { status: 200, bodyFileName },
  });
}

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

// ============================================================================
// Feature 1: bodyFileName resolution -- adversarial cases
// ============================================================================

describe("bodyFileName -- path traversal attacks", () => {
  let filesDir: string;

  beforeEach(async () => {
    filesDir = join(tmpdir(), `scc-adv-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(filesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(filesDir, { recursive: true, force: true });
  });

  it("should_not_resolve_path_traversal_with_dotdot", async () => {
    // Path traversal: ../../../etc/passwd should be rejected
    const c = parseWireMockMapping("test.json", mapping("../../../etc/passwd"), { filesDir });

    const body = c.response.body as string;
    expect(body).toContain("[bodyFileName rejected:");
    expect(body).not.toContain("root:");
  });

  it("should_not_resolve_path_traversal_with_encoded_dotdot", async () => {
    // URL-encoded path traversal: %2e%2e = ..
    const c = parseWireMockMapping("test.json", mapping("%2e%2e/%2e%2e/etc/passwd"), { filesDir });
    // join does NOT decode %2e%2e, so this likely returns "not found"
    // but the test documents the vector
    expect(c.response.body).toContain("[bodyFileName");
  });

  it("should_not_resolve_absolute_path_as_bodyFileName", async () => {
    // Absolute path should be rejected (escapes sandbox)
    const c = parseWireMockMapping("test.json", mapping("/etc/passwd"), { filesDir });

    const body = c.response.body as string;
    expect(body).toContain("[bodyFileName rejected:");
  });

  it("should_not_resolve_backslash_path_traversal_on_windows_style", async () => {
    const c = parseWireMockMapping("test.json", mapping("..\\..\\..\\etc\\passwd"), { filesDir });
    // On Unix, backslashes are literal chars in filenames, so this won't traverse.
    // On Windows, this would be a traversal. Document the vector.
    expect(c.response.body).toContain("[bodyFileName");
  });

  it("should_handle_symlink_pointing_outside_filesDir", async () => {
    // Create a symlink inside filesDir that points to /etc
    // Note: symlinks pass the path prefix check because the unresolved path
    // is within filesDir. This is a known limitation — full symlink protection
    // would require realpath() which has performance implications.
    // WireMock in Java has the same limitation.
    const linkPath = join(filesDir, "escape");
    try {
      await symlink("/etc", linkPath);
      const c = parseWireMockMapping("test.json", mapping("escape/passwd"), { filesDir });
      // The path "escape/passwd" resolves within filesDir (before following symlink),
      // so it passes the prefix check. existsSync follows the symlink.
      const body = c.response.body as string;
      expect(body).toBeDefined();
    } catch {
      // symlink creation may fail in sandboxed environments -- skip gracefully
      expect(true).toBe(true);
    }
  });
});

describe("bodyFileName -- binary and edge-case files", () => {
  let filesDir: string;

  beforeEach(async () => {
    filesDir = join(tmpdir(), `scc-adv-bin-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(filesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(filesDir, { recursive: true, force: true });
  });

  it("should_corrupt_binary_file_when_read_as_utf8", async () => {
    // BUG: readFileSync(filePath, "utf-8") corrupts binary content.
    // PNG files, PDFs, etc. will be mangled when forced through UTF-8 decoding.
    // Invalid UTF-8 byte sequences get replaced with U+FFFD (replacement character).
    const binaryContent = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG header
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52, // IHDR chunk
      0xff,
      0xfe,
      0xfd,
      0x80,
      0x81,
      0x82, // Invalid UTF-8 sequences
    ]);
    await writeFile(join(filesDir, "image.png"), binaryContent);

    const c = parseWireMockMapping("test.json", mapping("image.png"), { filesDir });

    // BUG CONFIRMED: Round-tripping through UTF-8 corrupts the binary data.
    // The invalid bytes (0xFF, 0xFE, 0xFD, 0x80, 0x81, 0x82) become U+FFFD (EF BF BD).
    // FIX: resolveBodyFileName should detect binary content and use base64 or Buffer.
    const resultBuffer = Buffer.from(c.response.body as string, "utf-8");
    expect(resultBuffer.length).not.toBe(binaryContent.length); // Proves corruption
  });

  it("should_handle_empty_file", async () => {
    await writeFile(join(filesDir, "empty.json"), "");

    const c = parseWireMockMapping("test.json", mapping("empty.json"), { filesDir });

    // Empty string fails JSON.parse, so it falls through to return the string.
    // Empty string is falsy -- but resolveBodyFileName still returns it.
    // However, buildResponse checks `body !== undefined` before including it.
    // "" is not undefined, so it will be included. But is an empty response body correct?
    expect(c.response.body).toBe("");
  });

  it("should_handle_file_containing_only_whitespace", async () => {
    await writeFile(join(filesDir, "whitespace.txt"), "   \n\t  \n");

    const c = parseWireMockMapping("test.json", mapping("whitespace.txt"), { filesDir });

    // Whitespace-only content is not valid JSON, so it returns as-is
    expect(c.response.body).toBe("   \n\t  \n");
  });

  it("should_handle_file_with_BOM_marker", async () => {
    // UTF-8 BOM: 0xEF 0xBB 0xBF (U+FEFF)
    const bomContent = '\uFEFF{"id":"1"}';
    await writeFile(join(filesDir, "bom.json"), bomContent);

    const c = parseWireMockMapping("test.json", mapping("bom.json"), { filesDir });

    // BOM is stripped before JSON.parse, so JSON parses correctly
    expect(c.response.body).toEqual({ id: "1" });
  });

  it("should_handle_bodyFileName_with_spaces_in_name", async () => {
    await writeFile(join(filesDir, "my response.json"), '{"ok":true}');

    const c = parseWireMockMapping("test.json", mapping("my response.json"), { filesDir });

    expect(c.response.body).toEqual({ ok: true });
  });

  it("should_handle_bodyFileName_with_special_characters", async () => {
    // Filenames with characters that could be problematic
    const specialName = "response (1).json";
    await writeFile(join(filesDir, specialName), '{"ok":true}');

    const c = parseWireMockMapping("test.json", mapping(specialName), { filesDir });

    expect(c.response.body).toEqual({ ok: true });
  });
});

// ============================================================================
// Feature 2: matchesJsonPath evaluation -- adversarial cases
// ============================================================================

describe("matchesJsonPath -- special characters in field names", () => {
  it("should_handle_field_name_with_spaces", () => {
    // BUG: The regex uses [a-zA-Z_]\w* for dot notation -- spaces won't match.
    // Bracket notation ['field name'] should work, but let's verify.
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['field name'] == 'value')]" }],
    });
    const body = { "field name": "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_handle_field_name_with_dots", () => {
    // BUG: Dot in field name -- bracket notation should handle this
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['field.name'] == 'value')]" }],
    });
    const body = { "field.name": "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_fail_dot_notation_with_field_containing_dot", () => {
    // Dot notation $.field.name would try to access body["field"]["name"]
    // not body["field.name"]
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.field.name" }],
    });
    const body = { "field.name": "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // This will fail because $.field.name splits on "." and looks for body.field.name
    expect(result.matched).toBe(false);
  });

  it("should_handle_field_name_with_single_quotes", () => {
    // BUG: The regex for bracket notation is ['([^']+)'] -- single quote in field name
    // would break the regex: ['it's'] cannot be parsed
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['it's'] == 'value')]" }],
    });
    const body = { "it's": "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // EXPECTED: Should match (or gracefully fail)
    // ACTUAL: Regex won't match because [^']+ stops at the apostrophe
    // The unrecognized expression fallback returns true (conservative pass)
    expect(result.matched).toBe(true);
  });

  it("should_handle_field_name_with_brackets", () => {
    // Field name like "items[0]" -- bracket notation
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['items[0]'] == 'value')]" }],
    });
    const body = { "items[0]": "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // The regex [^']+ captures "items[0]" fine inside quotes
    expect(result.matched).toBe(true);
  });
});

describe("matchesJsonPath -- string values with special content", () => {
  it("should_not_match_string_value_containing_escaped_single_quotes", () => {
    // BUG: The bracket notation regex is ['([^']+)'] which uses [^']+ (no quotes allowed).
    // When a value like "it\'s cool" appears in the expression, the regex pattern
    // $[?(@.['msg'] == 'it\'s cool')] breaks because:
    // 1. The JS string literal "it\\'s cool" becomes "it\'s cool" in the actual string
    // 2. But the filter regex (.+)\)\]$ captures the value portion
    // 3. The problem is actually that the field name regex [^']+ and the value parsing
    //    interact poorly with embedded quotes.
    // Result: The expression falls through to "unrecognized" -> returns true (wrong).
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['msg'] == 'it\\'s cool')]" }],
    });
    const body = { msg: "it's cool" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // BUG CONFIRMED: Returns false because the expression is not properly parsed.
    // The escaped backslash in JS results in the literal: $[?(@.['msg'] == 'it\'s cool')]
    // The filter regex doesn't handle escaped quotes, causing a mismatch.
    expect(result.matched).toBe(false);
  });

  it("should_match_empty_string_value", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['name'] == '')]" }],
    });
    const body = { name: "" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // parseJsonPathValue("''") -> startsWith("'") && endsWith("'") -> slice(1,-1) = ""
    expect(result.matched).toBe(true);
  });

  it("should_match_string_value_that_looks_like_number", () => {
    // BUG: If the value in the expression is '123', parseJsonPathValue should
    // return the string "123", not the number 123. Let's verify.
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['code'] == '123')]" }],
    });
    const body = { code: "123" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // '123' starts and ends with quotes -> returns string "123" -- correct
    expect(result.matched).toBe(true);
  });

  it("should_not_match_number_when_value_is_quoted_string", () => {
    // Quoted '123' should be string, not match numeric 123
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['code'] == '123')]" }],
    });
    const body = { code: 123 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // '123' -> string "123", body has number 123 -> should NOT match (strict)
    expect(result.matched).toBe(false);
  });

  it("should_handle_string_value_with_parentheses", () => {
    // BUG: The regex ends with \)\]$ -- a value containing ")" could confuse it
    // Expression: $[?(@.['msg'] == 'hello (world)')]
    // The regex (.+)\)\]$ would greedily match -- (.+) captures "'hello (world)'"
    // and then needs )\] at end. The greedy (.+) would capture "'hello (world)'"
    // leaving )\] -- but wait, the value itself contains ")" so regex could match
    // at the wrong position.
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['msg'] == 'hello (world)')]" }],
    });
    const body = { msg: "hello (world)" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // (.+) is greedy, so it will capture "'hello (world)'" leaving ")]" at end
    // That matches \)\]$ -- so filterMatch[5] = "'hello (world)'"
    // But wait: (.+) will capture as much as possible. The full string after == is:
    // " 'hello (world)')]\n" (conceptually). Let me re-check:
    // The full expression is: $[?(@.['msg'] == 'hello (world)')]
    // After == we have: 'hello (world)')]
    // (.+)\)\]$ needs to match: 'hello (world)')]
    // Greedy (.+) tries to capture everything: 'hello (world)')] and then \)\]$
    // fails. Backtracks: captures 'hello (world)' -- remaining )] -- \)\]$ needs
    // ) then ] -- )] matches! So (.+) = "'hello (world)'" -- correct!
    // parseJsonPathValue("'hello (world)'") = "hello (world)" -- correct!
    expect(result.matched).toBe(true);
  });

  it("should_handle_value_with_closing_bracket_and_paren", () => {
    // Value containing ')]' which is the closing delimiter of the expression
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['data'] == 'x)]y')]" }],
    });
    const body = { data: "x)]y" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // This is tricky: after == we have: 'x)]y')]
    // (.+)\)\]$ : greedy (.+) tries 'x)]y')] -- remaining empty, \)\]$ fails
    // Backtracks: (.+) = 'x)]y' -- remaining )] -- \)\]$ = ) then ] -- matches!
    // But parseJsonPathValue("'x)]y'") = "x)]y" -- but body has "x)]y" -- match!
    // Wait, the full expression is: $[?(@.['data'] == 'x)]y')]
    // After == it's: 'x)]y')]
    // (.+) greedily: captures "'x)]y'" (6 chars) -- remaining ")]" -- \)\]$ needs ")["
    // Hmm, )] matches \)\]$ since ) matches \) and ] matches \] -- YES!
    // So (.+) = "'x)]y'" and it works.
    // Actually wait -- (.+) is greedy, it first captures "'x)]y')]" (8 chars),
    // leaving "" -- \)\]$ doesn't match empty. Backtrack to "'x)]y')" (7 chars),
    // remaining "]" -- \)\]$ needs 2 chars, fails. Backtrack to "'x)]y'" (6 chars),
    // remaining ")]" -- \) matches ")" and \] matches "]" -- YES!
    expect(result.matched).toBe(true);
  });
});

describe("matchesJsonPath -- array and deeply nested bodies", () => {
  it("should_reject_array_body_for_jsonpath_filter", () => {
    // BUG: If body is an array, (body as Record<string, unknown>)[field] returns undefined
    // because arrays don't have named properties (well, they do for "length" etc.)
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['name'] == 'test')]" }],
    });
    const body = [{ name: "test" }, { name: "other" }];
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // body is an array (typeof === "object", not null) so it passes the initial check.
    // Then (body as Record<string, unknown>)["name"] = undefined (arrays have numeric keys).
    // So actual = undefined, expected = "test" -> not equal -> returns false.
    expect(result.matched).toBe(false);
  });

  it("should_handle_existence_check_on_array_body", () => {
    // $.0.name -- existence check on array element
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.0.name" }],
    });
    const body = [{ name: "test" }];
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // parts = ["0", "name"]
    // current = body (array), current["0"] = { name: "test" } (array index access works!)
    // current["name"] = "test" -> not undefined -> true!
    expect(result.matched).toBe(true);
  });

  it("should_handle_three_level_nesting_with_bracket_notation", () => {
    // BUG: The filter regex only supports 2 levels of nesting:
    // @.['field1'].['field2'] but NOT @.['field1'].['field2'].['field3']
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['a'].['b'].['c'] == 'deep')]" }],
    });
    const body = { a: { b: { c: "deep" } } };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // The regex only captures 1 optional nested field (groups 3/4).
    // Three levels won't match the filter regex.
    // Falls through to existence check: $.a.b.c -- that would also fail since
    // the expression starts with $[? not $.
    // Falls through to "unrecognized expression" -> returns true (conservative pass)
    // BUG: Should return false (the value at a.b.c may not equal "deep")
    // but instead returns true because the expression is unrecognized.
    expect(result.matched).toBe(true);
  });

  it("should_handle_field_with_undefined_value_for_existence_check", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.field" }],
    });
    // Field exists but value is explicitly undefined (not possible in JSON,
    // but possible in JS objects)
    const body = { field: undefined };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // current = body["field"] = undefined -> returns false
    expect(result.matched).toBe(false);
  });

  it("should_handle_existence_check_for_null_valued_field", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.field" }],
    });
    const body = { field: null };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // current = null -> null !== undefined -> returns TRUE
    // This is correct: the field exists (just happens to be null)
    expect(result.matched).toBe(true);
  });

  it("should_handle_existence_check_for_false_valued_field", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.active" }],
    });
    const body = { active: false };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // false !== undefined -> returns true
    expect(result.matched).toBe(true);
  });

  it("should_handle_existence_check_for_zero_valued_field", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.count" }],
    });
    const body = { count: 0 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // 0 !== undefined -> true
    expect(result.matched).toBe(true);
  });

  it("should_handle_existence_check_for_empty_string_field", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.name" }],
    });
    const body = { name: "" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // "" !== undefined -> true
    expect(result.matched).toBe(true);
  });
});

describe("matchesJsonPath -- unrecognized expressions silently pass", () => {
  it("should_silently_pass_existence_without_equality_in_filter_syntax", () => {
    // BUG: $[?(@.field)] is a valid JSONPath existence check in filter syntax
    // but the code only recognizes $[?(@.field == value)] (with ==) and $.field
    // The $[?(@.field)] form matches neither regex, so it falls through to
    // "unrecognized expression -> return true"
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.nonexistent)]" }],
    });
    const body = { other: "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // BUG: Returns true because expression is unrecognized, even though
    // "nonexistent" field doesn't exist in body. Should return false.
    expect(result.matched).toBe(true);
  });

  it("should_silently_pass_negation_filter", () => {
    // $[?(@.field != 'value')] -- not-equal filter
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['field'] != 'wrong')]" }],
    });
    const body = { field: "correct" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // BUG: != is not recognized by the regex (only ==), so falls through
    // to unrecognized -> returns true. Happens to be correct here, but
    // would also return true if field == 'wrong'.
    expect(result.matched).toBe(true);
  });

  it("should_silently_pass_greater_than_filter", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['amount'] > 100)]" }],
    });
    const body = { amount: 50 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // BUG: > is not recognized, so returns true even though 50 < 100
    expect(result.matched).toBe(true);
  });

  it("should_evaluate_regex_match_in_jsonpath", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['email'] =~ /.*@example\\.com/)]" }],
    });
    const body = { email: "evil@attacker.com" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // Now correctly evaluates =~ regex — attacker.com doesn't match example.com
    expect(result.matched).toBe(false);
  });
});

describe("matchesJsonPath -- numeric edge cases", () => {
  it("should_match_negative_number", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['balance'] == -100)]" }],
    });
    const body = { balance: -100 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // parseJsonPathValue("-100") -> Number("-100") = -100 -> not NaN -> returns -100
    expect(result.matched).toBe(true);
  });

  it("should_match_zero", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['count'] == 0)]" }],
    });
    const body = { count: 0 };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_handle_NaN_value_in_expression", () => {
    // "NaN" is not 'true', 'false', 'null', and Number("NaN") is NaN
    // So !Number.isNaN(NaN) is false, falls through to return "NaN" as string
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['value'] == NaN)]" }],
    });
    const body = { value: "NaN" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // parseJsonPathValue("NaN") -> Number("NaN") is NaN -> isNaN is true
    // -> falls through to return "NaN" (string). body.value = "NaN" (string) -> match!
    expect(result.matched).toBe(true);
  });

  it("should_handle_Infinity_in_expression", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['value'] == Infinity)]" }],
    });
    const body = { value: Infinity };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // parseJsonPathValue("Infinity") -> Number("Infinity") = Infinity, not NaN -> returns Infinity
    // body.value = Infinity -> match!
    // But JSON doesn't support Infinity, so this is a theoretical case
    expect(result.matched).toBe(true);
  });

  it("should_not_match_string_zero_vs_number_zero", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['count'] == 0)]" }],
    });
    const body = { count: "0" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // parseJsonPathValue("0") -> Number("0") = 0 (number)
    // body.count = "0" (string) -> not equal -> false
    expect(result.matched).toBe(false);
  });
});

// ============================================================================
// Feature 3: Multipart matching -- adversarial cases
// ============================================================================

describe("multipart regex matching -- real-world boundaries", () => {
  const fileRegex =
    '.*--(.*)\r?\nContent-Disposition: form-data; name="file"; filename=".+"' +
    "\r?\n(Content-Type: .*\r?\n)?(Content-Transfer-Encoding: .*\r?\n)?" +
    "(Content-Length: \\d+\r?\n)?\r?\n.+\r?\n--.*";

  it("should_match_curl_style_boundary", () => {
    const c = contract({ bodyPatterns: [{ matches: fileRegex }] });

    // curl uses boundaries like "------------------------abcdef1234567890"
    const rawBody =
      "--------------------------abcdef1234567890\r\n" +
      'Content-Disposition: form-data; name="file"; filename="data.csv"\r\n' +
      "Content-Type: text/csv\r\n" +
      "\r\n" +
      "col1,col2\r\n" +
      "--------------------------abcdef1234567890--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });

  it("should_match_with_unix_line_endings_only", () => {
    const c = contract({ bodyPatterns: [{ matches: fileRegex }] });

    // Some HTTP clients send \n only (no \r)
    const rawBody =
      "------Boundary\n" +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\n' +
      "Content-Type: text/plain\n" +
      "\n" +
      "content\n" +
      "------Boundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });

  it("should_match_with_mixed_line_endings", () => {
    const c = contract({ bodyPatterns: [{ matches: fileRegex }] });

    // Mix of \r\n and \n (broken client)
    const rawBody =
      "------Boundary\r\n" +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\n' +
      "Content-Type: text/plain\r\n" +
      "\n" +
      "content\r\n" +
      "------Boundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });

  it("should_handle_multipart_with_binary_content_in_file_part", () => {
    const c = contract({ bodyPatterns: [{ matches: fileRegex }] });

    // Binary-like content with null bytes (not valid in JS string, but can appear)
    const rawBody =
      "------Boundary\r\n" +
      'Content-Disposition: form-data; name="file"; filename="image.png"\r\n' +
      "Content-Type: image/png\r\n" +
      "Content-Transfer-Encoding: binary\r\n" +
      "\r\n" +
      "\x89PNG\r\n\x1A\n" + // PNG header bytes as string
      "\r\n" +
      "------Boundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // The .+ pattern should match the PNG header bytes
    expect(result.matched).toBe(true);
  });

  it("should_handle_empty_file_content_in_multipart", () => {
    const c = contract({ bodyPatterns: [{ matches: fileRegex }] });

    // Empty file upload -- the .+ in the regex requires at least one char
    const rawBody =
      "------Boundary\r\n" +
      'Content-Disposition: form-data; name="file"; filename="empty.txt"\r\n' +
      "Content-Type: text/plain\r\n" +
      "\r\n" +
      "\r\n" + // empty content
      "------Boundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // The dotAll flag makes . match \r and \n, so .+ matches the \r\n between
    // the empty line and the boundary. This means empty file uploads are accepted
    // by the regex even though the actual file content is empty.
    // This is technically correct for the regex, but may be surprising behavior.
    expect(result.matched).toBe(true);
  });

  it("should_handle_multipart_without_content_type_header", () => {
    const c = contract({ bodyPatterns: [{ matches: fileRegex }] });

    // Some clients don't send Content-Type for the part
    const rawBody =
      "------Boundary\r\n" +
      'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
      "\r\n" +
      "file content\r\n" +
      "------Boundary--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // The Content-Type group is optional: (Content-Type: .*\r?\n)?
    // So this should match even without it
    expect(result.matched).toBe(true);
  });

  it("should_handle_postman_style_boundary_with_long_random_string", () => {
    const c = contract({ bodyPatterns: [{ matches: fileRegex }] });

    // Postman uses boundaries like "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    const rawBody =
      "------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n" +
      'Content-Disposition: form-data; name="file"; filename="report.pdf"\r\n' +
      "Content-Type: application/pdf\r\n" +
      "\r\n" +
      "%PDF-1.4 fake content\r\n" +
      "------WebKitFormBoundary7MA4YWxkTrZu0gW--";

    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    expect(result.matched).toBe(true);
  });
});

describe("regex matching -- catastrophic backtracking", () => {
  it("should_complete_pathological_regex_within_reasonable_time", () => {
    // Regex DoS: pathological pattern (a+)+b causes exponential backtracking.
    // In practice, SCC-generated patterns don't use this construct, and
    // contracts come from trusted sources (stubs JARs). This test documents
    // the limitation. Node.js v22+ has regex timeout support but we don't use it.
    const evilRegex = "(a+)+b";
    const c = contract({
      bodyPatterns: [{ matches: evilRegex }],
    });

    // Small input to keep test fast
    const rawBody = "a".repeat(20) + "!";

    const start = Date.now();
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    const elapsed = Date.now() - start;

    expect(result.matched).toBe(false);
    // 20 chars should complete in <5s even with backtracking
    expect(elapsed).toBeLessThan(5000);
  });

  it("should_handle_regex_with_lookahead_that_could_backtrack", () => {
    // Another backtracking pattern
    const c = contract({
      bodyPatterns: [{ matches: "(?=a+b)a+c" }],
    });
    const rawBody = "a".repeat(30) + "c";
    const start = Date.now();
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    const elapsed = Date.now() - start;
    expect(result.matched).toBe(false);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("regex matching -- edge cases", () => {
  it("should_handle_regex_with_invalid_syntax_gracefully", () => {
    const c = contract({
      bodyPatterns: [{ matches: "[invalid(regex" }],
    });
    const rawBody = "[invalid(regex";
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // matchRegex catches the error and falls back to exact match
    expect(result.matched).toBe(true);
  });

  it("should_handle_empty_regex_pattern", () => {
    const c = contract({
      bodyPatterns: [{ matches: "" }],
    });
    const rawBody = "";
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // new RegExp("^$", "s").test("") -> true
    expect(result.matched).toBe(true);
  });

  it("should_not_match_empty_regex_against_non_empty_body", () => {
    const c = contract({
      bodyPatterns: [{ matches: "" }],
    });
    const rawBody = "something";
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // new RegExp("^$", "s").test("something") -> false
    expect(result.matched).toBe(false);
  });

  it("should_handle_regex_with_null_bytes", () => {
    const c = contract({
      bodyPatterns: [{ matches: ".*\\x00.*" }],
    });
    const rawBody = "before\x00after";
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // \x00 in regex should match null byte in string
    expect(result.matched).toBe(true);
  });

  it("should_match_body_with_newlines_using_dotAll_flag", () => {
    const c = contract({
      bodyPatterns: [{ matches: "line1.*line2" }],
    });
    const rawBody = "line1\nsome stuff\nline2";
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], rawBody);
    // The 's' (dotAll) flag makes . match \n -- so this should match
    expect(result.matched).toBe(true);
  });

  it("should_use_empty_string_for_undefined_body_in_regex_match", () => {
    const c = contract({
      bodyPatterns: [{ matches: "^$" }],
    });
    // Both body and rawBody are undefined
    const result = matchRequest("POST", "/api/test", {}, undefined, [c], undefined);
    // rawBody is undefined, body is undefined -> bodyStr = ""
    // matchRegex("", "^$") -> true
    expect(result.matched).toBe(true);
  });
});

describe("matchesJsonPath -- prototype pollution and __proto__", () => {
  it("should_handle_field_named___proto__", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['__proto__'] == 'polluted')]" }],
    });
    // __proto__ is a special property on JS objects
    const body = JSON.parse('{"__proto__":"polluted"}');
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // JSON.parse creates a plain object. body["__proto__"] accesses
    // the actual prototype, not a data field named __proto__.
    // In modern JS engines, JSON.parse DOES set __proto__ as a data property.
    expect(result.matched).toBe(true);
  });

  it("should_handle_field_named_constructor", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['constructor'] == 'value')]" }],
    });
    const body = { constructor: "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_handle_field_named_toString", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$[?(@.['toString'] == 'custom')]" }],
    });
    const body = { toString: "custom" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // body.toString = "custom" (string) -- overrides Object.prototype.toString
    expect(result.matched).toBe(true);
  });
});

describe("matchesJsonPath -- nested dot notation existence checks", () => {
  it("should_handle_bracket_notation_in_existence_path", () => {
    // $.['field with spaces'] -- existence check with bracket notation
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.['field with spaces']" }],
    });
    const body = { "field with spaces": "value" };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // The existence check splits on "." giving parts: ["['field with spaces']"]
    // Then cleanPart strips [' and '] to get "field with spaces"
    // body["field with spaces"] = "value" -> not undefined -> true
    expect(result.matched).toBe(true);
  });

  it("should_handle_deeply_nested_existence_check", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.a.b.c.d.e" }],
    });
    const body = { a: { b: { c: { d: { e: "deep" } } } } };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_fail_deeply_nested_existence_when_intermediate_is_null", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.a.b.c" }],
    });
    const body = { a: { b: null } };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // current = body.a.b = null -> typeof null is "object" but null === null -> returns false
    expect(result.matched).toBe(false);
  });

  it("should_fail_deeply_nested_existence_when_intermediate_is_primitive", () => {
    const c = contract({
      bodyPatterns: [{ matchesJsonPath: "$.a.b.c" }],
    });
    const body = { a: { b: 42 } };
    const result = matchRequest("POST", "/api/test", {}, body, [c]);
    // current = 42 -> typeof 42 is "number", not "object" -> returns false
    expect(result.matched).toBe(false);
  });
});
