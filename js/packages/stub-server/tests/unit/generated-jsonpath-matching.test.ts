import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { matchRequest } from "../../src/request-matcher.js";
import { matchesJsonPath } from "../../src/json-path.js";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";
import { StubServer } from "../../src/stub-server.js";
import type { ParsedContract } from "../../src/contract-parser.js";

// Mappings produced by the contract generator (see tests/fixtures/generated-stubs/README.md).
// Every expectation below was recorded against WireMock 3.13.2 serving the same mapping.
const MAPPINGS_DIR = join(import.meta.dirname, "..", "fixtures", "generated-stubs", "mappings");

function load(name: string): ParsedContract {
  return parseWireMockMapping(name, readFileSync(join(MAPPINGS_DIR, name), "utf-8"));
}

function matches(mapping: ParsedContract, body: unknown): boolean {
  const url = mapping.request.url ?? mapping.request.urlPath ?? "/";
  const headers = { "Content-Type": "application/json", "X-Trace": "abc" };
  return matchRequest(mapping.request.method, url, headers, body, [mapping]).matched;
}

describe("generated mappings match their own contract's request (AC-JP-1)", () => {
  const ownRequests: ReadonlyArray<readonly [string, unknown]> = [
    [
      "echoIds.json",
      {
        items: [
          { id: "1", name: "First" },
          { id: "2", name: "Second" },
        ],
      },
    ],
    ["echoSingle.json", { items: [{ id: "1", name: "First" }], owner: { name: "Ann" } }],
    [
      "nested.json",
      {
        order: {
          id: 7,
          lines: [{ sku: "A", qty: 1, gift: true, tags: ["x", "y"], parts: [{ code: "p1" }] }],
        },
      },
    ],
    [
      "topArray.json",
      [
        { id: "1", price: 2.5 },
        { id: "2", price: 3 },
      ],
    ],
    ["matchers.json", { items: [{ id: "123", name: "First" }], count: 1 }],
    [
      "tricky.json",
      {
        grid: [[1, 2], [3]],
        notes: [{ text: `it's (a) [test] $5 & "q"`, gone: null }],
        "odd key": { v: -1.5 },
        empty: [],
        obj: {},
      },
    ],
  ];

  for (const [name, body] of ownRequests) {
    it(`should_match_own_request_for_${name}`, () => {
      expect(matches(load(name), body)).toBe(true);
    });
  }
});

describe("filters under [*] are evaluated, not skipped (AC-JP-2)", () => {
  it("should_match_when_array_elements_are_reordered_and_extended", () => {
    const body = {
      items: [
        { id: "2", name: "Second" },
        { id: "1", name: "First" },
        { id: "3", name: "Third" },
      ],
    };
    expect(matches(load("echoIds.json"), body)).toBe(true);
  });

  it("should_not_match_when_an_expected_element_is_missing", () => {
    expect(matches(load("echoIds.json"), { items: [{ id: "1", name: "First" }] })).toBe(false);
  });

  it("should_not_match_when_a_value_two_arrays_deep_differs", () => {
    const body = {
      order: {
        id: 7,
        lines: [{ sku: "A", qty: 1, gift: true, tags: ["x", "y"], parts: [{ code: "p2" }] }],
      },
    };
    expect(matches(load("nested.json"), body)).toBe(false);
  });

  it("should_match_when_each_filter_is_satisfied_by_a_different_element", () => {
    // WireMock evaluates every matchesJsonPath independently, so the conditions may be
    // satisfied by different array elements.
    const body = {
      order: {
        id: 7,
        lines: [
          { sku: "B", qty: 1, gift: true, tags: ["x", "y"], parts: [{ code: "p1" }] },
          { sku: "A", qty: 2, gift: false, tags: [], parts: [] },
        ],
      },
    };
    expect(matches(load("nested.json"), body)).toBe(true);
  });

  it("should_not_match_top_level_array_missing_an_element", () => {
    const body = [
      { id: "1", price: 2.5 },
      { id: "3", price: 3 },
    ];
    expect(matches(load("topArray.json"), body)).toBe(false);
  });

  it("should_not_match_regex_under_wildcard_when_no_element_matches", () => {
    const body = { items: [{ id: "abc", name: "First" }], count: 1 };
    expect(matches(load("matchers.json"), body)).toBe(false);
  });

  it("should_match_regex_under_wildcard_when_any_element_matches", () => {
    expect(matches(load("matchers.json"), { items: [{ id: "9" }, { id: "x" }], count: 1 })).toBe(
      true,
    );
  });

  it("should_not_match_combined_size_constraint_on_empty_array", () => {
    expect(matches(load("matchers.json"), { items: [], count: 1 })).toBe(false);
  });
});

describe("stub server serves a generated mapping with nested-array matchers (AC-JP-1)", () => {
  const server = new StubServer();
  let baseUrl = "";

  beforeAll(async () => {
    server.setContracts([load("echoIds.json")]);
    baseUrl = `http://127.0.0.1:${String(await server.start())}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should_answer_200_for_the_contract_request", async () => {
    const res = await fetch(`${baseUrl}/items/ids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { id: "1", name: "First" },
          { id: "2", name: "Second" },
        ],
      }),
    });
    expect(res.status).toBe(200);
  });
});

describe("results agree with WireMock 3.13.2 (AC-JP-3)", () => {
  // [expected, expression, body] rows recorded against WireMock 3.13.2.
  const truth: ReadonlyArray<readonly [boolean, string, unknown]> = [
    [false, "$.field", { field: null }],
    [true, "$.field", { field: false }],
    [true, "$.field", { field: 0 }],
    [true, "$.field", { field: "" }],
    [false, "$.a.b", { a: { b: [] } }],
    [false, "$.a.b", { a: { b: {} } }],
    [false, "$[?(@.['it's'] == 'value')]", { "it's": "value" }],
    [true, "$[?(@.['count'] == 0)]", { count: "0" }],
    [true, "$[?(@.['code'] == '123')]", { code: 123 }],
    [false, "$[?(@.['duck'] =~ /([0-9]{3})/)]", { duck: "1234" }],
  ];
  for (const [expected, expression, body] of truth) {
    it(`should_${expected ? "match" : "not_match"}_${expression}_against_${JSON.stringify(body)}`, () => {
      expect(matchesJsonPath(body, expression)).toBe(expected);
    });
  }
});
