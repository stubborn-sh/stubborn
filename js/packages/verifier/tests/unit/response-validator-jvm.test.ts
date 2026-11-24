import { describe, it, expect, vi } from "vitest";
import { parseContracts, type ParsedContract } from "@stubborn-sh/stub-server";
import { validateResponse, type ValidationOptions } from "../../src/response-validator.js";
import type { ExecutionResult } from "../../src/request-executor.js";

/**
 * Response validation as the JVM-generated contract test does it. Expected outcomes follow the
 * generator (stubborn-contract-generator: JsonBodyVerificationBuilder, BodyMethodGeneration,
 * RestAssuredHeadersThen, RestAssuredCookiesThen) and the assertion libraries it emits calls to
 * (jsonassert's JsonAsserter, the verifier's CollectionAssert).
 */

function contractFrom(
  yaml: string,
  files: Record<string, string | Uint8Array> = {},
): ParsedContract {
  const [contract] = parseContracts("contract.yml", yaml, {
    readFile: (path) => {
      const content = files[path];
      return typeof content === "string" ? new TextEncoder().encode(content) : content;
    },
  });
  if (contract === undefined) throw new Error("no contract");
  return contract;
}

function json(body: unknown, extra: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body,
    bodyText: JSON.stringify(body),
    ...extra,
  };
}

function text(body: string, extra: Partial<ExecutionResult> = {}): ExecutionResult {
  return { status: 200, headers: { "content-type": "text/plain" }, body, bodyText: body, ...extra };
}

function check(
  contract: ParsedContract,
  actual: ExecutionResult,
  options?: ValidationOptions,
): { valid: boolean; fields: string[]; actuals: string[] } {
  const result = validateResponse(contract, actual, options);
  return {
    valid: result.valid,
    fields: result.failures.map((f) => f.field),
    actuals: result.failures.map((f) => f.actual),
  };
}

const withMatchers = (body: string, matchers: string): ParsedContract =>
  contractFrom(`
request: { method: GET, url: /x }
response:
  status: 200
  headers: { Content-Type: application/json }
  body:
${body}
  matchers:
    body:
${matchers}
`);

