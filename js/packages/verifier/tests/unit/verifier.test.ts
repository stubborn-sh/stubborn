import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLoadFromDirectory = vi.fn();
const mockLoadFromBroker = vi.fn();
const mockExecuteRequest = vi.fn();
const mockValidateResponse = vi.fn();
const mockReportResults = vi.fn();

vi.mock("../../src/contract-loader.js", () => ({
  loadFromDirectory: (...args: unknown[]) => mockLoadFromDirectory(...args),
  loadFromBroker: (...args: unknown[]) => mockLoadFromBroker(...args),
}));

vi.mock("../../src/request-executor.js", () => ({
  executeRequest: (...args: unknown[]) => mockExecuteRequest(...args),
}));

vi.mock("../../src/response-validator.js", () => ({
  validateResponse: (...args: unknown[]) => mockValidateResponse(...args),
}));

vi.mock("../../src/reporter.js", () => ({
  reportResults: (...args: unknown[]) => mockReportResults(...args),
}));

import { ContractVerifier } from "../../src/verifier.js";

describe("ContractVerifier", () => {
  const contract = {
    name: "test.yaml",
    request: { method: "GET", urlPath: "/api" },
    response: { status: 200 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadFromDirectory.mockResolvedValue([contract]);
    mockExecuteRequest.mockResolvedValue({ status: 200, headers: {}, body: {} });
    mockValidateResponse.mockReturnValue({
      valid: true,
      contractName: "test.yaml",
      failures: [],
    });
    mockReportResults.mockResolvedValue(undefined);
  });

  it("should_load_contracts_from_directory", async () => {
    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "provider",
      providerVersion: "1.0",
      consumerName: "consumer",
      consumerVersion: "1.0",
      contractsDir: "/contracts",
    });

    const result = await verifier.verify();

    expect(mockLoadFromDirectory).toHaveBeenCalledWith("/contracts");
    expect(result.passed).toBe(true);
    expect(result.totalContracts).toBe(1);
    expect(result.passedContracts).toBe(1);
    expect(result.failedContracts).toBe(0);
  });

  it("should_load_contracts_from_broker", async () => {
    const mockClient = {} as import("@stubborn-sh/broker-client").BrokerClient;
    mockLoadFromBroker.mockResolvedValue([contract]);

    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "provider",
      providerVersion: "1.0",
      consumerName: "consumer",
      consumerVersion: "1.0",
      broker: {
        client: mockClient,
        applicationName: "my-app",
        version: "2.0",
      },
    });

    await verifier.verify();
    expect(mockLoadFromBroker).toHaveBeenCalledWith(mockClient, "my-app", "2.0");
  });

  it("should_throw_when_neither_contractsDir_nor_broker_specified", async () => {
    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "provider",
      providerVersion: "1.0",
      consumerName: "consumer",
      consumerVersion: "1.0",
    });

    await expect(verifier.verify()).rejects.toThrow(
      "Either contractsDir or broker must be specified",
    );
  });

  it("should_execute_request_and_validate_for_each_contract", async () => {
    const contract2 = { ...contract, name: "test2.yaml" };
    mockLoadFromDirectory.mockResolvedValue([contract, contract2]);

    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:9090",
      providerName: "p",
      providerVersion: "1",
      consumerName: "c",
      consumerVersion: "1",
      contractsDir: "/dir",
    });

    await verifier.verify();
    expect(mockExecuteRequest).toHaveBeenCalledTimes(2);
    expect(mockValidateResponse).toHaveBeenCalledTimes(2);
    expect(mockExecuteRequest).toHaveBeenCalledWith("http://localhost:9090", contract, undefined);
  });

  it("should_report_failed_verification", async () => {
    mockValidateResponse.mockReturnValue({
      valid: false,
      contractName: "test.yaml",
      failures: [{ field: "status", expected: "200", actual: "500" }],
    });

    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "p",
      providerVersion: "1",
      consumerName: "c",
      consumerVersion: "1",
      contractsDir: "/dir",
    });

    const result = await verifier.verify();
    expect(result.passed).toBe(false);
    expect(result.failedContracts).toBe(1);
    expect(result.results[0]?.failures[0]?.field).toBe("status");
  });

  it("should_report_to_broker_when_configured", async () => {
    const reportClient = {} as import("@stubborn-sh/broker-client").BrokerClient;

    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "provider",
      providerVersion: "1.0",
      consumerName: "consumer",
      consumerVersion: "2.0",
      contractsDir: "/dir",
      reportToBroker: reportClient,
    });

    await verifier.verify();
    expect(mockReportResults).toHaveBeenCalledWith(
      reportClient,
      "provider",
      "1.0",
      "consumer",
      "2.0",
      expect.any(Array),
    );
  });

  it("should_not_report_when_reportToBroker_is_undefined", async () => {
    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "p",
      providerVersion: "1",
      consumerName: "c",
      consumerVersion: "1",
      contractsDir: "/dir",
    });

    await verifier.verify();
    expect(mockReportResults).not.toHaveBeenCalled();
  });

  it("should_pass_custom_fetch_to_executeRequest", async () => {
    const customFetch = vi.fn() as unknown as typeof globalThis.fetch;

    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "p",
      providerVersion: "1",
      consumerName: "c",
      consumerVersion: "1",
      contractsDir: "/dir",
      fetch: customFetch,
    });

    await verifier.verify();
    expect(mockExecuteRequest).toHaveBeenCalledWith("http://localhost:8080", contract, customFetch);
  });

  it("should_handle_empty_contracts", async () => {
    mockLoadFromDirectory.mockResolvedValue([]);

    const verifier = new ContractVerifier({
      providerBaseUrl: "http://localhost:8080",
      providerName: "p",
      providerVersion: "1",
      consumerName: "c",
      consumerVersion: "1",
      contractsDir: "/dir",
    });

    const result = await verifier.verify();
    expect(result.passed).toBe(true);
    expect(result.totalContracts).toBe(0);
  });
});
