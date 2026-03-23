import { BrokerClient } from "@stubborn-sh/broker-client";
import { ContractPublisher } from "@stubborn-sh/publisher";
import { resolve } from "node:path";

const brokerUrl = process.env["BROKER_URL"] ?? "http://localhost:18080";
const username = process.env["BROKER_USERNAME"] ?? "admin";
const password = process.env["BROKER_PASSWORD"] ?? "admin";
const appName = process.env["APP_NAME"] ?? "product-service";
const appVersion = process.env["APP_VERSION"] ?? "1.0.0";

export async function publishContracts(
  url: string = brokerUrl,
  user: string = username,
  pass: string = password,
  name: string = appName,
  version: string = appVersion,
): Promise<void> {
  const client = new BrokerClient({ baseUrl: url, username: user, password: pass });

  // Register the application first (ignore conflict if already exists)
  try {
    await client.registerApplication({ name, owner: "js-samples", description: "JS Product API sample" });
    console.log(`Registered application: ${name}`);
  } catch (err: unknown) {
    if (err !== null && typeof err === "object" && "status" in err && err.status === 409) {
      console.log(`Application already registered: ${name}`);
    } else {
      throw err;
    }
  }

  const publisher = new ContractPublisher(client);
  if (import.meta.dirname === undefined) {
    throw new Error("import.meta.dirname is not available — Node.js 21+ required");
  }
  const contractsDir = resolve(import.meta.dirname, "../contracts");
  const result = await publisher.publish({
    applicationName: name,
    version,
    contractsDir,
  });

  console.log(`Published ${result.published.length} contracts for ${name}@${version}`);
  for (const c of result.published) {
    console.log(`  - ${c.contractName}`);
  }
  if (result.errors.length > 0) {
    console.error(`Failed to publish ${result.errors.length} contracts:`);
    for (const e of result.errors) {
      console.error(`  - ${e.contractName}: ${e.error.message}`);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith("publish.ts") === true || process.argv[1]?.endsWith("publish.js") === true) {
  publishContracts().catch((err: unknown) => {
    console.error("Publish failed:", err);
    process.exit(1);
  });
}
