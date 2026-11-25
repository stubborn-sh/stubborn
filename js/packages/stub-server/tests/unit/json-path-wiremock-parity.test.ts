import { describe, it, expect } from "vitest";
import { matchesJsonPath } from "../../src/json-path.js";

/**
 * `matchesJsonPath` verdicts recorded from WireMock 3.13.2 (Jayway JsonPath): each mapping held
 * one `matchesJsonPath` body pattern, and the request carried the given JSON body. `true` means
 * WireMock answered 200, `false` means 404. Expressions WireMock rejects when loading a mapping
 * (e.g. `NaN`, `['it's']`) are recorded as `false`: they can never match.
 *
 * Includes every JSONPath shape Stubborn Contract / Spring Cloud Contract generate for request
 * bodies (stubborn-sh/stubborn#166), plus Jayway edge cases.
 */
const WIREMOCK_VERDICTS: readonly (readonly [
  expression: string,
  body: unknown,
  matches: boolean,
])[] = [
  [
    "$.['items'][*][?(@.['id'] == '1')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$.['items'][*][?(@.['id'] == '1')]", { items: [{ id: "3" }] }, false],
  ["$.['items'][*][?(@.['id'] == '1')]", { items: [] }, false],
  ["$.['items'][*][?(@.['id'] == '1')]", { items: { id: "1" } }, false],
  ["$.['items'][*][?(@.['id'] == '1')]", { other: 1 }, false],
  ["$.['items'][*][?(@.['id'] == '1')]", [], false],
  [
    "$.['items'][*][?(@.['name'] == 'First')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$.['items'][*][?(@.['name'] == 'First')]", { items: [{ name: "first" }] }, false],
  ["$.['items'][*][?(@.['id'] == 1)]", { items: [{ id: 1 }] }, true],
  ["$.['items'][*][?(@.['id'] == 1)]", { items: [{ id: "1" }] }, true],
  ["$.['items'][*][?(@.['id'] == 1)]", { items: [{ id: 1.0 }] }, true],
  [
    "$.items[*][?(@.id == '2')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  [
    "$.['items'][1][?(@.['id'] == '2')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$.['items'][1][?(@.['id'] == '2')]", { items: [{ id: "2" }] }, false],
  [
    "$.['items'][0][?(@.['id'] == '2')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    false,
  ],
  [
    "$.['items'][5][?(@.['id'] == '2')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    false,
  ],
  [
    "$.['items'][?(@.['id'] == '1')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$.['tags'][?(@ == 'x')]", { tags: ["x", "y"] }, true],
  ["$.['tags'][?(@ == 'x')]", { tags: ["y"] }, false],
  ["$.['tags'][?(@ == 'x')]", { tags: "x" }, false],
  ["$.['n'][*][?(@ == 3)]", { n: [1, 3] }, false],
  ["$.['n'][*][?(@ == 3)]", { n: [1] }, false],
  ["$[*][?(@.['id'] == '1')]", [{ id: "1" }], true],
  ["$[*][?(@.['id'] == '1')]", [{ id: "2" }], false],
  ["$[*][?(@.['id'] == '1')]", { x: { id: "1" } }, true],
  ["$[*][?(@ == 'x')]", ["x"], false],
  ["$[*][?(@ == 'x')]", ["y"], false],
  ["$[*][0][?(@.['a'] == 'b')]", [[{ a: "b" }]], true],
  ["$[*][0][?(@.['a'] == 'b')]", [[{ a: "c" }]], false],
  ["$[*].['a'].['b'][?(@.['c'] == 1)]", [{ a: { b: { c: 1 } } }], true],
  ["$[*].['a'].['b'][?(@.['c'] == 1)]", [{ a: { b: { c: 2 } } }], false],
  ["$[*].['a'].['b'].['c'][*][*][?(@ == -1)]", [{ a: { b: { c: [[-1, 2]] } } }], false],
  ["$[*].['a'].['b'].['c'][*][*][?(@ == -1)]", [{ a: { b: { c: [[1]] } } }], false],
  ["$.['a'].['b'][*].['c'][?(@.['d'] =~ /x.*/)]", { a: { b: [{ c: { d: "xyz" } }] } }, true],
  ["$.['a'].['b'][*].['c'][?(@.['d'] =~ /x.*/)]", { a: { b: [{ c: { d: "yx" } }] } }, false],
  [
    "$.['a'].['b'][*][?(@.['e'] =~ /[xy]/)]",
    {
      a: {
        b: [
          { c: { d: [1, 2] }, e: "x" },
          { c: { d: [3] }, e: "y" },
        ],
      },
    },
    true,
  ],
  [
    "$.a.b[*].c.d[?(@ == 3)]",
    {
      a: {
        b: [
          { c: { d: [1, 2] }, e: "x" },
          { c: { d: [3] }, e: "y" },
        ],
      },
    },
    true,
  ],
  ["$.a.b[*].c.d[?(@ == 3)]", { a: { b: [{ c: { d: [4] } }] } }, false],
  ["$[?(@.['product'] == 'iPhone 16')]", { product: "iPhone 16" }, true],
  ["$[?(@.['product'] == 'iPhone 16')]", { product: "x" }, false],
  ["$[?(@.['product'] == 'iPhone 16')]", {}, false],
  ["$[?(@.product == 'iPhone 16')]", { product: "iPhone 16" }, true],
  ["$[?(@.['amount'] == 999.99)]", { amount: 999.99 }, true],
  ["$[?(@.['amount'] == 999.99)]", { amount: "999.99" }, true],
  ["$[?(@.['active'] == true)]", { active: true }, true],
  ["$[?(@.['active'] == true)]", { active: "true" }, false],
  ["$[?(@.['active'] == true)]", { active: false }, false],
  ["$[?(@.['deletedAt'] == null)]", { deletedAt: null }, true],
  ["$[?(@.['deletedAt'] == null)]", {}, false],
  ["$[?(@.['deletedAt'] == null)]", { deletedAt: 1 }, false],
  ["$[?(@.['order'].['id'] == 'ORD-123')]", { order: { id: "ORD-123" } }, true],
  ["$[?(@.['order'].['id'] == 'ORD-123')]", { order: { id: "x" } }, false],
  ["$[?(@.person['name'] == 'a')]", { person: { name: "a" } }, true],
  ["$[?(@.['duck'] =~ /([0-9]{3})/)]", { duck: "123" }, true],
  ["$[?(@.['duck'] =~ /([0-9]{3})/)]", { duck: "12" }, false],
  ["$[?(@.['duck'] =~ /([0-9]{3})/)]", { duck: 123 }, true],
  ["$[?(@.['duck'] =~ /([0-9]{3})/)]", { duck: "1234" }, false],
  ["$[?(@.['duck'] =~ /([0-9]{3})/)]", { duck: true }, false],
  ["$[?(@.['e'] =~ /(^foo$|^bar$)?/)]", { e: "foo" }, true],
  ["$[?(@.['e'] =~ /(^foo$|^bar$)?/)]", { e: "baz" }, false],
  ["$[?(@.['e'] =~ /(^foo$|^bar$)?/)]", { e: "" }, true],
  ["$[?(@.name =~ /([a-z]+)/)]", { name: "abc" }, true],
  ["$[?(@.name =~ /([a-z]+)/)]", { name: "aBc" }, false],
  ["$[?(@.name=~/([a-z]+)/)]", { name: "abc" }, true],
  ["$[?(@.name =~ /abc/i)]", { name: "ABC" }, true],
  ["$[?(@.['a']==1)]", { a: 1 }, true],
  ["$[?(@.items.size() >= 1)]", { items: [1] }, true],
  ["$[?(@.items.size() >= 1)]", { items: [] }, false],
  ["$[?(@.items.size() >= 1)]", {}, false],
  ["$[?(@.items.size() >= 1 && @.items.size() <= 2)]", { items: [1] }, true],
  ["$[?(@.items.size() >= 1 && @.items.size() <= 2)]", { items: [1, 2, 3] }, false],
  ["$[?(@.items.size() <= 2)]", { items: [1] }, true],
  ["$[?(@.items.size() <= 2)]", { items: [1, 2, 3] }, false],
  [
    "$[?(@.['items'].size() == 2)]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  [
    "$.['items'][?(@.size() >= 1)]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$[?(@.['a'] != 'x')]", { a: "y" }, true],
  ["$[?(@.['a'] != 'x')]", { a: "x" }, false],
  ["$[?(@.['a'] > 5)]", { a: 6 }, true],
  ["$[?(@.['a'] > 5)]", { a: 5 }, false],
  ["$[?(@.['a'] < 5 || @.['b'] == 'z')]", { a: 6, b: "z" }, true],
  ["$[?(@.['a'] < 5 || @.['b'] == 'z')]", { a: 6, b: "q" }, false],
  ["$[?(@.['a'] == \"dq\")]", { a: "dq" }, true],
  ["$[?(@.['a'] == 'it\\'s')]", { a: "it's" }, true],
  ["$[?(@ == 'x')]", ["x"], true],
  ["$[?(@ == 'x')]", ["y"], false],
  ["$[?(@.['id'])]", { id: 1 }, true],
  ["$[?(@.['id'])]", { x: 1 }, false],
  [
    "$.items[?(@.id in ['1','9'])]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$.product", { product: "x" }, true],
  ["$.product", { product: null }, false],
  ["$.product", {}, false],
  ["$.product", { product: [] }, false],
  ["$.product", { product: {} }, false],
  ["$.product", { product: 0 }, true],
  ["$.product", { product: false }, true],
  ["$.product", { product: "" }, true],
  ["$.['order'].['id']", { order: { id: 1 } }, true],
  ["$.['order'].['id']", { order: {} }, false],
  ["$.phoneNumbers[*].number", { phoneNumbers: [{ number: "1" }] }, true],
  ["$.phoneNumbers[*].number", { phoneNumbers: [{ x: 1 }] }, false],
  ["$.phoneNumbers[*].number", { phoneNumbers: [] }, false],
  ["$.items[*]", { items: [1] }, true],
  ["$.items[*]", { items: [] }, false],
  ["$[*]", [1], true],
  ["$[*]", [], false],
  [
    "$.items[0].id",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$.items[0].id", { items: [] }, false],
  [
    "$..id",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$..id", { x: 1 }, false],
  [
    "$..[?(@.id == '2')]",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  [
    "$.items.length()",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  [
    "$['items'][*]['id']",
    {
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    },
    true,
  ],
  ["$[?(@.['a'] != 'x')]", {}, true],
  ["$[?(@.['id'])]", { id: null }, true],
  ["$[?(@.['b'] =~ /true/)]", { b: true }, true],
  ["$[?(@.['b'] =~ /x/)]", { b: ["x"] }, true],
  ["$[?(@.['b'] =~ /x/)]", { b: { k: "x" } }, false],
  ["$[?(@.['b'] =~ /x/)]", { b: null }, false],
  ["$[?(@.['n'] =~ /1\\.5/)]", { n: 1.5 }, true],
  ["$[?(@.['s'] < 'b')]", { s: "a" }, true],
  ["$[?(@.['s'] < 'b')]", { s: "c" }, false],
  ["$[?(@.['s'] < 'b')]", { s: 1 }, false],
  ["$[?(@.['s'] > 1)]", { s: "2" }, false],
  ["$[?(!(@.['a'] == 1))]", { a: 2 }, true],
  ["$[?(!(@.['a'] == 1))]", { a: 1 }, false],
  ["$[?(@.['a'] size 2)]", { a: [1, 2] }, true],
  ["$[?(@.['a'] size 2)]", { a: "ab" }, true],
  ["$[?(@.['a'] size 2)]", { a: [1] }, false],
  ["$[?(@.['a'] empty false)]", { a: [1] }, true],
  ["$[?(@.['a'] empty false)]", { a: [] }, false],
  ["$[?(@.['a'] empty false)]", { a: "" }, false],
  ["$[?(@.['a'] contains 'x')]", { a: ["x"] }, true],
  ["$[?(@.['a'] contains 'x')]", { a: "axb" }, true],
  ["$[?(@.['a'] contains 'x')]", { a: ["y"] }, false],
  ["$[?(@.['a'] nin [1, 2])]", { a: 3 }, true],
  ["$[?(@.['a'] nin [1, 2])]", { a: 1 }, false],
  ["$[?(@.['a'] in [1, '2'])]", { a: 2 }, true],
  ["$[?(@.['a'] in [1, '2'])]", { a: "1" }, true],
  ["$[?(@.['a'] anyof [1, 2])]", { a: [2, 5] }, true],
  ["$[?(@.['a'] anyof [1, 2])]", { a: [5] }, false],
  ["$[?(@.['a'] subsetof [1, 2])]", { a: [2] }, true],
  ["$[?(@.['a'] subsetof [1, 2])]", { a: [5] }, false],
  ["$[?(@.['a'] noneof [1])]", { a: [2] }, true],
  ["$[?(@.['a'] noneof [1])]", { a: [1] }, false],
  ["$[?(@.['a'] == '1.0')]", { a: 1 }, true],
  ["$[?(@.['a'] == '1.0')]", { a: 1.5 }, false],
  ["$[?(@.['a'] == 1.0)]", { a: "1" }, false],
  ["$[?(@.['a'] == 1.0)]", { a: "1.0" }, true],
  ["$[?(@.['a'] == 1.0)]", { a: 1 }, true],
  ["$[?(@.['a'] == '')]", { a: 0 }, false],
  ["$[?(@.['a'] == '')]", { a: "" }, true],
  ["$[?(@.['a'] == $.['b'])]", { a: 1, b: 1 }, true],
  ["$[?(@.['a'] == $.['b'])]", { a: 1, b: 2 }, false],
  ["$[?(@.['a'] == {'k': 1})]", { a: { k: 1 } }, true],
  ["$[?(@.['a'] == [1,2])]", { a: [1, 2] }, true],
  ["$[?(@.['a'][*] == 1)]", { a: [1] }, false],
  ["$.items[-1].id", { items: [{ id: "1" }, { id: "2" }] }, true],
  ["$.items[0:1]", { items: [1] }, true],
  ["$.items[0:1]", { items: [] }, false],
  ["$.items[0,1].id", { items: [{ id: 1 }] }, true],
  ["$['a','b']", { a: 1 }, true],
  ["$['a','b']", {}, false],
  ["$.*", { a: 1 }, true],
  ["$.*", {}, false],
  ["$.items[*].id", { items: [{ id: null }] }, true],
  ["$.items[?(@.id == '1')].name", { items: [{ id: "1" }] }, false],
  ["$.items[?(@.id == '1')].name", { items: [{ id: "1", name: "n" }] }, true],
  ["$[?(@.['a'] =~ /a\\/b/)]", { a: "a/b" }, true],
  ["$[?(@.['a'] =~ /(x|y)/ && @.['b'] == 'z')]", { a: "x", b: "z" }, true],
  ["$[?(@.['a'] =~ /(x|y)/ && @.['b'] == 'z')]", { a: "x", b: "q" }, false],
  ["$.a[?(@.b == 1 && (@.c == 2 || @.d == 3))]", { a: [{ b: 1, d: 3 }] }, true],
  ["$.a[?(@.b == 1 && (@.c == 2 || @.d == 3))]", { a: [{ b: 1, d: 4 }] }, false],
  ["garbage(", { a: 1 }, false],
  ["$[?(@.['it's'] == 'value')]", { "it's": "value" }, false],
  ["$[?(@.['msg'] == 'it\\'s cool')]", { msg: "it's cool" }, true],
  ["$[?(@.['code'] == '123')]", { code: 123 }, true],
  ["$[?(@.['name'] == 'test')]", [{ name: "test" }, { name: "other" }], true],
  ["$.0.name", [{ name: "test" }], false],
  ["$.field", { field: null }, false],
  ["$[?(@.nonexistent)]", { other: "value" }, false],
  ["$[?(@.['amount'] > 100)]", { amount: 50 }, false],
  ["$[?(@.['value'] == NaN)]", { value: "NaN" }, false],
  ["$[?(@.['count'] == 0)]", { count: "0" }, true],
  ["$[?(@.name.size() >= 1)]", { name: "not an array" }, false],
  ["$[?(@.['items[0]'] == 'value')]", { "items[0]": "value" }, true],
];

describe("matchesJsonPath parity with WireMock 3.13.2", () => {
  it.each(WIREMOCK_VERDICTS)("%s against %j matches: %s", (expression, body, matches) => {
    expect(matchesJsonPath(body, expression)).toBe(matches);
  });

  it("should_reject_malformed_expression_that_wiremock_accepts_leniently", () => {
    // WireMock (Jayway) treats "$.a[" as "$.a"; it is not valid JSONPath, so it never matches here.
    expect(matchesJsonPath({ a: 1 }, "$.a[")).toBe(false);
  });
});