describe("validateResponse: JSON body, field by field", () => {
  const user = contractFrom(`
request: { method: GET, url: /users/1 }
response:
  status: 200
  headers: { Content-Type: application/json }
  body: { id: 1, name: Alice }
`);

  it("should_accept_extra_response_fields_as_the_jvm_asserts_each_contract_field", () => {
    // assertThatJson(parsedJson).field("['id']").isEqualTo(1) — nothing about other fields.
    expect(check(user, json({ id: 1, name: "Alice", email: "a@b.c" })).valid).toBe(true);
  });

  it("should_fail_on_a_differing_field_and_name_its_path", () => {
    const result = check(user, json({ id: 1, name: "Bob" }));
    expect(result.valid).toBe(false);
    expect(result.fields).toEqual(["body$.['name']"]);
    expect(result.actuals).toEqual(['"Bob"']);
  });

  it("should_fail_on_a_missing_field", () => {
    expect(check(user, json({ id: 1 })).fields).toEqual(["body$.['name']"]);
  });

  it("should_compare_numbers_and_strings_as_jayway_does", () => {
    // Jayway `@.['id'] == 1` also selects "1"; 1.0 equals 1.
    expect(check(user, json({ id: "1", name: "Alice" })).valid).toBe(true);
    expect(check(user, json({ id: 1.0, name: "Alice" })).valid).toBe(true);
  });

  it("should_not_equate_a_boolean_with_its_text", () => {
    const flag = contractFrom(`
request: { method: GET, url: /f }
response: { status: 200, body: { ok: true } }
`);
    expect(check(flag, json({ ok: "true" })).valid).toBe(false);
  });

  it("should_match_array_elements_regardless_of_order", () => {
    // array("['items']").contains("['id']").isEqualTo(1) → $.['items'][*][?(@.['id'] == 1)]
    const list = contractFrom(`
request: { method: GET, url: /l }
response: { status: 200, body: { items: [ { id: 1 }, { id: 2 } ] } }
`);
    expect(check(list, json({ items: [{ id: 2 }, { id: 1 }, { id: 3 }] })).valid).toBe(true);
    const missing = check(list, json({ items: [{ id: 1 }, { id: 3 }] }));
    expect(missing.fields).toEqual(["body$.['items'][*].['id']"]);
  });

  it("should_check_each_leaf_on_its_own_inside_arrays", () => {
    // The JVM checks `id` and `n` separately, so they may come from different elements.
    const list = contractFrom(`
request: { method: GET, url: /l }
response: { status: 200, body: { items: [ { id: 1, n: a } ] } }
`);
    const actual = json({
      items: [
        { id: 1, n: "b" },
        { id: 2, n: "a" },
      ],
    });
    expect(check(list, actual).valid).toBe(true);
  });

  it("should_check_a_list_of_primitives_by_containment", () => {
    const tags = contractFrom(`
request: { method: GET, url: /t }
response: { status: 200, body: { tags: [a, b] } }
`);
    expect(check(tags, json({ tags: ["b", "a", "c"] })).valid).toBe(true);
    expect(check(tags, json({ tags: ["a"] })).fields).toEqual(["body$.['tags'][*]"]);
  });

  it("should_require_an_empty_list_or_object_to_be_empty", () => {
    const empty = contractFrom(`
request: { method: GET, url: /e }
response: { status: 200, body: { tags: [], meta: {} } }
`);
    expect(check(empty, json({ tags: [], meta: {} })).valid).toBe(true);
    const result = check(empty, json({ tags: ["x"], meta: { a: 1 } }));
    expect(result.fields).toEqual(["body$.['tags'][*]", "body$.['meta']"]);
    expect(check(empty, json({})).valid).toBe(false);
  });

  it("should_verify_a_json_body_given_as_a_string", () => {
    const stringBody = contractFrom(`
request: { method: GET, url: /s }
response:
  status: 200
  body: '[{"property1": "a"}, {"property2": "b"}]'
`);
    expect(check(stringBody, json([{ property2: "b" }, { property1: "a" }])).valid).toBe(true);
    expect(check(stringBody, json([{ property1: "a" }])).valid).toBe(false);
  });

  it("should_parse_the_response_as_json_whatever_its_content_type", () => {
    // The JVM test always runs JsonPath.parse(response.getBody().asString()).
    const noHeader = contractFrom(`
request: { method: GET, url: /users/1 }
response: { status: 200, body: { id: 1, name: Alice } }
`);
    expect(check(noHeader, text('{"id":1,"name":"Alice"}')).valid).toBe(true);
  });

  it("should_fail_when_the_response_is_not_json", () => {
    const result = check(user, json(undefined, { bodyText: "<html/>" }));
    expect(result.fields).toEqual(["body"]);
    expect(result.valid).toBe(false);
  });

  it("should_compare_a_text_body_exactly", () => {
    const plain = contractFrom(`
request: { method: GET, url: /p }
response:
  status: 200
  headers: { Content-Type: text/plain }
  body: hello
`);
    expect(check(plain, text("hello")).valid).toBe(true);
    expect(check(plain, text("hello!")).valid).toBe(false);
  });

  it("should_not_check_the_body_when_the_contract_has_none", () => {
    const none = contractFrom(`
request: { method: GET, url: /n }
response: { status: 200 }
`);
    expect(check(none, json({ anything: true })).valid).toBe(true);
  });
});

