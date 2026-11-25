import { readFileSync } from "node:fs";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { contractFileReader } from "../../src/directory-loader.js";
import { parseContracts } from "../../src/contract-parser.js";
import { StubServer } from "../../src/stub-server.js";

/**
 * stub-server, serving YAML contracts, answers like WireMock serving the mappings the JVM
 * generates for them. `behaviour.json` holds WireMock 3.13.2's answers (with the stub runner's
 * extensions) to each contract's own request and variations of it, recorded by
 * `record-behaviour.mjs` from `jvm-mappings.json`; here the same requests go to stub-server.
 */
interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: readonly (readonly [string, string])[];
  readonly body?: string;
}

/**
 * WireMock's answer: a dropped connection (a fault), no stub matched (404), a stub that failed
 * to render (a template error, 500), or a stub's response.
 */
type WireMockAnswer =
  | { readonly error: true }
  | { readonly matched: null; readonly status: number }
  | { readonly failed: true; readonly status: number }
  | {
      readonly matched: number;
      readonly status: number;
      readonly headers: Readonly<Record<string, string | readonly string[]>>;
      readonly body?: string;
      readonly bodyBase64?: string;
    };

interface Recorded {
  readonly cases: readonly {
    readonly file: string;
    readonly requests: readonly {
      readonly label: string;
      readonly request: RecordedRequest;
      readonly wiremock: WireMockAnswer;
    }[];
  }[];
}

const ROOT = new URL("../fixtures/yaml-to-wiremock/", import.meta.url);
const recorded = JSON.parse(readFileSync(new URL("behaviour.json", ROOT), "utf8")) as Recorded;

interface Answer {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
}

/** Sends a request exactly as the recorder sent it to WireMock. */
function send(port: number, r: RecordedRequest): Promise<Answer | "error"> {
  return new Promise((resolve) => {
    const payload = r.body === undefined ? undefined : Buffer.from(r.body, "base64");
    const headers: Record<string, string[]> = {};
    for (const [name, value] of r.headers) (headers[name] ??= []).push(value);
    const req = httpRequest(
      new URL(r.path, `http://127.0.0.1:${port}`),
      {
        method: r.method,
        agent: false,
        headers: {
          ...headers,
          ...(payload !== undefined ? { "Content-Length": String(payload.length) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", () => resolve("error"));
      },
    );
    req.on("error", () => resolve("error"));
    req.end(payload);
  });
}

describe("YAML contracts served like WireMock serves the JVM's mappings", () => {
  it("records a meaningful number of exchanges", () => {
    const all = recorded.cases.flatMap((c) => c.requests);
    expect(all.length).toBeGreaterThan(700);
    expect(
      all.filter((r) => "matched" in r.wiremock && r.wiremock.matched !== null).length,
    ).toBeGreaterThan(150);
  });

  for (const { file, requests } of recorded.cases) {
    describe(file, () => {
      const server = new StubServer();
      let port = 0;
      beforeAll(async () => {
        const path = fileURLToPath(new URL(file, ROOT));
        server.setContracts(
          parseContracts(file.split("/").pop() ?? file, readFileSync(path, "utf8"), {
            readFile: contractFileReader(path),
          }),
        );
        port = await server.start();
      });
      afterAll(async () => {
        await server.stop();
      });

      it.each(requests.map((r) => [r.label, r] as const))(
        "%s",
        async (_label, { request, wiremock }) => {
          const answer = await send(port, request);
          if ("error" in wiremock) {
            // A fault: WireMock drops the connection.
            expect(answer).toBe("error");
            return;
          }
          expect(answer).not.toBe("error");
          if (answer === "error") return;
          if ("failed" in wiremock) {
            // The stub matched but its response cannot be rendered: both answer 500 (the error
            // pages differ).
            expect(answer.status).toBe(wiremock.status);
            return;
          }
          if (wiremock.matched === null) {
            expect(answer.status).toBe(404);
            expect(JSON.parse(answer.body.toString("utf8"))).toMatchObject({
              error: "No matching contract found",
            });
            return;
          }
          expect(answer.status).toBe(wiremock.status);
          for (const [name, value] of Object.entries(wiremock.headers)) {
            expect(answer.headers[name], name).toEqual(value);
          }
          if (wiremock.bodyBase64 !== undefined) {
            expect(answer.body.toString("base64")).toBe(wiremock.bodyBase64);
          } else {
            expect(answer.body.toString("utf8")).toBe(wiremock.body ?? "");
          }
        },
      );
    });
  }

  it("serves a contract with a lower-case method, unlike WireMock (a deliberate difference)", async () => {
    // The JVM writes `method: post` as is, and WireMock compares methods case-sensitively, so
    // its stub never matches; stub-server upper-cases the method of every mapping.
    const file = "cases/f29_method_lower.yml";
    const path = fileURLToPath(new URL(file, ROOT));
    const contracts = parseContracts("f29_method_lower.yml", readFileSync(path, "utf8"));
    expect(contracts[0]?.wireMockMapping?.["request"]).toMatchObject({ method: "post" });
    const server = new StubServer();
    server.setContracts(contracts);
    const port = await server.start();
    try {
      const answer = await send(port, {
        method: "POST",
        path: "/lower?a=1",
        headers: [],
        body: Buffer.from("plain").toString("base64"),
      });
      expect(answer).not.toBe("error");
      if (answer !== "error") expect(answer.status).toBe(202);
    } finally {
      await server.stop();
    }
  });
});
