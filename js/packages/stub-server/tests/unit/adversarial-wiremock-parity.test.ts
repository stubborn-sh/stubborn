import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { matchRequest } from "../../src/request-matcher.js";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

interface Case {
  readonly name: string;
  readonly request: Record<string, unknown>;
  readonly body: string;
  /** WireMock's verdict; "rejected" when WireMock refuses the mapping (HTTP 422). */
  readonly wiremock: boolean | "rejected";
}

const { cases } = JSON.parse(
  readFileSync(new URL("../fixtures/wiremock-adversarial-verdicts.json", import.meta.url), "utf8"),
) as { cases: readonly Case[] };

function contractFor(request: Record<string, unknown>) {
  return parseWireMockMapping(
    "mapping.json",
    JSON.stringify({ request, response: { status: 200 } }),
  );
}

describe("parity with WireMock 3.13.2 on the adversarial review corpus", () => {
  it.each(cases)("$name: $body", ({ request, body, wiremock }) => {
    const contract = contractFor(request);
    const url = (request["url"] ?? request["urlPath"] ?? "/x") as string;
    const method = request["method"] === "ANY" ? "POST" : ((request["method"] ?? "POST") as string);
    const matched = matchRequest(
      method,
      url,
      { "content-type": "application/xml" },
      undefined,
      [contract],
      body,
    ).matched;
    if (wiremock === "rejected") {
      expect(matched).toBe(false);
      return;
    }
    if (matched !== wiremock) {
      // A difference is only acceptable as a reported under-match.
      expect(matched).toBe(false);
      expect(
        contract.unsupportedMatchers,
        "a difference from WireMock must be reported",
      ).toBeDefined();
    }
  });
});

describe("documented differences from WireMock 3.13.2", () => {
  const verdict = (bodyPatterns: unknown[], body: string): boolean =>
    matchRequest(
      "POST",
      "/x",
      {},
      undefined,
      [contractFor({ method: "POST", urlPath: "/x", bodyPatterns })],
      body,
    ).matched;

  it("should_compare_mixed_content_instead_of_never_matching", () => {
    // WireMock's node sorter throws on text next to elements, so it never matches mixed content.
    expect(verdict([{ equalToXml: "<a><b/>x</a>" }], "<a><b/>x</a>")).toBe(true);
  });

  it("should_refuse_bodies_with_an_internal_dtd_subset", () => {
    // WireMock applies their entities and default attributes; stub-server does not parse them.
    expect(verdict([{ matchesXPath: "/*" }], "<!DOCTYPE a [<!ELEMENT a EMPTY>]><a>t</a>")).toBe(
      false,
    );
    expect(
      verdict(
        [{ matchesXPath: { expression: "/a/@x", equalTo: "1" } }],
        '<!DOCTYPE a [<!ATTLIST a x CDATA "1">]><a/>',
      ),
    ).toBe(false);
  });

  it("should_not_parse_names_with_two_colons", () => {
    // WireMock's namespace-unaware parser accepts <a:b:c/>; xmldom does not.
    expect(verdict([{ matchesXPath: "/*" }], "<a:b:c/>")).toBe(false);
  });

  it("should_not_support_the_namespace_axis", () => {
    const patterns = [{ matchesXPath: "/a/namespace::q", xPathNamespaces: { p: "urn:p" } }];
    expect(verdict(patterns, '<a xmlns:q="urn:x"/>')).toBe(false);
  });

  it("should_follow_the_xpath_spec_for_non_integer_positions", () => {
    // [1.5] selects nothing per XPath 1.0; WireMock's engine selects the first node.
    expect(
      verdict(
        [{ matchesXPath: { expression: "/a/b[1.5]/text()", equalTo: "3" } }],
        "<a><b>3</b><b>10</b></a>",
      ),
    ).toBe(false);
  });
});
