import { describe, it, expect, vi } from "vitest";
import { reportResults } from "../../src/reporter.js";
import type { ValidationResult } from "../../src/response-validator.js";

function mockClient() {
  return {
    recordVerification: vi.fn().mockResolvedValue(undefined),
  } as unknown as import("@spring-cloud-contract/broker-client").BrokerClient;
}

describe("reportResults", () => {
  it("should_report_SUCCESS_when_all_pass", async () => {
    const client = mockClient();
    const results: ValidationResult[] = [
      { valid: true, contractName: "contract1.yaml", failures: [] },
      { valid: true, contractName: "contract2.yaml", failures: [] },
    ];

    await reportResults(client, "provider", "1.0", "consumer", "2.0", results);

    expect(client.recordVerification).toHaveBeenCalledWith({
      providerName: "provider",
      providerVersion: "1.0",
      consumerName: "consumer",
      consumerVersion: "2.0",
      status: "SUCCESS",
      details: "All 2 contracts verified successfully",
    });
  });

  it("should_report_FAILED_when_any_fail", async () => {
    const client = mockClient();
    const results: ValidationResult[] = [
      { valid: true, contractName: "ok.yaml", failures: [] },
      {
        valid: false,
        contractName: "bad.yaml",
        failures: [{ field: "status", expected: "200", actual: "404" }],
      },
    ];

    await reportResults(client, "provider", "1.0", "consumer", "2.0", results);

    expect(client.recordVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED",
      }),
    );
    const call = (client.recordVerification as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, string>;
    expect(call["details"]).toContain("1/2 contracts failed");
    expect(call["details"]).toContain("bad.yaml");
    expect(call["details"]).toContain("status");
  });

  it("should_report_FAILED_when_all_fail", async () => {
    const client = mockClient();
    const results: ValidationResult[] = [
      {
        valid: false,
        contractName: "a.yaml",
        failures: [{ field: "body", expected: "{}", actual: "null" }],
      },
    ];

    await reportResults(client, "p", "1", "c", "1", results);

    const call = (client.recordVerification as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, string>;
    expect(call["status"]).toBe("FAILED");
    expect(call["details"]).toContain("1/1 contracts failed");
  });

  it("should_include_failure_details_in_message", async () => {
    const client = mockClient();
    const results: ValidationResult[] = [
      {
        valid: false,
        contractName: "test.yaml",
        failures: [
          { field: "status", expected: "200", actual: "500" },
          { field: "header[Content-Type]", expected: "application/json", actual: "(missing)" },
        ],
      },
    ];

    await reportResults(client, "p", "1", "c", "1", results);

    const call = (client.recordVerification as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, string>;
    expect(call["details"]).toContain("status expected 200 but was 500");
    expect(call["details"]).toContain("header[Content-Type]");
  });

  it("should_handle_empty_results", async () => {
    const client = mockClient();
    await reportResults(client, "p", "1", "c", "1", []);

    expect(client.recordVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SUCCESS",
        details: "All 0 contracts verified successfully",
      }),
    );
  });
});
