import { BrokerClient } from "@stubborn-sh/broker-client";
import { ContractPublisher } from "@stubborn-sh/publisher";
import { resolve } from "node:path";

const brokerUrl = process.env["BROKER_URL"] ?? "http://localhost:18080";
const username = process.env["BROKER_USERNAME"] ?? "admin";
const password = process.env["BROKER_PASSWORD"] ?? "admin";
const appName = process.env["APP_NAME"] ?? "js-verification-service";
const appVersion = process.env["APP_VERSION"] ?? "1.0.0";

export async function publishContracts(
  url: string = brokerUrl,
  user: string = username,
  pass: string = password,
  name: string = appName,
  version: string = appVersion,
): Promise<void> {
  const client = new BrokerClient({ baseUrl: url, username: user, password: pass });

  try {
    await client.registerApplication({
      name,
      owner: "js-samples",
      description: "JS Kafka producer sample — sends verification results",
    });
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

  // A per-contract 409 means the contract was already published (e.g. a re-publish
  // of the same version) — that is a benign, idempotent outcome, not a failure.
  const skipped = result.errors.filter((e) => isAlreadyExists(e.error));
  const failures = result.errors.filter((e) => !isAlreadyExists(e.error));

  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} already-published contracts for ${name}@${version}:`);
    for (const s of skipped) {
      console.log(`  - ${s.contractName}: already exists`);
    }
  }

  if (failures.length > 0) {
    console.error(`Failed to publish ${failures.length} contracts:`);
    for (const e of failures) {
      console.error(`  - ${e.contractName}: ${e.error.message}`);
    }
    process.exit(1);
  }
}

/** True when the error is a broker 409 (resource already exists). */
function isAlreadyExists(err: unknown): boolean {
  return err !== null && typeof err === "object" && "status" in err && err.status === 409;
}

if (
  process.argv[1]?.endsWith("publish.ts") === true ||
  process.argv[1]?.endsWith("publish.js") === true
) {
  publishContracts().catch((err: unknown) => {
    console.error("Publish failed:", err);
    process.exit(1);
  });
}
