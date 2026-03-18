import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

interface Product {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly inStock: boolean;
}

let products: Product[] = [
  { id: "1", name: "MacBook Pro", price: 2499.99, inStock: true },
  { id: "2", name: "iPad Air", price: 599.99, inStock: true },
];

let nextId = 3;

/** Reset server state for test isolation. */
export function resetState(): void {
  products = [
    { id: "1", name: "MacBook Pro", price: 2499.99, inStock: true },
    { id: "2", name: "iPad Air", price: 599.99, inStock: true },
  ];
  nextId = 3;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";

  // GET /api/products/:id
  const getMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);
  if (method === "GET" && getMatch !== null) {
    const product = products.find((p) => p.id === getMatch[1]);
    if (product === undefined) {
      json(res, 404, { error: "Product not found" });
      return;
    }
    json(res, 200, product);
    return;
  }

  // POST /api/products
  if (method === "POST" && url.pathname === "/api/products") {
    const raw = await parseBody(req);
    const body = JSON.parse(raw) as { name: string; price: number };
    const product: Product = {
      id: String(nextId++),
      name: body.name,
      price: body.price,
      inStock: true,
    };
    products.push(product);
    json(res, 201, product);
    return;
  }

  json(res, 404, { error: "Not found" });
}

const port = parseInt(process.env["PORT"] ?? "3000", 10);

export const server = createServer((req, res) => {
  handler(req, res).catch((err: unknown) => {
    console.error("Request error:", err);
    json(res, 500, { error: "Internal server error" });
  });
});

export function startServer(listenPort: number = port): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, () => {
      server.removeListener("error", reject);
      const addr = server.address();
      const assignedPort = typeof addr === "object" && addr !== null ? addr.port : listenPort;
      console.log(`Product API server listening on port ${assignedPort}`);
      resolve(assignedPort);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err !== undefined) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Start if run directly
if (process.argv[1]?.endsWith("server.ts") === true || process.argv[1]?.endsWith("server.js") === true) {
  startServer();
}