describe("validateResponse: fields covered by body matchers", () => {
  it("should_still_compare_the_fields_no_matcher_covers", () => {
    // JsonPathMatcherUtils.removeMatchingJsonPaths drops only $.id; name stays an equality check.
    const contract = withMatchers(
      "    id: 1\n    name: Alice",
      "      - path: $.id\n        type: by_regex\n        value: '[0-9]+'",
    );
    expect(check(contract, json({ id: 42, name: "Alice" })).valid).toBe(true);
    const result = check(contract, json({ id: 42, name: "Bob" }));
    expect(result.valid).toBe(false);
    expect(result.fields).toEqual(["body$.['name']"]);
  });

  it("should_drop_containers_the_matchers_leave_empty", () => {
    // $.items[*].id removed → items holds only {} → removed too: no isEmpty check on items.
    const contract = withMatchers(
      "    items: [ { id: 1 }, { id: 2 } ]\n    n: 1",
      "      - path: $.items[*].id\n        type: by_regex\n        value: '[0-9]+'",
    );
    expect(check(contract, json({ items: [{ id: 7 }], n: 1 })).valid).toBe(true);
  });

  it("should_skip_the_emptiness_check_when_matchers_cover_the_whole_body", () => {
    const contract = withMatchers("    id: 1", "      - path: $.id\n        type: by_type");
    expect(check(contract, json({ id: 5, more: "x" })).valid).toBe(true);
  });
});

describe("validateResponse: regex matchers", () => {
  const regex = (value: string): ParsedContract =>
    withMatchers("    v: x", `      - path: $.v\n        type: by_regex\n        ${value}`);

  it("should_apply_predefined_uuid_instead_of_matching_anything", () => {
    const contract = regex("predefined: uuid");
    expect(check(contract, json({ v: "123e4567-e89b-12d3-a456-426614174000" })).valid).toBe(true);
    expect(check(contract, json({ v: "not-a-uuid" })).valid).toBe(false);
  });

  it("should_match_uuid_case_sensitively_as_the_generated_test_drops_the_flag", () => {
    // YamlToContracts keeps Pattern.pattern() only; RegexPatterns.UUID's CASE_INSENSITIVE is lost.
    const contract = regex("predefined: uuid");
    expect(check(contract, json({ v: "123E4567-E89B-12D3-A456-426614174000" })).valid).toBe(false);
  });

  it("should_apply_predefined_only_alpha_unicode", () => {
    const contract = regex("predefined: only_alpha_unicode");
    expect(check(contract, json({ v: "Zażółć" })).valid).toBe(true);
    expect(check(contract, json({ v: "1234" })).valid).toBe(false);
  });

  it("should_fail_an_unknown_predefined_name", () => {
    const result = check(regex("predefined: no_such_thing"), json({ v: "x" }));
    expect(result.valid).toBe(false);
    expect(result.actuals[0]).toContain("no_such_thing");
  });

  it("should_match_a_boolean_or_number_by_its_text", () => {
    // parsedJson.read(path, String.class) turns true into "true" before matches().
    expect(check(regex("value: 'true|false'"), json({ v: true })).valid).toBe(true);
    expect(check(regex("value: '[0-9]+'"), json({ v: 42 })).valid).toBe(true);
  });

  it("should_fail_a_regex_on_an_object_list_null_or_missing_value", () => {
    const contract = regex("value: '.*'");
    expect(check(contract, json({ v: { a: 1 } })).valid).toBe(false);
    expect(check(contract, json({ v: null })).valid).toBe(false);
    expect(check(contract, json({})).valid).toBe(false);
  });

  it("should_require_every_element_of_a_wildcard_path_to_match", () => {
    // allElementsMatch: non-empty, no nulls, every element matches.
    const contract = withMatchers(
      "    ids: [ '1' ]",
      "      - path: $.ids[*]\n        type: by_regex\n        value: '[0-9]+'",
    );
    expect(check(contract, json({ ids: ["1", "22"] })).valid).toBe(true);
    expect(check(contract, json({ ids: ["1", "x"] })).valid).toBe(false);
    expect(check(contract, json({ ids: [] })).valid).toBe(false);
    expect(check(contract, json({ ids: ["1", null] })).valid).toBe(false);
  });

  it("should_fail_a_regex_on_a_filter_path_as_the_jvm_reads_it_as_one_string", () => {
    // Not [*]/..: parsedJson.read(path, String.class) of a list is null, so matches() fails.
    const contract = withMatchers(
      "    items: [ { t: a, id: '1' } ]",
      "      - path: \"$.items[?(@.t == 'a')].id\"\n        type: by_regex\n        value: '[0-9]+'",
    );
    const result = check(contract, json({ items: [{ t: "a", id: "1" }] }));
    expect(result.valid).toBe(false);
    expect(result.actuals.join()).toContain("[*] or ..");
  });

  it("should_check_by_date_by_time_and_by_timestamp_with_the_iso_patterns", () => {
    const contract = withMatchers(
      "    d: '2024-01-31'\n    t: '10:00:00'\n    ts: '2024-01-31T10:00:00'",
      [
        "      - path: $.d\n        type: by_date",
        "      - path: $.t\n        type: by_time",
        "      - path: $.ts\n        type: by_timestamp",
      ].join("\n"),
    );
    expect(
      check(contract, json({ d: "2025-12-01", t: "23:59:59", ts: "2025-12-01T00:00:00" })).valid,
    ).toBe(true);
    const bad = check(
      contract,
      json({ d: "2025-13-01", t: "24:00:00", ts: "2025-12-01T00:00:00Z" }),
    );
    expect(bad.fields).toEqual(["body$.d", "body$.t", "body$.ts"]);
  });
});

