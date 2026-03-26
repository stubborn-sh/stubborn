import { describe, it, expect, vi } from "vitest";

const mockVerify = vi.fn();

vi.mock("@stubborn-sh/verifier", () => ({
  ContractVerifier: class {
    verify = mockVerify;
  },
}));

import { verifyContracts } from "../../src/verify-contracts.js";

describe("verifyContracts", () => {
  it("should_pass_when_all_contracts_verified", async () => {
    mockVerify.mockResolvedValueOnce({
      passed: true,
      results: [{ valid: true, contractName: "test.yaml", failures: [] }],
      totalContracts: 1,
      passedContracts: 1,
      failedContracts: 0,
    });

    const result = await verifyContracts({
      providerBaseUrl: "http://localhost:8080",
      providerName: "provider",
      providerVersion: "1.0.0",
      consumerName: "consumer",
      consumerVersion: "1.0.0",
      contractsDir: "/contracts",
    });

    expect(result.passed).toBe(true);
    expect(result.totalContracts).toBe(1);
  });

  it("should_throw_when_contracts_fail", async () => {
    mockVerify.mockResolvedValueOnce({
      passed: false,
      results: [
        {
          valid: false,
          contractName: "test.yaml",
          failures: [{ field: "status", expected: "200", actual: "404" }],
        },
      ],
      totalContracts: 1,
      passedContracts: 0,
      failedContracts: 1,
    });

    await expect(
      verifyContracts({
        providerBaseUrl: "http://localhost:8080",
        providerName: "provider",
        providerVersion: "1.0.0",
        consumerName: "consumer",
        consumerVersion: "1.0.0",
        contractsDir: "/contracts",
      }),
    ).rejects.toThrow("Contract verification failed");
  });
});
