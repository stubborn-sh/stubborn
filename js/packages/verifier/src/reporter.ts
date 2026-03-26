import type { BrokerClient, VerificationStatus } from "@stubborn-sh/broker-client";
import type { ValidationResult } from "./response-validator.js";

/** Report verification results to the broker. */
export async function reportResults(
  client: BrokerClient,
  providerName: string,
  providerVersion: string,
  consumerName: string,
  consumerVersion: string,
  results: readonly ValidationResult[],
): Promise<void> {
  const allPassed = results.every((r) => r.valid);
  const status: VerificationStatus = allPassed ? "SUCCESS" : "FAILED";

  const failedContracts = results
    .filter((r) => !r.valid)
    .map(
      (r) =>
        `${r.contractName}: ${r.failures.map((f) => `${f.field} expected ${f.expected} but was ${f.actual}`).join(", ")}`,
    )
    .join("; ");

  const details = allPassed
    ? `All ${String(results.length)} contracts verified successfully`
    : `${String(results.filter((r) => !r.valid).length)}/${String(results.length)} contracts failed: ${failedContracts}`;

  await client.recordVerification({
    providerName,
    providerVersion,
    consumerName,
    consumerVersion,
    status,
    details,
  });
}
