import { BrokerClient } from "@stubborn-sh/broker-client";

const brokerUrl = process.env["BROKER_URL"] ?? "http://localhost:18080";
const username = process.env["BROKER_USERNAME"] ?? "admin";
const password = process.env["BROKER_PASSWORD"] ?? "admin";

export async function reportVerification(
  url: string = brokerUrl,
  user: string = username,
  pass: string = password,
): Promise<void> {
  const client = new BrokerClient({ baseUrl: url, username: user, password: pass });

  const providerName = process.env["PROVIDER_NAME"] ?? "order-service";
  const providerVersion = process.env["PROVIDER_VERSION"] ?? "1.0.0";
  const consumerName = process.env["CONSUMER_NAME"] ?? "js-consumer";
  const consumerVersion = process.env["CONSUMER_VERSION"] ?? "1.0.0";

  const result = await client.recordVerification({
    providerName,
    providerVersion,
    consumerName,
    consumerVersion,
    status: "SUCCESS",
  });

  console.log("Verification recorded:", JSON.stringify(result, null, 2));

  // Show dependency graph
  const graph = await client.getDependencyGraph();
  console.log("\nDependency graph:");
  console.log(JSON.stringify(graph, null, 2));
}

// Run if executed directly
if (process.argv[1]?.endsWith("report.ts") === true || process.argv[1]?.endsWith("report.js") === true) {
  reportVerification().catch((err: unknown) => {
    console.error("Report failed:", err);
    process.exit(1);
  });
}
