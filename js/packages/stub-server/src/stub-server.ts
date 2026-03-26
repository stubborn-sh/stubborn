import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { ParsedContract } from "./contract-parser.js";
import { matchRequest } from "./request-matcher.js";
import { buildResponse } from "./response-builder.js";

/** Configuration for the stub server. */
export interface StubServerConfig {
  /** Port to listen on (0 for random). */
  readonly port?: number;
  /** Host to bind to (default: "127.0.0.1"). */
  readonly host?: string;
}

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

  /** Load contracts to serve. Sorts by priority (lower number = higher priority). */
  setContracts(contracts: readonly ParsedContract[]): void {
    this.contracts = [...contracts].sort((a, b) => {
      const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
      const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
      return pa - pb;
    });
  }

  /** Start the stub server. Returns the assigned port. */
  async start(): Promise<number> {
    if (this.server !== null) {
      throw new Error("Stub server is already running");
    }

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        void this.handleRequest(req, res);
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
    if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
      try {
        rawBody = await readBody(req);
        if (rawBody !== "") {
          const contentType = headers["content-type"] ?? "";
          if (contentType.includes("json")) {
            body = JSON.parse(rawBody);
          }
        }
      } catch {
        // ignore body parse errors
      }
    }

    const result = matchRequest(method, url, headers, body, this.contracts, rawBody);

    if (!result.matched || result.contract === null) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No matching contract found", method, url }));
      return;
    }

    // Simulate response delay if configured
    const delayMs = result.contract.response.delayMs;
    if (delayMs !== undefined && delayMs > 0) {
      await delay(delayMs);
    }

    const response = buildResponse(result.contract.response);
    res.writeHead(response.status, response.headers);
    if (response.body !== null) {
      res.end(response.body);
    } else {
      res.end();
    }
  }
}

/** Maximum request body size (1 MB). */
const MAX_BODY_SIZE = 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
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
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
