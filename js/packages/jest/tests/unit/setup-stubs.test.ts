import { describe, it, expect, vi, afterEach } from "vitest";

const mockSetContracts = vi.fn();
const mockStart = vi.fn().mockResolvedValue(12345);
const mockStop = vi.fn().mockResolvedValue(undefined);

vi.mock("@spring-cloud-contract/broker-client", () => ({
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

vi.mock("@spring-cloud-contract/stub-server", () => ({
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
  loadFromDirectory: vi.fn().mockResolvedValue([
    {
      name: "local.yaml",
      request: { method: "GET", urlPath: "/api/local" },
      response: { status: 200 },
    },
  ]),
}));

vi.mock("../../src/jar-fetcher.js", () => ({
  fetchStubsJar: vi.fn().mockResolvedValue([
    {
      name: "jar-mapping.json",
      request: { method: "GET", urlPath: "/api/jar" },
      response: { status: 200 },
    },
  ]),
  loadLocalJar: vi.fn().mockResolvedValue([
    {
      name: "local-jar-mapping.json",
      request: { method: "GET", urlPath: "/api/local-jar" },
      response: { status: 200 },
    },
  ]),
}));

import { setupStubs, teardownStubs, getStubPort } from "../../src/setup-stubs.js";
import { loadFromDirectory } from "@spring-cloud-contract/stub-server";
import { fetchStubsJar, loadLocalJar } from "../../src/jar-fetcher.js";

describe("setupStubs", () => {
  afterEach(async () => {
    await teardownStubs();
  });

  it("should_start_stub_server_from_broker_and_return_port", async () => {
    const port = await setupStubs({
      brokerUrl: "http://localhost:8080",
      applicationName: "my-app",
      version: "1.0.0",
    });
    expect(port).toBe(12345);
    expect(getStubPort()).toBe(12345);
  });

  it("should_load_from_local_contracts_directory", async () => {
    const port = await setupStubs({
      contractsDir: "./contracts",
    });

    expect(port).toBe(12345);
    expect(loadFromDirectory).toHaveBeenCalledWith("./contracts", "contracts");
    expect(mockSetContracts).toHaveBeenCalledWith([
      {
        name: "local.yaml",
        request: { method: "GET", urlPath: "/api/local" },
        response: { status: 200 },
      },
    ]);
  });

  it("should_load_from_local_wiremock_mappings_directory", async () => {
    const port = await setupStubs({
      mappingsDir: "./mappings",
    });

    expect(port).toBe(12345);
    expect(loadFromDirectory).toHaveBeenCalledWith("./mappings", "wiremock");
  });

  it("should_load_from_maven_stubs_jar", async () => {
    const port = await setupStubs({
      stubsJar: {
        repositoryUrl: "https://repo.example.com",
        groupId: "com.example",
        artifactId: "order-service",
        version: "1.0.0",
      },
    });

    expect(port).toBe(12345);
    expect(fetchStubsJar).toHaveBeenCalledWith({
      repositoryUrl: "https://repo.example.com",
      groupId: "com.example",
      artifactId: "order-service",
      version: "1.0.0",
    });
  });

  it("should_load_from_local_stubs_jar", async () => {
    const port = await setupStubs({
      jarPath: "/path/to/stubs.jar",
    });

    expect(port).toBe(12345);
    expect(loadLocalJar).toHaveBeenCalledWith("/path/to/stubs.jar");
    expect(mockSetContracts).toHaveBeenCalledWith([
      {
        name: "local-jar-mapping.json",
        request: { method: "GET", urlPath: "/api/local-jar" },
        response: { status: 200 },
      },
    ]);
  });

  it("should_use_custom_port", async () => {
    mockStart.mockResolvedValueOnce(9999);

    const port = await setupStubs({
      contractsDir: "./contracts",
      port: 9999,
    });

    expect(port).toBe(9999);
  });

  it("should_throw_on_invalid_config", async () => {
    await expect(setupStubs({ port: 8080 } as never)).rejects.toThrow("Invalid stubs config");
  });
});

describe("teardownStubs", () => {
  it("should_not_throw_when_called_without_setup", async () => {
    await teardownStubs();
    expect(getStubPort()).toBe(0);
  });
});
