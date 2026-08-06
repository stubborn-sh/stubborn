import { BrokerClient } from "@stubborn-sh/broker-client";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

/**
 * Seeds the broker with everything this consumer sample assumes to already exist.
 *
 * The `-Psamples` exec sequence runs the js-consumer integration test on the
 * `samples` aggregator POM, which is built BEFORE its child modules
 * (maven-producer et al.) in the reactor. As a result the Java `order-service`
 * producer has NOT yet published its contracts when this test runs, so nothing
 * would be in the broker for `setupStubs` to fetch. This helper makes the sample
 * self-contained by publishing the order-service contracts itself.
 *
 * All operations are idempotent: a re-run (or shared broker state) yields HTTP
 * 409 "already exists", which is tolerated with the same narrowing pattern used
 * across the JS samples.
 */

const PROVIDER_NAME = "order-service";
const PROVIDER_VERSION = "1.0.0";
const CONSUMER_NAME = "js-consumer";

/** True when the error is a broker 409 (resource already exists). */
function isAlreadyExists(err: unknown): boolean {
  return err !== null && typeof err === "object" && "status" in err && err.status === 409;
}

/** Recursively collect YAML contract files under a directory. */
async function collectContracts(
  rootDir: string,
  currentDir: string = rootDir,
): Promise<readonly { readonly name: string; readonly content: string }[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const contracts: { name: string; content: string }[] = [];
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      contracts.push(...(await collectContracts(rootDir, fullPath)));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
      const content = await readFile(fullPath, "utf-8");
      const name = relative(rootDir, fullPath).replace(/\\/g, "/");
      contracts.push({ name, content });
    }
  }
  return contracts;
}

/**
 * Registers the provider (`order-service`) and consumer (`js-consumer`)
 * applications and publishes the order-service contracts to the broker.
 * Safe to call repeatedly.
 */
export async function seedBroker(
  brokerUrl: string,
  username: string,
  password: string,
): Promise<void> {
  const client = new BrokerClient({ baseUrl: brokerUrl, username, password });

  const register = async (name: string, description: string): Promise<void> => {
    try {
      await client.registerApplication({ name, owner: "js-samples", description });
      console.log(`Registered application: ${name}`);
    } catch (err: unknown) {
      if (isAlreadyExists(err)) {
        console.log(`Application already registered: ${name}`);
      } else {
        throw err;
      }
    }
  };

  // Provider must exist before its contracts can be published and before a
  // verification can be recorded against it.
  await register(PROVIDER_NAME, "Sample Order Service (seeded by js-consumer)");

  if (import.meta.dirname === undefined) {
    throw new Error("import.meta.dirname is not available — Node.js 21+ required");
  }
  const contractsDir = resolve(import.meta.dirname, "../contracts");
  const contracts = await collectContracts(contractsDir);

  for (const contract of contracts) {
    try {
      await client.publishContract(PROVIDER_NAME, PROVIDER_VERSION, {
        contractName: contract.name,
        content: contract.content,
        contentType: "application/x-yaml",
      });
      console.log(`Published contract: ${PROVIDER_NAME}@${PROVIDER_VERSION} ${contract.name}`);
    } catch (err: unknown) {
      if (isAlreadyExists(err)) {
        console.log(`Contract already published: ${contract.name}`);
      } else {
        throw err;
      }
    }
  }

  // The consumer application is the subject of recordVerification later in the
  // test; the broker rejects a verification record with a 404 if it is missing.
  await register(CONSUMER_NAME, "JS Order API consumer sample");
}
