import { describe, it, expect, vi } from "vitest";
import { ContractPublisher } from "../../src/publisher.js";
import type { BrokerClient, ContractResponse } from "@stubborn-sh/broker-client";

function mockClient(
  publishFn?: (appName: string, version: string, req: unknown) => Promise<ContractResponse>,
): BrokerClient {
  return {
    publishContract:
      publishFn ??
      vi.fn().mockResolvedValue({
        id: "1",
        contractName: "test.yaml",
        version: "1.0.0",
        content: "",
        contentType: "application/x-yaml",
        createdAt: "2026-01-01",
      }),
  } as unknown as BrokerClient;
}

// We need to mock scanContracts since publisher depends on it
vi.mock("../../src/scanner.js", () => ({
  scanContracts: vi.fn(),
}));

import { scanContracts } from "../../src/scanner.js";
const mockScan = vi.mocked(scanContracts);

describe("ContractPublisher", () => {
  it("should_publish_scanned_contracts", async () => {
    const publishFn = vi.fn().mockResolvedValue({
      id: "1",
      contractName: "test.yaml",
      version: "1.0.0",
      content: "content",
      contentType: "application/x-yaml",
      createdAt: "2026-01-01",
    });
    const client = mockClient(publishFn);
    const publisher = new ContractPublisher(client);

    mockScan.mockResolvedValueOnce([
      {
        contractName: "test.yaml",
        content: "request:\n  method: GET",
        contentType: "application/x-yaml",
      },
    ]);

    const result = await publisher.publish({
      applicationName: "my-app",
      version: "1.0.0",
      contractsDir: "/contracts",
    });

    expect(result.published).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(publishFn).toHaveBeenCalledWith("my-app", "1.0.0", {
      contractName: "test.yaml",
      content: "request:\n  method: GET",
      contentType: "application/x-yaml",
    });
  });

  it("should_return_empty_when_no_contracts_found", async () => {
    const publisher = new ContractPublisher(mockClient());
    mockScan.mockResolvedValueOnce([]);

    const result = await publisher.publish({
      applicationName: "my-app",
      version: "1.0.0",
      contractsDir: "/empty",
    });

    expect(result.published).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should_capture_errors_without_failing_others", async () => {
    const publishFn = vi
      .fn()
      .mockResolvedValueOnce({
        id: "1",
        contractName: "good.yaml",
        version: "1.0.0",
        content: "",
        contentType: "application/x-yaml",
        createdAt: "2026-01-01",
      })
      .mockRejectedValueOnce(new Error("Conflict"));
    const client = mockClient(publishFn);
    const publisher = new ContractPublisher(client);

    mockScan.mockResolvedValueOnce([
      { contractName: "good.yaml", content: "c1", contentType: "application/x-yaml" },
      { contractName: "bad.yaml", content: "c2", contentType: "application/x-yaml" },
    ]);

    const result = await publisher.publish({
      applicationName: "my-app",
      version: "1.0.0",
      contractsDir: "/contracts",
    });

    expect(result.published).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.contractName).toBe("bad.yaml");
    expect(result.errors[0]?.error.message).toBe("Conflict");
  });

  it("should_publish_one_contract", async () => {
    const publishFn = vi.fn().mockResolvedValue({
      id: "1",
      contractName: "single.yaml",
      version: "1.0.0",
      content: "c",
      contentType: "application/x-yaml",
      createdAt: "2026-01-01",
    });
    const client = mockClient(publishFn);
    const publisher = new ContractPublisher(client);

    const result = await publisher.publishOne("my-app", "1.0.0", {
      contractName: "single.yaml",
      content: "content",
      contentType: "application/x-yaml",
    });

    expect(result.contractName).toBe("single.yaml");
  });
});
