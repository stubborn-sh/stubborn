import { setupStubs, teardownStubs } from "@stubborn-sh/jest";
import { OrderServiceClient } from "./client.js";

const brokerUrl = process.env["BROKER_URL"] ?? "http://localhost:18080";
const username = process.env["BROKER_USERNAME"] ?? "reader";
const password = process.env["BROKER_PASSWORD"] ?? "reader";
const appName = process.env["APP_NAME"] ?? "order-service";
const appVersion = process.env["APP_VERSION"] ?? "1.0.0";

export async function consumeStubs(
  url: string = brokerUrl,
  user: string = username,
  pass: string = password,
  name: string = appName,
  version: string = appVersion,
): Promise<void> {
  console.log(`Fetching stubs for ${name}@${version} from ${url}...`);

  const port = await setupStubs({
    brokerUrl: url,
    applicationName: name,
    version,
    username: user,
    password: pass,
  });

  console.log(`Stub server started on port ${port}`);

  try {
    const client = new OrderServiceClient(`http://localhost:${port}`);
    const order = await client.getOrder("1");
    console.log("GET /api/orders/1 response:", JSON.stringify(order, null, 2));

    const created = await client.createOrder("iPhone 16", 999.99);
    console.log("POST /api/orders response:", JSON.stringify(created, null, 2));
  } finally {
    await teardownStubs();
    console.log("Stub server stopped");
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith("consume-stubs.ts") === true || process.argv[1]?.endsWith("consume-stubs.js") === true) {
  consumeStubs().catch((err: unknown) => {
    console.error("Consume stubs failed:", err);
    process.exit(1);
  });
}
