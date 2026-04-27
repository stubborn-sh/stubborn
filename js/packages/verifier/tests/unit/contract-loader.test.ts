import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReaddir = vi.fn();
const mockReadFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

vi.mock("@stubborn-sh/stub-server", () => ({
  parseContract: vi.fn().mockImplementation((name: string) => ({
    name,
    request: { method: "GET", urlPath: "/api" },
    response: { status: 200 },
  })),
  looksLikeOpenApi: vi.fn().mockImplementation((content: string) => {
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      return trimmed.startsWith("openapi") || trimmed.startsWith("swagger");
    }
    return false;
  }),
  parseOpenApiContracts: vi.fn().mockImplementation((name: string) => [
    { name: `${name}#oa-1`, request: { method: "GET", urlPath: "/oa" }, response: { status: 200 } },
    { name: `${name}#oa-2`, request: { method: "GET", urlPath: "/oa" }, response: { status: 400 } },
  ]),
}));

vi.mock("@stubborn-sh/broker-client", () => ({
  fetchAllPages: vi.fn().mockResolvedValue([
    {
      contractName: "contract1.yaml",
      content: "request:\n  method: GET\n  url: /api\nresponse:\n  status: 200",
      contentType: "application/x-yaml",
    },
    {
      contractName: "contract2.json",
      content: "{}",
      contentType: "application/json",
    },
  ]),
}));

import { loadFromDirectory, loadFromBroker } from "../../src/contract-loader.js";
import type { BrokerClient } from "@stubborn-sh/broker-client";

describe("loadFromDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should_load_yaml_files_from_directory", async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: "contract.yaml", isFile: () => true, isDirectory: () => false },
      { name: "contract.yml", isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValue(
      "request:\n  method: GET\n  url: /api\nresponse:\n  status: 200",
    );

    const contracts = await loadFromDirectory("/contracts");
    expect(contracts).toHaveLength(2);
  });

  it("should_skip_non_yaml_files", async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: "readme.md", isFile: () => true, isDirectory: () => false },
      { name: "contract.yaml", isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValue("yaml content");

    const contracts = await loadFromDirectory("/contracts");
    expect(contracts).toHaveLength(1);
  });

  it("should_recurse_into_subdirectories", async () => {
    mockReaddir
      .mockResolvedValueOnce([{ name: "sub", isFile: () => false, isDirectory: () => true }])
      .mockResolvedValueOnce([
        { name: "nested.yaml", isFile: () => true, isDirectory: () => false },
      ]);
    mockReadFile.mockResolvedValue("yaml content");

    const contracts = await loadFromDirectory("/contracts");
    expect(contracts).toHaveLength(1);
  });

  it("should_skip_non_file_entries", async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: "symlink.yaml", isFile: () => false, isDirectory: () => false },
    ]);

    const contracts = await loadFromDirectory("/contracts");
    expect(contracts).toHaveLength(0);
  });

  it("should_return_empty_array_for_empty_directory", async () => {
    mockReaddir.mockResolvedValueOnce([]);
    const contracts = await loadFromDirectory("/empty");
    expect(contracts).toHaveLength(0);
  });

  // @spec 042-openapi-contract-support AC7
  it("should_load_openapi_yaml_via_openapi_parser", async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: "openapi.yaml", isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValue("openapi: 3.0.0\npaths: {}");

    const contracts = await loadFromDirectory("/contracts");
    // looksLikeOpenApi returns true → parseOpenApiContracts returns 2 contracts
    expect(contracts).toHaveLength(2);
    expect(contracts[0]?.name).toContain("oa-1");
  });
});

describe("loadFromBroker", () => {
  it("should_filter_to_yaml_contracts_only", async () => {
    const client = {} as BrokerClient;
    const contracts = await loadFromBroker(client, "my-app", "1.0.0");

    // Only the YAML contract should be loaded (not the JSON one)
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.name).toBe("contract1.yaml");
  });

  // @spec 042-openapi-contract-support AC10
  it("should_parse_openapi_content_from_broker_via_openapi_parser", async () => {
    const { fetchAllPages } = await import("@stubborn-sh/broker-client");
    vi.mocked(fetchAllPages).mockResolvedValueOnce([
      {
        contractName: "openapi-spec.yaml",
        content: "openapi: 3.0.0\npaths:\n  /test:\n    get:\n      x-contracts: []",
        contentType: "application/x-yaml",
      },
    ]);

    const client = {} as BrokerClient;
    const contracts = await loadFromBroker(client, "my-app", "1.0.0");

    // looksLikeOpenApi returns true → parseOpenApiContracts returns 2 mock contracts
    expect(contracts).toHaveLength(2);
    expect(contracts[0]?.name).toContain("oa-1");
    expect(contracts[1]?.name).toContain("oa-2");
  });
});
