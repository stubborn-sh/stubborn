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

  it("should_refuse_bodies_that_only_a_namespace_unaware_parser_accepts", () => {
    // Xerces reads these loosely (WireMock matches /*); xmldom rejects them, so they under-match.
    for (const body of [
      "<:a/>",
      "<a:/>",
      '<a xmlns:="u"/>',
      '<a b:="1"/>',
      "<xmlns:a/>",
      '<a xmlns:p=""><p:b/></a>',
      '<?xml version="1.0" encoding=""?><a/>',
    ]) {
      expect(verdict([{ matchesXPath: "/*" }], body), body).toBe(false);
    }
  });

  it("should_report_an_expected_document_with_a_processing_instruction_outside_the_root", () => {
    // WireMock never matches such a document, not even an identical body.
    const contract = contractFor({
      method: "POST",
      urlPath: "/x",
      bodyPatterns: [{ equalToXml: "<?p d?><a/>" }],
    });
    expect(contract.unsupportedMatchers).toBeDefined();
    expect(verdict([{ equalToXml: "<?p d?><a/>" }], "<?p d?><a/>")).toBe(false);
  });

  it("should_compare_mixed_content_around_an_ignore_placeholder", () => {
    // WireMock never matches here either (mixed content); stub-server ignores the text.
    expect(
      verdict(
        [{ equalToXml: "<a>${xmlunit.ignore}<b/></a>", enablePlaceholders: true }],
        "<a>x<b/></a>",
      ),
    ).toBe(true);
  });

  it("should_select_attributes_quickly_among_many_siblings", () => {
    const body = `<a>${"<b/>".repeat(250_000)}<b x="1"/></a>`;
    const started = performance.now();
    expect(verdict([{ matchesXPath: { expression: "//b[@x]/@x", equalTo: "1" } }], body)).toBe(
      true,
    );
    expect(performance.now() - started).toBeLessThan(10_000);
  });

  it("should_render_numbers_with_java_digits", () => {
    // Java's FloatingDecimal: integers below 2^63 keep their exact digits down to the double's
    // precision; others use the shortest digits, and only a tie consults the exact value.
    const sum = (n: string, expected: string): boolean =>
      verdict(
        [{ matchesXPath: { expression: "sum(/a/b)", equalTo: expected } }],
        `<a><b>${n}</b></a>`,
      );
    expect(sum("1152921504606846976", "1,152,921,504,606,846,980")).toBe(true);
    expect(sum("36028797018963968", "36,028,797,018,963,968")).toBe(true);
    expect(sum("4611686018427387904", "4,611,686,018,427,387,900")).toBe(true);
    expect(sum("2.0005", "2.001")).toBe(true);
    expect(sum("0.0025", "0.003")).toBe(true);
    expect(sum("1234.5675", "1,234.568")).toBe(true);
  });

  it("should_render_numbers_above_2_to_the_63_with_shortest_digits", () => {
    // Java's legacy dtoa sometimes emits a 17th digit there (2^69 is 590,295,810,358,705,650,000).
    expect(
      verdict(
        [{ matchesXPath: { expression: "sum(/a/b)", equalTo: "590,295,810,358,705,700,000" } }],
        "<a><b>590295810358705651712</b></a>",
      ),
    ).toBe(true);
  });

  it("should_keep_cdata_as_written_where_the_jdk_turns_it_into_text", () => {
    // JAXP's descendant axis skips text runs that start with CDATA (//text() selects nothing
    // here), its serializer drops the CDATA wrapper around supplementary characters, and its
    // namespace-aware parser turns such CDATA, and empty CDATA, into plain text.
    const node = (body: string, expression: string, equalTo: string): boolean =>
      verdict([{ matchesXPath: { expression, equalTo } }], body);
    expect(node("<c><![CDATA[a]]></c>", "//text()", "[#cdata-section: a]")).toBe(true);
    expect(node("<a><![CDATA[😀]]>x</a>", "/*", "<a><![CDATA[😀]]>x</a>\n")).toBe(true);
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
