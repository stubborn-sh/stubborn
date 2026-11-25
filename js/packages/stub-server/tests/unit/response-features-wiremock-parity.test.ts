import { readFileSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import { StubServer } from "../../src/stub-server.js";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

interface ResponseCase {
  readonly name: string;
  readonly mapping: string;
  readonly request: { readonly method: string; readonly path: string };
  readonly wiremock: {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly bodyHex: string;
  };
}

const { cases } = JSON.parse(
  readFileSync(new URL("../fixtures/wiremock-response-features.json", import.meta.url), "utf8"),
) as { cases: readonly ResponseCase[] };
const filesDir = fileURLToPath(new URL("../fixtures/response-files", import.meta.url));
const IGNORED_HEADERS = new Set([
  "date",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "vary",
  "server",
  "content-encoding",
]);

let server: StubServer | null = null;
let upstream: Server | null = null;
afterEach(async () => {
  await server?.stop();
  server = null;
  await new Promise<void>((resolve) =>
    upstream === null ? resolve() : upstream.close(() => resolve()),
  );
  upstream = null;
});

async function serve(mapping: string): Promise<number> {
  server = new StubServer({ port: 0 });
  server.setContracts([parseWireMockMapping("m.json", mapping, { filesDir })]);
  return server.start();
}

describe("WireMock 3.13.2 response parity", () => {
  // Bodies byte for byte (verbatim body, Jackson-written jsonBody, base64Body, body files),
  // body precedence, Matched-Stub headers, dribbled and delayed bodies.
  it.each(cases)("$name", async ({ mapping, request: req, wiremock }) => {
    const port = await serve(mapping);
    const response = await fetch(`http://127.0.0.1:${port}${req.path}`, { method: req.method });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (!IGNORED_HEADERS.has(key)) headers[key] = value;
    });
    expect(response.status).toBe(wiremock.status);
    expect(headers).toEqual(wiremock.headers);
    expect(Buffer.from(await response.arrayBuffer()).toString("hex")).toBe(wiremock.bodyHex);
  });

  it("should_spread_a_dribbled_body_over_its_duration", async () => {
    const port = await serve(
      JSON.stringify({
        request: { method: "GET", url: "/x" },
        response: {
          body: "abcdefghij",
          chunkedDribbleDelay: { numberOfChunks: 3, totalDuration: 90 },
        },
      }),
    );
    const started = Date.now();
    expect(await (await fetch(`http://127.0.0.1:${port}/x`)).text()).toBe("abcdefghij");
    expect(Date.now() - started).toBeGreaterThanOrEqual(85);
  });

  it("should_add_the_fixed_delay_and_the_delay_distribution", async () => {
    const port = await serve(
      JSON.stringify({
        request: { method: "GET", url: "/x" },
        response: {
          body: "d",
          fixedDelayMilliseconds: 30,
          delayDistribution: { type: "uniform", lower: 30, upper: 40 },
        },
      }),
    );
    const started = Date.now();
    await (await fetch(`http://127.0.0.1:${port}/x`)).text();
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
  });

  it.each([
    ["CONNECTION_RESET_BY_PEER", "ECONNRESET"],
    ["EMPTY_RESPONSE", "ECONNRESET"],
    ["MALFORMED_RESPONSE_CHUNK", "HPE_INVALID_CHUNK_SIZE"],
    ["RANDOM_DATA_THEN_CLOSE", "HPE_INVALID_CONSTANT"],
  ])("should_serve_the_%s_fault_like_wiremock", async (fault, code) => {
    const port = await serve(
      JSON.stringify({ request: { method: "GET", url: "/x" }, response: { fault } }),
    );
    const outcome = await new Promise<string>((resolve) => {
      const req = request({ host: "127.0.0.1", port, path: "/x" }, (res) => {
        res.on("data", () => undefined);
        res.on("end", () => resolve(`status ${res.statusCode}`));
        res.on("error", (e: NodeJS.ErrnoException) => resolve(e.code ?? e.message));
      });
      req.on("error", (e: NodeJS.ErrnoException) => resolve(e.code ?? e.message));
      req.end();
    });
    expect(outcome).toBe(code);
  });

  it("should_proxy_like_wiremock", async () => {
    upstream = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        res.writeHead(201, { "x-up": "1", "content-type": "application/json" });
        res.end(
          JSON.stringify({
            method: req.method,
            url: req.url,
            host: req.headers.host,
            extra: req.headers["x-extra"] ?? null,
            gone: req.headers["x-gone"] ?? null,
            kept: req.headers["x-kept"] ?? null,
            body,
          }),
        );
      });
    });
    const upstreamPort = await new Promise<number>((resolve) =>
      upstream?.listen(0, () => resolve((upstream?.address() as { port: number }).port)),
    );
    const port = await serve(
      JSON.stringify({
        request: { method: "ANY", urlPathPattern: "/.*" },
        response: {
          proxyBaseUrl: `http://localhost:${upstreamPort}`,
          proxyUrlPrefixToRemove: "/strip",
          additionalProxyRequestHeaders: { "x-extra": "e" },
          // Compared with the lower-cased request header: only the lower-case entry removes one.
          removeProxyRequestHeaders: ["x-gone", "X-Kept"],
          headers: { "x-stub": "s" },
        },
      }),
    );
    const response = await fetch(`http://127.0.0.1:${port}/strip/inner?q=1`, {
      method: "POST",
      body: "payload",
      headers: { "x-gone": "g", "x-kept": "k" },
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("x-up")).toBe("1");
    expect(response.headers.get("x-stub")).toBe("s");
    expect(response.headers.get("matched-stub-id")).toBeNull();
    expect(await response.json()).toEqual({
      method: "POST",
      url: "/inner?q=1",
      host: `localhost:${upstreamPort}`,
      extra: "e",
      gone: null,
      kept: "k",
      body: "payload",
    });
  });
});
