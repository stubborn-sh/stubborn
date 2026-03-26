import {
  ContractVerifier,
  type VerifierConfig,
  type VerificationResult,
} from "@stubborn-sh/verifier";

/**
 * Verify contracts against a provider.
 * Designed to be called from a test suite.
 * Throws if any contract verification fails.
 */
export async function verifyContracts(config: VerifierConfig): Promise<VerificationResult> {
  const verifier = new ContractVerifier(config);
  const result = await verifier.verify();

  if (!result.passed) {
    const failures = result.results
      .filter((r) => !r.valid)
      .map(
        (r) =>
          `  ${r.contractName}:\n${r.failures.map((f) => `    - ${f.field}: expected ${f.expected}, got ${f.actual}`).join("\n")}`,
      )
      .join("\n");

    throw new Error(
      `Contract verification failed: ${String(result.failedContracts)}/${String(result.totalContracts)} contracts failed:\n${failures}`,
    );
  }

  return result;
}
