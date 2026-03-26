import { BrokerClient } from "@stubborn-sh/broker-client";
import { ContractVerifier } from "@stubborn-sh/verifier";
import { resolve } from "node:path";

const brokerUrl = process.env["BROKER_URL"] ?? "http://localhost:18080";
const username = process.env["BROKER_USERNAME"] ?? "admin";
const password = process.env["BROKER_PASSWORD"] ?? "admin";
const providerUrl = process.env["PROVIDER_URL"] ?? "http://localhost:3000";
const appName = process.env["APP_NAME"] ?? "product-service";
const appVersion = process.env["APP_VERSION"] ?? "1.0.0";
const consumerName = process.env["CONSUMER_NAME"] ?? "js-producer-self-verify";
const consumerVersion = process.env["CONSUMER_VERSION"] ?? "1.0.0";

export async function verifyContracts(
  baseUrl: string = providerUrl,
  broker: string = brokerUrl,
  user: string = username,
  pass: string = password,
): Promise<boolean> {
  const client = new BrokerClient({ baseUrl: broker, username: user, password: pass });

  if (import.meta.dirname === undefined) {
    throw new Error("import.meta.dirname is not available — Node.js 21+ required");
  }

  const verifier = new ContractVerifier({
    providerBaseUrl: baseUrl,
    providerName: appName,
    providerVersion: appVersion,
    consumerName,
    consumerVersion,
    contractsDir: resolve(import.meta.dirname, "../contracts"),
    reportToBroker: client,
  });

  const result = await verifier.verify();

  console.log(`Verification: ${result.passed ? "PASSED" : "FAILED"}`);
  console.log(`  Total: ${result.totalContracts}, Passed: ${result.passedContracts}, Failed: ${result.failedContracts}`);

  for (const r of result.results) {
    const status = r.valid ? "PASS" : "FAIL";
    console.log(`  [${status}] ${r.contractName}`);
    if (!r.valid) {
      for (const f of r.failures) {
        console.log(`    - ${f.field}: expected=${f.expected}, actual=${f.actual}`);
      }
    }
  }

  return result.passed;
}

// Run if executed directly
if (process.argv[1]?.endsWith("verify.ts") === true || process.argv[1]?.endsWith("verify.js") === true) {
  verifyContracts().then((passed) => {
    if (!passed) {
      process.exit(1);
    }
  }).catch((err: unknown) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
}
