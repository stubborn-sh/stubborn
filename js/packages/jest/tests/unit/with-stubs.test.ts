import { describe, it, expect, vi, afterEach } from "vitest";

const mockSetContracts = vi.fn();
const mockStart = vi.fn().mockResolvedValue(54321);
const mockStop = vi.fn().mockResolvedValue(undefined);

vi.mock("@stubborn-sh/broker-client", () => ({
  BrokerClient: class {
    listContracts = vi.fn().mockResolvedValue({
      content: [
        {
          contractName: "test.yaml",
          content: "request:\n  method: GET\n  url: /api\nresponse:\n  status: 200",
          contentType: "application/x-yaml",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
  },
  fetchAllPages: vi.fn().mockResolvedValue([
    {
      contractName: "test.yaml",
      content: "request:\n  method: GET\n  url: /api\nresponse:\n  status: 200",
      contentType: "application/x-yaml",
    },
  ]),
}));

vi.mock("@stubborn-sh/stub-server", () => ({
  StubServer: class {
    setContracts = mockSetContracts;
    start = mockStart;
    stop = mockStop;
    running = false;
  },
  parseContract: vi.fn().mockReturnValue({
    name: "test.yaml",
    request: { method: "GET", url: "/api" },
    response: { status: 200 },
  }),
}));

import { withStubs } from "../../src/with-stubs.js";
import { teardownStubs } from "../../src/setup-stubs.js";

describe("withStubs", () => {
  afterEach(async () => {
    await teardownStubs();
  });

  it("should_setup_stubs_run_test_and_teardown", async () => {
    const testFn = vi.fn().mockResolvedValue(undefined);

    await withStubs(
      {
        brokerUrl: "http://localhost:8080",
        applicationName: "app",
        version: "1.0",
      },
      testFn,
    );

    expect(mockStart).toHaveBeenCalled();
    expect(testFn).toHaveBeenCalledWith(54321);
    expect(mockStop).toHaveBeenCalled();
  });

  it("should_teardown_even_when_test_throws", async () => {
    const testFn = vi.fn().mockRejectedValue(new Error("test failure"));

    await expect(
      withStubs(
        {
          brokerUrl: "http://localhost:8080",
          applicationName: "app",
          version: "1.0",
        },
        testFn,
      ),
    ).rejects.toThrow("test failure");

    expect(mockStop).toHaveBeenCalled();
  });

  it("should_pass_stub_port_to_test_function", async () => {
    let receivedPort = 0;
    await withStubs(
      {
        brokerUrl: "http://localhost:8080",
        applicationName: "app",
        version: "1.0",
      },
      async (port) => {
        receivedPort = port;
      },
    );
    expect(receivedPort).toBe(54321);
  });
});