describe("validateResponse: by_equality, by_type, by_null", () => {
  it("should_read_the_response_value_as_the_contract_value_class_for_by_equality", () => {
    // parsedJson.read(path, String.class) of 1 is "1"; read(path, Integer.class) of "7" is 7.
    const str = withMatchers("    v: '1'", "      - path: $.v\n        type: by_equality");
    expect(check(str, json({ v: 1 })).valid).toBe(true);
    expect(check(str, json({ v: "2" })).valid).toBe(false);
    const num = withMatchers("    v: 7", "      - path: $.v\n        type: by_equality");
    expect(check(num, json({ v: "7" })).valid).toBe(true);
    expect(check(num, json({ v: 8 })).valid).toBe(false);
  });

  it("should_tell_lists_objects_and_scalars_apart_for_by_type", () => {
    const contract = withMatchers("    v: [1]", "      - path: $.v\n        type: by_type");
    expect(check(contract, json({ v: [1, 2, 3] })).valid).toBe(true);
    expect(check(contract, json({ v: { a: 1 } })).valid).toBe(false);
    expect(check(contract, json({ v: "1" })).valid).toBe(false);
    expect(check(contract, json({ v: null })).valid).toBe(false);
  });

  it("should_check_min_and_max_occurrence", () => {
    const contract = withMatchers(
      "    v: [1]",
      "      - path: $.v\n        type: by_type\n        minOccurrence: 1\n        maxOccurrence: 2",
    );
    expect(check(contract, json({ v: [1, 2] })).valid).toBe(true);
    expect(check(contract, json({ v: [] })).valid).toBe(false);
    expect(check(contract, json({ v: [1, 2, 3] })).valid).toBe(false);
  });

  it("should_count_the_flattened_size_on_a_wildcard_path", () => {
    // hasFlattenedSizeLessThanOrEqualTo: nested lists are counted element by element.
    const contract = withMatchers(
      "    v: [ { t: [1] } ]",
      "      - path: $.v[*].t\n        type: by_type\n        maxOccurrence: 3",
    );
    expect(check(contract, json({ v: [{ t: [1, 2] }, { t: [3] }] })).valid).toBe(true);
    expect(check(contract, json({ v: [{ t: [1, 2] }, { t: [3, 4] }] })).valid).toBe(false);
  });

  it("should_check_by_null", () => {
    const contract = withMatchers("    v: null", "      - path: $.v\n        type: by_null");
    expect(check(contract, json({ v: null })).valid).toBe(true);
    expect(check(contract, json({ v: 1 })).valid).toBe(false);
    expect(check(contract, json({})).valid).toBe(false);
  });
});

