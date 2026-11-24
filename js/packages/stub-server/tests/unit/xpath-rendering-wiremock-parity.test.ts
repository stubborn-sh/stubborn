import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { matchRequest } from "../../src/request-matcher.js";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

interface RenderingCase {
  readonly body: string;
  readonly xpath: string;
  readonly namespaces?: Record<string, string>;
  /** WireMock's XmlNode.toString() of each selected node, or the error it raised. */
  readonly nodes?: readonly string[];
  readonly error?: string;
}

const { cases } = JSON.parse(
  readFileSync(new URL("../fixtures/wiremock-xpath-rendering.json", import.meta.url), "utf8"),
) as { cases: readonly RenderingCase[] };

function matches(c: RenderingCase, valueMatcher: Record<string, unknown>): boolean {
  const pattern = {
    matchesXPath: { expression: c.xpath, ...valueMatcher },
    ...(c.namespaces === undefined ? {} : { xPathNamespaces: c.namespaces }),
  };
  const mapping = {
    request: { method: "POST", urlPath: "/x", bodyPatterns: [pattern] },
    response: { status: 200 },
  };
  return matchRequest(
    "POST",
    "/x",
    {},
    undefined,
    [parseWireMockMapping("m.json", JSON.stringify(mapping))],
    c.body,
  ).matched;
}

describe("matchesXPath node rendering parity with WireMock 3.13.2", () => {
  // Each selected node, rendered as WireMock renders it, must satisfy equalTo — so the text a
  // sub-matcher sees is byte-for-byte WireMock's.
  it.each(cases.filter((c) => c.nodes !== undefined && c.nodes.length > 0))(
    "$xpath on $body",
    (c) => {
      for (const rendered of c.nodes ?? []) {
        expect(matches(c, { equalTo: rendered }), JSON.stringify(rendered)).toBe(true);
      }
    },
  );

  it.each(cases.filter((c) => c.error !== undefined || c.nodes?.length === 0))(
    "$xpath on $body selects nothing WireMock can render",
    (c) => {
      expect(matches(c, { matches: "[\\s\\S]*" })).toBe(false);
    },
  );
});
