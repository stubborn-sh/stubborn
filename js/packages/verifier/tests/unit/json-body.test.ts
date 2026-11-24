import { describe, it, expect } from "vitest";
import {
  buildJsonAssertions,
  checkJsonAssertion,
  removeMatchingJsonPaths,
} from "../../src/json-body.js";

/**
 * Expected outcomes recorded by running the JVM itself on the same input:
 * `new JsonToJsonPathsConverter(false).transformToJsonPathWithTestsSideValues(body, true)`, each
 * resulting path checked with jsonassert's `JsonAssertion.assertThat(actual).matchesJsonPath`
 * (or, for `.isEmpty()` entries, read and tested for emptiness); and
 * `JsonToJsonPathsConverter.removeMatchingJsonPaths` for the matcher-path table.
 */
const FIELD_BY_FIELD: ReadonlyArray<
  readonly [contract: unknown, actual: unknown, passes: boolean]
> = [
  [{ id: 1, name: "Alice" }, { id: 1, name: "Alice", extra: true }, true],
  [{ id: 1, name: "Alice" }, { id: 1, name: "Bob" }, false],
  [{ id: 1 }, { id: "1" }, true],
  [{ id: "1" }, { id: 1 }, true],
  [{ ok: true }, { ok: "true" }, false],
  [{ v: null }, { v: null }, true],
  [{ v: null }, {}, false],
  [{ a: { b: { c: "x" } } }, { a: { b: { c: "x", d: 1 } } }, true],
  [{ items: [{ id: 1 }, { id: 2 }] }, { items: [{ id: 2 }, { id: 1 }] }, true],
  [{ items: [{ id: 1 }, { id: 2 }] }, { items: [{ id: 1 }, { id: 3 }] }, false],
  [
    { items: [{ id: 1, n: "a" }] },
    {
      items: [
        { id: 1, n: "b" },
        { id: 2, n: "a" },
      ],
    },
    true,
  ],
  [{ tags: ["a", "b"] }, { tags: ["b", "a", "c"] }, true],
  [{ tags: ["a", "b"] }, { tags: ["a"] }, false],
  [{ tags: [] }, { tags: ["x"] }, false],
  [{ tags: [] }, {}, false],
  [{ tags: [] }, { tags: null }, true],
  [{ o: {} }, { o: { a: 1 } }, false],
  [{ o: {} }, {}, false],
  [{}, { a: 1 }, false],
  [[], [1], false],
  [[{ a: 1 }, { b: 2 }], [{ b: 2 }, { a: 1 }], true],
  [[{ a: 1 }, { b: 2 }], [{ a: 1 }], false],
  [[1, 2, 3], [3, 2, 1], true],
  [{ m: [1, { a: "x" }] }, { m: [{ a: "x" }, 1] }, true],
  [{ m: [1, { a: "x" }] }, { m: [{ a: "x" }] }, false],
  [
    {
      c: [
        [1, 2],
        [3, 4],
      ],
    },
    {
      c: [
        [4, 3],
        [2, 1],
      ],
    },
    true,
  ],
  [
    {
      c: [
        [1, 2],
        [3, 4],
      ],
    },
    { c: [[1, 2]] },
    false,
  ],
  [{ c: [[{ a: 1 }], [{ b: 2 }]] }, { c: [[{ b: 2 }], [{ a: 1 }]] }, true],
  [{ x: { y: [{ z: [{ k: "v" }] }] } }, { x: { y: [{ z: [{ k: "w" }] }] } }, false],
  [{ n: 1.5 }, { n: "1.5" }, true],
  [{ n: "x" }, { n: ["x"] }, false],
  [{ a: [{}] }, { a: [{ q: 1 }] }, false],
  [{ a: [{}, { b: 1 }] }, { a: [{}, { b: 1 }] }, false],
  [{ a: { b: 1 } }, { a: [{ b: 1 }] }, true],
  [{ a: [{ b: 1 }] }, { a: { b: 1 } }, false],
];

const REMOVAL: ReadonlyArray<readonly [body: unknown, paths: string[], reduced: unknown]> = [
  [{ id: 1, name: "Alice" }, ["$.id"], { name: "Alice" }],
  [{ id: 1, name: "Alice" }, ["$['id']"], { name: "Alice" }],
  [{ id: 1, name: "Alice" }, ["$.id", "$.name"], {}],
  [{ a: { b: 1 }, c: 2 }, ["$.a.b"], { c: 2 }],
  [{ a: { b: 1, x: 2 }, c: 2 }, ["$.a.b"], { a: { x: 2 }, c: 2 }],
  [{ items: [{ id: 1 }, { id: 2 }], n: 1 }, ["$.items[*].id"], { n: 1 }],
  [
    { items: [{ id: 1, k: 3 }, { id: 2 }], n: 1 },
    ["$.items[*].id"],
    { items: [{ k: 3 }, {}], n: 1 },
  ],
  [{ items: [{ id: 1 }, { id: 2 }], n: 1 }, ["$.items[0].id"], { items: [{ id: 2 }], n: 1 }],
  [{ items: [1, 2, 3], n: 1 }, ["$.items[*]"], { n: 1 }],
  [{ items: [1, 2, 3], n: 1 }, ["$.items[1]"], { items: [1, 3], n: 1 }],
  [{ a: { id: 1 }, b: { id: 2, x: 1 } }, ["$..id"], { a: {}, b: { x: 1 } }],
  [{ a: { b: { c: 1 } }, d: 1 }, ["$['a']['b']['c']"], { d: 1 }],
  [[{ id: 1 }, { id: 2 }], ["$[*].id"], []],
  [[{ id: 1, x: 1 }, { id: 2 }], ["$[*].id"], [{ x: 1 }, {}]],
  [{ v: null, w: 1 }, ["$.v"], { v: null, w: 1 }],
  [
    {
      items: [
        { t: "a", id: 1 },
        { t: "b", id: 2 },
      ],
    },
    ["$.items[?(@.t == 'a')].id"],
    { items: [{ t: "a" }, { t: "b", id: 2 }] },
  ],
  [{ items: [{ id: 1 }] }, ["$.missing"], { items: [{ id: 1 }] }],
  [{ a: [{ b: [{ c: 1 }] }], z: 1 }, ["$.a[*].b[*].c"], { z: 1 }],
  [{ x: [{ y: { z: 1 } }], k: 1 }, ["$.x[*].y.z"], { k: 1 }],
];

describe("JSON body verification recorded from the JVM", () => {
  FIELD_BY_FIELD.forEach(([contract, actual, passes], i) => {
    it(`should_${passes ? "pass" : "fail"}_case_${String(i)}_as_the_jvm_does`, () => {
      const failures = buildJsonAssertions(contract, true)
        .map((assertion) => checkJsonAssertion(actual, assertion))
        .filter((failure) => failure !== undefined);
      expect(failures.length === 0).toBe(passes);
    });
  });

  REMOVAL.forEach(([body, paths, reduced], i) => {
    it(`should_remove_matcher_paths_case_${String(i)}_as_the_jvm_does`, () => {
      expect(removeMatchingJsonPaths(body, paths)).toEqual(reduced);
    });
  });

  it("should_not_mutate_the_contract_body", () => {
    const body = { id: 1, items: [{ id: 2 }] };
    removeMatchingJsonPaths(body, ["$.id", "$.items[*].id"]);
    expect(body).toEqual({ id: 1, items: [{ id: 2 }] });
  });
});
