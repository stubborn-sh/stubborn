import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type {
  ContractResponse,
  DelayDistribution,
  ParsedContract,
  ResponseFault,
} from "./contract-parser.js";
import { matchRequest } from "./request-matcher.js";
import { buildResponse, type BuiltResponse } from "./response-builder.js";
import { ResponseTemplateError } from "./response-template.js";

/** Configuration for the stub server. */
export interface StubServerConfig {
  /** Port to listen on (0 for random). */
  readonly port?: number;
  /** Host to bind to (default: "127.0.0.1"). */
  readonly host?: string;
}

/** WireMock's priority for a mapping that sets none. */
const DEFAULT_PRIORITY = 5;

/** HTTP stub server that responds based on parsed contracts. */

export class StubServer {
  private server: Server | null = null;
  private contracts: ParsedContract[] = [];
  private readonly port: number;
  private readonly host: string;

  constructor(config?: StubServerConfig) {
    this.port = config?.port ?? 0;
    this.host = config?.host ?? "127.0.0.1";
  }

  /**
   * Load contracts to serve, in WireMock's order: by priority (lower number first; unset means
   * WireMock's default, 5), and among equal priorities the one loaded last first.
   */
  setContracts(contracts: readonly ParsedContract[]): void {
    this.contracts = contracts
      .map((contract, index) => ({ contract, index }))
      .sort(
        (a, b) =>
          (a.contract.priority ?? DEFAULT_PRIORITY) - (b.contract.priority ?? DEFAULT_PRIORITY) ||
          b.index - a.index,
      )
      .map(({ contract }) => contract);
  }

  /** Start the stub server. Returns the assigned port. */
  async start(): Promise<number> {
    if (this.server !== null) {
      throw new Error("Stub server is already running");
    }

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err: unknown) => {
          // Never let one request take the server down: answer 500 instead.
          if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Internal stub-server error",
              message: err instanceof Error ? err.message : String(err),
            }),
          );
        });
      });

      server.on("error", reject);

      server.listen(this.port, this.host, () => {
        const address = server.address();
        if (address === null || typeof address === "string") {
          reject(new Error("Failed to get server address"));
          return;
        }
        this.server = server;
        resolve(address.port);
      });
    });
  }

  /** Stop the stub server. */
  async stop(): Promise<void> {
    if (this.server === null) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server?.close((err) => {
        this.server = null;
        if (err !== undefined) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /** Whether the server is currently running. */
  get running(): boolean {
    return this.server !== null;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }

    let body: unknown = undefined;
    let rawBody: string | undefined;
    let bodyBytes: Buffer | undefined;
    // Read the body whatever the method: WireMock matches GET bodies too, and SCC generates
    // body patterns for GET contracts that have one.
    try {
      bodyBytes = await readBody(req);
      rawBody = bodyBytes.toString("utf-8");
      if (rawBody !== "") {
        const contentType = headers["content-type"] ?? "";
        if (contentType.includes("json")) {
          body = JSON.parse(rawBody);
        }
      }
    } catch {
      // ignore body parse errors
    }

    const result = matchRequest(
      method,
      url,
      req.headersDistinct,
      body,
      this.contracts,
      rawBody,
      bodyBytes,
    );

    if (!result.matched || result.contract === null) {
      res.writeHead(404, { "Content-Type": "application/json" });
      const skipped = this.contracts
        .filter((c) => c.unsupportedMatchers !== undefined)
        .map((c) => ({ contract: c.name, unsupportedMatchers: c.unsupportedMatchers }));
      res.end(
        JSON.stringify({
          error: "No matching contract found",
          method,
          url,
          // Stubs that can never match here because they use matchers stub-server cannot evaluate.
          ...(skipped.length > 0 ? { skippedStubs: skipped } : {}),
        }),
      );
      return;
    }

    const stubResponse = result.contract.response;
    if (stubResponse.fault !== undefined) {
      applyFault(res, stubResponse.fault);
      return;
    }

    // WireMock adds the fixed delay and a sample of the delay distribution.
    const delayMs = (stubResponse.delayMs ?? 0) + sampleDelay(stubResponse.delayDistribution);
    if (delayMs > 0) {
      await delay(delayMs);
    }

    if (stubResponse.proxy !== undefined) {
      await proxy(req, res, url, bodyBytes, stubResponse);
      return;
    }

    let response: BuiltResponse;
    try {
      response = buildResponse(result.contract.response, {
        method,
        url,
        headers: req.headersDistinct as Record<string, string[]>,
        body: rawBody ?? "",
      });
    } catch (err: unknown) {
      if (!(err instanceof ResponseTemplateError)) throw err;
      // Like WireMock: a template that cannot be rendered is a server error, never served as text.
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Response template error",
          contract: result.contract.name,
          message: err.message,
        }),
      );
      return;
    }
    res.writeHead(response.status, { ...response.headers, ...matchedStubHeaders(stubResponse) });
    const dribble = stubResponse.chunkedDribbleDelay;
    if (response.body !== null && dribble !== undefined && dribble.numberOfChunks > 1) {
      await writeDribbled(res, Buffer.from(response.body), dribble);
    } else if (response.body !== null) {
      res.end(response.body);
    } else {
      res.end();
    }
  }
}

