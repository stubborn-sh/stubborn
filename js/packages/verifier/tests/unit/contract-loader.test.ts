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
});

describe("loadFromBroker", () => {
  it("should_filter_to_yaml_contracts_only", async () => {
    const client = {} as BrokerClient;
    const contracts = await loadFromBroker(client, "my-app", "1.0.0");

    // Only the YAML contract should be loaded (not the JSON one)
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.name).toBe("contract1.yaml");
  });
});