describe("validateResponse: by_command", () => {
  const contract = withMatchers(
    "    id: 1",
    "      - path: $.id\n        type: by_command\n        value: assertThatIdIsPositive($it)",
  );

  it("should_fail_with_a_clear_message_when_no_handler_is_registered", () => {
    const result = validateResponse(contract, json({ id: 5 }));
    expect(result.valid).toBe(false);
    expect(result.failures[0]?.actual).toContain("assertThatIdIsPositive");
    expect(result.failures[0]?.actual).toContain("commands");
  });

  it("should_call_the_registered_handler_with_the_value_at_the_path", () => {
    const handler = vi.fn((id: unknown) => typeof id === "number" && id > 0);
    const options = { commands: { assertThatIdIsPositive: handler } };
    expect(check(contract, json({ id: 5 }), options).valid).toBe(true);
    expect(handler).toHaveBeenCalledWith(5);
    expect(check(contract, json({ id: -1 }), options).valid).toBe(false);
  });

  it("should_fail_when_the_handler_throws", () => {
    const options = {
      commands: {
        assertThatIdIsPositive: () => {
          throw new Error("boom");
        },
      },
    };
    expect(check(contract, json({ id: 5 }), options).actuals[0]).toContain("boom");
  });
});

describe("validateResponse: whole-body matchers", () => {
  it("should_match_the_whole_body_against_a_path_less_by_regex_matcher", () => {
    const contract = contractFrom(`
request: { method: GET, url: /r }
response:
  status: 200
  body: anything
  matchers:
    body:
      - type: by_regex
        value: '[a-z]+-[0-9]+'
`);
    expect(check(contract, text("order-42")).valid).toBe(true);
    expect(check(contract, text("order")).valid).toBe(false);
  });

  it("should_still_run_path_matchers_next_to_a_whole_body_regex", () => {
    const contract = contractFrom(`
request: { method: GET, url: /r }
response:
  status: 200
  headers: { Content-Type: application/json }
  body: { id: 1 }
  matchers:
    body:
      - type: by_regex
        value: '.*"id".*'
      - path: $.id
        type: by_regex
        value: '[0-9]+'
`);
    expect(check(contract, json({ id: 7 })).valid).toBe(true);
    expect(check(contract, json({ id: "x" })).fields).toEqual(["body$.id"]);
  });

  it("should_report_xpath_matchers_on_an_xml_body_as_unsupported", () => {
    const contract = contractFrom(`
request: { method: GET, url: /x }
response:
  status: 200
  headers: { Content-Type: application/xml }
  body: "<user><id>1</id></user>"
  matchers:
    body:
      - path: /user/id/text()
        type: by_regex
        value: '[0-9]+'
`);
    const result = validateResponse(contract, text("<user><id>2</id></user>"));
    expect(result.valid).toBe(false);
    expect(result.failures.map((f) => f.actual).join()).toContain("XPath");
  });
});