/** WireMock's `Matched-Stub-Id` / `Matched-Stub-Name` headers (the name made ASCII). */
function matchedStubHeaders(response: ContractResponse): Record<string, string> {
  const stub = response.matchedStub;
  if (stub === undefined) return {};
  return {
    "Matched-Stub-Id": stub.id,
    ...(stub.name !== undefined
      ? {
          "Matched-Stub-Name": [...stub.name]
            .map((c) => (c.charCodeAt(0) < 0x80 ? c : "?"))
            .join(""),
        }
      : {}),
  };
}

/** WireMock's faults, as its Jetty fault injector applies them. */
function applyFault(res: ServerResponse, fault: ResponseFault): void {
  const socket = res.socket;
  if (socket === null) return;
  switch (fault) {
    case "CONNECTION_RESET_BY_PEER":
      socket.resetAndDestroy();
      return;
    case "EMPTY_RESPONSE":
      socket.destroy();
      return;
    case "MALFORMED_RESPONSE_CHUNK":
      socket.end(
        "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nlskdu018973t09sylgasjkfg1][]'./.sdlv",
      );
      return;
    case "RANDOM_DATA_THEN_CLOSE":
      socket.end(randomBytes(1024));
      return;
  }
}

/** A sample of a WireMock delay distribution, in milliseconds. */
function sampleDelay(distribution: DelayDistribution | undefined): number {
  if (distribution === undefined) return 0;
  switch (distribution.type) {
    case "fixed":
      return distribution.milliseconds;
    case "uniform":
      return (
        distribution.lower +
        Math.floor(Math.random() * (distribution.upper - distribution.lower + 1))
      );
    case "lognormal": {
      const sample = (): number =>
        Math.round(Math.exp(gaussian() * distribution.sigma) * distribution.median);
      let value = sample();
      if (distribution.maxValue === undefined) return value;
      // WireMock resamples a value over the maximum a few times, then truncates.
      for (let i = 0; value > distribution.maxValue && i < 10; i++) value = sample();
      return Math.round(Math.min(distribution.maxValue, value));
    }
  }
}

function gaussian(): number {
  // Box-Muller.
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Send a body in `numberOfChunks` pieces, each after an equal share of `totalDuration`. */
async function writeDribbled(
  res: ServerResponse,
  body: Buffer,
  dribble: { readonly numberOfChunks: number; readonly totalDuration: number },
): Promise<void> {
  const size = Math.max(1, Math.ceil(body.length / dribble.numberOfChunks));
  const interval = dribble.totalDuration / dribble.numberOfChunks;
  for (let offset = 0; offset < body.length; offset += size) {
    await delay(interval);
    res.write(body.subarray(offset, offset + size));
  }
  res.end();
}

/** Request headers WireMock's HTTP client never forwards. */
const UNFORWARDED_REQUEST_HEADERS = new Set([
  "transfer-encoding",
  "content-length",
  "connection",
  "upgrade",
  "user-agent",
]);
/** Response headers WireMock never copies from the upstream response. */
const UNFORWARDED_RESPONSE_HEADERS = new Set(["transfer-encoding", "connection"]);

/**
 * Forward the request as WireMock's proxy does: to `proxyBaseUrl` plus the request URL (less
 * `proxyUrlPrefixToRemove`), with the Host of the base URL, and serve the upstream response
 * followed by the stub's own headers.
 */
async function proxy(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
  body: Buffer | undefined,
  response: ContractResponse,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked by the caller
  const settings = response.proxy!;
  const prefix = settings.urlPrefixToRemove;
  const target =
    settings.baseUrl +
    (prefix !== undefined && url.startsWith(prefix) ? url.slice(prefix.length) : url);
  const headers = new Headers();
  for (const [key, values] of Object.entries(req.headersDistinct)) {
    const lower = key.toLowerCase();
    if (values === undefined || UNFORWARDED_REQUEST_HEADERS.has(lower)) continue;
    // WireMock compares the lower-cased header name with the entries as written.
    if (settings.removeRequestHeaders?.includes(lower) === true) continue;
    if (lower === "host") headers.set("host", new URL(settings.baseUrl).host);
    else for (const value of values) headers.append(key, value);
  }
  for (const [key, value] of Object.entries(settings.additionalRequestHeaders ?? {})) {
    headers.set(key, value);
  }
  const method = req.method ?? "GET";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      redirect: "manual",
      ...(body !== undefined && body.length > 0 && method !== "GET" && method !== "HEAD"
        ? { body: new Uint8Array(body) }
        : {}),
    });
  } catch (err: unknown) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(
      `Network failure trying to make a proxied request from WireMock to ${target}\r\n${String(err)}`,
    );
    return;
  }
  const out: Record<string, string[]> = {};
  upstream.headers.forEach((value, key) => {
    // fetch decodes the body, so its encoding and length no longer apply.
    if (
      UNFORWARDED_RESPONSE_HEADERS.has(key) ||
      key === "content-encoding" ||
      key === "content-length"
    ) {
      return;
    }
    (out[key] ??= []).push(value);
  });
  for (const [key, value] of Object.entries(response.headers ?? {})) {
    (out[key.toLowerCase()] ??= []).push(...(Array.isArray(value) ? (value as string[]) : [value]));
  }
  res.writeHead(upstream.status, out);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

/** Maximum request body size (1 MB). */
const MAX_BODY_SIZE = 1024 * 1024;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
