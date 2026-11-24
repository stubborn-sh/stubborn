import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContractVerifier } from "../../src/verifier.js";
import { fetchFromHandler } from "../../src/fetch-adapters.js";

/** A contract using what the JVM-generated test sends and checks, verified in process. */
const CONTRACT = `
request:
  method: POST
  urlPath: /orders
  queryParameters: { dryRun: "true" }
  cookies: { session: abc123 }
  headers: { Content-Type: application/json }
  bodyFromFile: order-request.json
response:
  status: 201
  headers:
    Content-Type: application/json
    Location: /orders/1
  cookies:
    order: "1"
  body:
    id: 1
    status: NEW
    lines: [ { sku: A1, qty: 2 } ]
    createdAt: "2024-01-01T10:00:00"
  matchers:
    headers:
      - key: Location
        regex: /orders/[0-9]+
    body:
      - path: $.id
        type: by_type
      - path: $.createdAt
        type: by_timestamp
`;

describe("ContractVerifier end to end", () => {
  let dir: string;
  const seen: { url?: string; cookie?: string | null; body?: string } = {};

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "verifier-e2e-"));
    await writeFile(join(dir, "order.yml"), CONTRACT);
    await writeFile(join(dir, "order-request.json"), '{"sku":"A1","qty":2}');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function verifier(status: string): ContractVerifier {
    return new ContractVerifier({
      providerBaseUrl: "http://sut",
      providerName: "orders",
      providerVersion: "1",
      consumerName: "shop",
      consumerVersion: "1",
      contractsDir: dir,
      fetch: fetchFromHandler(async (request) => {
        seen.url = request.url;
        seen.cookie = request.headers.get("cookie");
        seen.body = await request.text();
        const headers = new Headers({ "content-type": "application/json", location: "/orders/42" });
        headers.append("set-cookie", "order=1; Path=/");
        const body = {
          id: 42,
          status,
          lines: [{ sku: "A1", qty: 2 }],
          createdAt: "2025-06-30T08:15:00",
          extra: "ignored",
        };
        return new Response(JSON.stringify(body), { status: 201, headers });
      }),
    });
  }

  it("should_send_the_contract_request_and_accept_a_conforming_response", async () => {
    const result = await verifier("NEW").verify();
    expect(result.results[0]?.failures).toEqual([]);
    expect(result.passed).toBe(true);
    expect(seen).toEqual({
      url: "http://sut/orders?dryRun=true",
      cookie: "session=abc123",
      body: '{"sku":"A1","qty":2}',
    });
  });

  it("should_fail_on_a_field_no_matcher_covers", async () => {
    const result = await verifier("SHIPPED").verify();
    expect(result.passed).toBe(false);
    expect(result.results[0]?.failures.map((f) => f.field)).toEqual(["body$.['status']"]);
  });
});