describe("validateResponse: headers", () => {
  const headers = (matchers: string): ParsedContract =>
    contractFrom(`
request: { method: GET, url: /h }
response:
  status: 200
  headers:
    X-Reply: '1234567'
  matchers:
    headers:
${matchers}
`);

  it("should_match_a_header_against_its_regex_matcher", () => {
    // assertThat(response.header("X-Reply")).matches("[0-9]{7}")
    const contract = headers("      - key: X-Reply\n        regex: '[0-9]{7}'");
    expect(check(contract, text("", { headers: { "x-reply": "7654321" } })).valid).toBe(true);
    expect(check(contract, text("", { headers: { "x-reply": "12" } })).valid).toBe(false);
    expect(check(contract, text("", { headers: {} })).valid).toBe(false);
  });

  it("should_match_a_header_against_a_predefined_matcher", () => {
    const contract = headers("      - key: X-Reply\n        predefined: number");
    expect(check(contract, text("", { headers: { "x-reply": "-3.5" } })).valid).toBe(true);
    expect(check(contract, text("", { headers: { "x-reply": "abc" } })).valid).toBe(false);
  });

  it("should_run_a_header_command_through_the_commands_option", () => {
    const contract = headers("      - key: X-Reply\n        command: checkReply($it)");
    const seen: unknown[] = [];
    const options = { commands: { checkReply: (v: unknown) => void seen.push(v) } };
    expect(check(contract, text("", { headers: { "x-reply": "x" } }), options).valid).toBe(true);
    expect(seen).toEqual(["x"]);
  });

  it("should_compare_a_header_without_matcher_exactly_and_ignore_name_case", () => {
    const contract = headers("      - key: Other\n        regex: '.*'");
    expect(check(contract, text("", { headers: { "X-REPLY": "1234567" } })).valid).toBe(true);
    expect(check(contract, text("", { headers: { "x-reply": "7654321" } })).valid).toBe(false);
  });

  it("should_check_each_value_of_a_list_header", () => {
    const contract = contractFrom(`
request: { method: GET, url: /h }
response:
  status: 200
  headers:
    Vary: [Accept, Origin]
`);
    expect(check(contract, text("", { headers: { vary: "Accept, Origin" } })).valid).toBe(true);
    expect(check(contract, text("", { headers: { vary: "Accept" } })).valid).toBe(false);
  });
});

describe("validateResponse: cookies", () => {
  const cookie = (matchers = ""): ParsedContract =>
    contractFrom(`
request: { method: GET, url: /c }
response:
  status: 200
  cookies:
    session: abc123
  matchers:
    cookies:
${matchers === "" ? "      []" : matchers}
`);

  it("should_check_a_response_cookie_value", () => {
    // assertThat(response.cookie("session")).isNotNull(); …isEqualTo("abc123")
    expect(check(cookie(), text("", { cookies: { session: "abc123" } })).valid).toBe(true);
    expect(check(cookie(), text("", { cookies: { session: "other" } })).fields).toEqual([
      "cookie[session]",
    ]);
  });

  it("should_fail_a_missing_cookie", () => {
    expect(check(cookie(), text("", { cookies: {} })).actuals).toEqual(["(missing)"]);
    expect(check(cookie(), text("")).valid).toBe(false);
  });

  it("should_match_a_cookie_against_its_regex_matcher", () => {
    const contract = cookie("      - key: session\n        regex: '[a-z]+[0-9]+'");
    expect(check(contract, text("", { cookies: { session: "xyz9" } })).valid).toBe(true);
    expect(check(contract, text("", { cookies: { session: "9" } })).valid).toBe(false);
  });
});

describe("validateResponse: bodies from files", () => {
  it("should_verify_a_bodyFromFile_json_body_field_by_field", () => {
    const contract = contractFrom(
      `
request: { method: GET, url: /f }
response:
  status: 200
  bodyFromFile: response.json
`,
      { "response.json": '{"id": 1, "name": "Alice"}' },
    );
    expect(check(contract, json({ id: 1, name: "Alice", extra: 1 })).valid).toBe(true);
    expect(check(contract, json({ id: 1, name: "Bob" })).valid).toBe(false);
  });

  it("should_compare_a_bodyFromFileAsBytes_body_byte_for_byte", () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const contract = contractFrom(
      `
request: { method: GET, url: /b }
response:
  status: 200
  bodyFromFileAsBytes: response.bin
`,
      { "response.bin": bytes },
    );
    const actual = (b: Uint8Array): ExecutionResult => ({
      status: 200,
      headers: {},
      body: undefined,
      bodyBytes: b,
    });
    expect(check(contract, actual(new Uint8Array([0, 1, 2, 255]))).valid).toBe(true);
    expect(check(contract, actual(new Uint8Array([0, 1, 2]))).valid).toBe(false);
  });
});
