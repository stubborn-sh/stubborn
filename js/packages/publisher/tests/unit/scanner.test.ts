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
    expect(contracts[0]?.contentType).toBe("application/x-spring-cloud-contract+yaml");
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

  function mockFiles(files: Record<string, string>): void {
    mockReadFile.mockImplementation((path) => {
      const content = files[String(path)];
      return content === undefined
        ? Promise.reject(new Error(`ENOENT ${String(path)}`))
        : Promise.resolve(content);
    });
  }

  it("should_skip_files_referenced_by_a_yaml_contract_body", async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent("order.yaml", false),
      dirent("request.json", false),
      dirent("response.json", false),
      dirent("unrelated.json", false),
    ] as unknown as fs.Dirent[]);
    mockFiles({
      "/contracts/order.yaml": [
        "request:",
        "  method: POST",
        "  url: /orders",
        "  bodyFromFile: request.json",
        "response:",
        "  status: 200",
        "  bodyFromFileAsBytes: 'response.json' # the payload",
      ].join("\n"),
      "/contracts/request.json": '{"id": 1}',
      "/contracts/response.json": '{"ok": true}',
      "/contracts/unrelated.json": '{"request": {}}',
    });

    const contracts = await scanContracts("/contracts");

    expect(contracts.map((c) => c.contractName)).toEqual(["order.yaml", "unrelated.json"]);
  });

  it("should_skip_files_referenced_from_other_directories_and_documents", async () => {
    mockReaddir
      .mockResolvedValueOnce([
        dirent("bodies", true),
        dirent("messaging", true),
      ] as unknown as fs.Dirent[])
      .mockResolvedValueOnce([
        dirent("event.json", false),
        dirent("photo.json", false),
      ] as unknown as fs.Dirent[])
      .mockResolvedValueOnce([dirent("events.yml", false)] as unknown as fs.Dirent[]);
    mockFiles({
      "/contracts/bodies/event.json": '{"type": "created"}',
      "/contracts/bodies/photo.json": "{}",
      "/contracts/messaging/events.yml": [
        "label: created",
        "outputMessage:",
        "  sentTo: events",
        '  bodyFromFile: "../bodies/event.json"',
        "---",
        "request:",
        "  method: POST",
        "  url: /photos",
        "  multipart:",
        "    named:",
        "      - paramName: photo",
        "        fileName: photo.json",
        "        fileContentFromFileAsBytes: ./../bodies/photo.json",
        "response:",
        "  status: 201",
      ].join("\n"),
    });

    const contracts = await scanContracts("/contracts");

    expect(contracts.map((c) => c.contractName)).toEqual(["messaging/events.yml"]);
  });

  it("should_scan_files_sorted_by_name", async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent("b.yaml", false),
      dirent("a.yaml", false),
      dirent("c.groovy", false),
    ] as unknown as fs.Dirent[]);
    mockFiles({ "/contracts/a.yaml": "a", "/contracts/b.yaml": "b", "/contracts/c.groovy": "c" });

    const contracts = await scanContracts("/contracts");

    expect(contracts.map((c) => c.contractName)).toEqual(["a.yaml", "b.yaml", "c.groovy"]);
    expect(contracts[2]?.contentType).toBe("application/x-spring-cloud-contract+groovy");
  });

  it("should_not_scan_kotlin_or_java_contracts_as_the_jvm_publisher", async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent("Contract.kts", false),
      dirent("Contract.java", false),
    ] as unknown as fs.Dirent[]);

    const contracts = await scanContracts("/contracts");

    expect(contracts).toHaveLength(0);
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
