import { describe, it, expect, afterEach } from "vitest";
import { matchRequest } from "../../src/request-matcher.js";
import { StubServer } from "../../src/stub-server.js";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

/**
 * Request bodies are attacker-controlled. Each case here once crashed the process or blocked the
 * event loop for seconds (found by adversarial review of the XML support).
 */
function contract(bodyPatterns: unknown[]) {
  return parseWireMockMapping(
    "mapping.json",
    JSON.stringify({
      request: { method: "POST", urlPath: "/x", bodyPatterns },
      response: { status: 200 },
    }),
  );
}

function timed(bodyPatterns: unknown[], body: string): { matched: boolean; ms: number } {
  const c = contract(bodyPatterns);
  const start = performance.now();
  const matched = matchRequest("POST", "/x", {}, undefined, [c], body).matched;
  return { matched, ms: performance.now() - start };
}

const SCC_XPATH = [{ matchesXPath: { expression: "/test/list/elem[2]/text()", equalTo: "abc" } }];
const wide = (n: number): string => `<test><list>${"<elem>abc</elem>".repeat(n)}</list></test>`;
const nested = (depth: number): string => "<a>".repeat(depth) + "</a>".repeat(depth);
const manyAttributes = (n: number): string =>
  `<a ${Array.from({ length: n }, (_, i) => `a${i}='1'`).join(" ")}/>`;

describe("XML matching robustness", () => {
  it("should_not_overflow_the_stack_on_deep_nesting", () => {
    // Used to throw RangeError from a recursive copy and kill the server (~42 KB was enough).
    for (const patterns of [
      [{ matchesXPath: { expression: "/order/id/text()", equalTo: "1" } }],
      [{ matchesXPath: { expression: "/a", contains: "x" }, xPathNamespaces: { p: "urn:p" } }],
      [{ equalToXml: "<a><a/></a>" }],
    ]) {
      expect(() => timed(patterns, nested(100_000))).not.toThrow();
    }
  });

  it("should_match_documents_up_to_the_depth_limit_and_refuse_deeper_ones", () => {
    const patterns = [{ matchesXPath: { expression: "count(//a)", equalTo: "2,000" } }];
    expect(timed(patterns, nested(2000)).matched).toBe(true);
    expect(timed([{ matchesXPath: "/a" }], nested(2001)).matched).toBe(false);
  });

  it("should_evaluate_positional_predicates_on_many_siblings_in_linear_time", () => {
    // xmldom's compareDocumentPosition made this quadratic: 8000 siblings took ~13 s.
    const { matched, ms } = timed(SCC_XPATH, wide(8000));
    expect(matched).toBe(true);
    expect(ms).toBeLessThan(1500);
  });

  it("should_handle_many_attributes_quickly_and_enforce_the_jdk_limit", () => {
    // Stripping namespaces attribute by attribute was quadratic: 90k attributes took 28 s.
    const under = timed([{ matchesXPath: "/a" }], manyAttributes(9000));
    expect(under.matched).toBe(true);
    expect(under.ms).toBeLessThan(1500);
    // The JDK parser WireMock uses rejects more than 10,000 attributes on one element.
    expect(timed([{ matchesXPath: "/a" }], manyAttributes(10_001)).matched).toBe(false);
  });

  it("should_compare_ignoreOrderOfSameNode_in_linear_time_in_depth", () => {
    // The chosen candidate used to be compared twice per level: 2^depth.
    const chain = nested(24);
    const { matched, ms } = timed([{ equalToXml: chain, ignoreOrderOfSameNode: true }], chain);
    expect(matched).toBe(true);
    expect(ms).toBeLessThan(200);
  });
});

describe("StubServer under hostile XML bodies", () => {
  let server: StubServer | null = null;

  afterEach(async () => {
    await server?.stop();
    server = null;
  });

  it("should_keep_serving_after_a_hostile_body", async () => {
    server = new StubServer({ port: 0 });
    server.setContracts([
      contract([{ matchesXPath: { expression: "/order/id/text()", equalTo: "1" } }]),
    ]);
    const port = await server.start();
    const post = (body: string): Promise<Response> =>
      fetch(`http://127.0.0.1:${port}/x`, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body,
      });

    expect((await post(nested(100_000))).status).toBe(404);
    expect((await post("<order><id>1</id></order>")).status).toBe(200);
  });
});
