import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanContracts } from "../../src/scanner.js";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

const mockReaddir = vi.mocked(fs.readdir);
const mockReadFile = vi.mocked(fs.readFile);

function dirent(name: string, isDir: boolean): fs.Dirent {
  return {
    name,
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: "",
    path: "",
  };
}

describe("scanContracts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should_scan_yaml_files", async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent("contract.yaml", false),
      dirent("readme.md", false),
    ] as unknown as fs.Dirent[]);
    mockReadFile.mockResolvedValueOnce("request:\n  method: GET\n  url: /api");

    const contracts = await scanContracts("/contracts");

    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.contractName).toBe("contract.yaml");
    expect(contracts[0]?.contentType).toBe("application/x-yaml");
    expect(contracts[0]?.content).toBe("request:\n  method: GET\n  url: /api");
  });

  it("should_scan_nested_directories", async () => {
    mockReaddir
      .mockResolvedValueOnce([dirent("subdir", true)] as unknown as fs.Dirent[])
      .mockResolvedValueOnce([dirent("nested.yaml", false)] as unknown as fs.Dirent[]);
    mockReadFile.mockResolvedValueOnce("response:\n  status: 200");

    const contracts = await scanContracts("/contracts");

    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.contractName).toBe("subdir/nested.yaml");
  });

  it("should_return_empty_for_no_contracts", async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent("readme.md", false),
      dirent("image.png", false),
    ] as unknown as fs.Dirent[]);

    const contracts = await scanContracts("/contracts");
    expect(contracts).toHaveLength(0);
  });

  it("should_return_empty_for_empty_directory", async () => {
    mockReaddir.mockResolvedValueOnce([] as unknown as fs.Dirent[]);

    const contracts = await scanContracts("/contracts");
    expect(contracts).toHaveLength(0);
  });

  it("should_scan_json_contracts", async () => {
    mockReaddir.mockResolvedValueOnce([dirent("contract.json", false)] as unknown as fs.Dirent[]);
    mockReadFile.mockResolvedValueOnce('{"request": {}}');

    const contracts = await scanContracts("/contracts");
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.contentType).toBe("application/json");
  });
});
