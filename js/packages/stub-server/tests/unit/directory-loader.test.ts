import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadFromDirectory } from "../../src/directory-loader.js";

let testDir: string;

beforeEach(async () => {
  testDir = join(
    tmpdir(),
    `scc-dir-loader-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

const YAML_CONTRACT = `
request:
  method: GET
  urlPath: /api/orders/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: "1"
    product: "MacBook Pro"
`;

const WIREMOCK_MAPPING = JSON.stringify({
  request: {
    urlPath: "/api/products/1",
    method: "GET",
  },
  response: {
    status: 200,
    body: '{"id":"1","name":"Widget"}',
    headers: { "Content-Type": "application/json" },
  },
});

describe("loadFromDirectory", () => {
  describe("contracts format", () => {
    it("should_load_yaml_contracts_from_directory", async () => {
      await writeFile(join(testDir, "shouldReturnOrder.yaml"), YAML_CONTRACT);

      const contracts = await loadFromDirectory(testDir, "contracts");

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe("shouldReturnOrder.yaml");
      expect(contracts[0].request.method).toBe("GET");
      expect(contracts[0].request.urlPath).toBe("/api/orders/1");
    });

    it("should_load_yml_files", async () => {
      await writeFile(join(testDir, "test.yml"), YAML_CONTRACT);

      const contracts = await loadFromDirectory(testDir, "contracts");

      expect(contracts).toHaveLength(1);
    });

    it("should_recurse_into_subdirectories", async () => {
      await mkdir(join(testDir, "orders"), { recursive: true });
      await writeFile(join(testDir, "orders", "get.yaml"), YAML_CONTRACT);

      const contracts = await loadFromDirectory(testDir, "contracts");

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe("orders/get.yaml");
    });

    it("should_ignore_json_files_in_contracts_mode", async () => {
      await writeFile(join(testDir, "mapping.json"), WIREMOCK_MAPPING);
      await writeFile(join(testDir, "contract.yaml"), YAML_CONTRACT);

      const contracts = await loadFromDirectory(testDir, "contracts");

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe("contract.yaml");
    });
  });

  describe("wiremock format", () => {
    it("should_load_wiremock_json_mappings", async () => {
      await writeFile(join(testDir, "shouldReturnProduct.json"), WIREMOCK_MAPPING);

      const contracts = await loadFromDirectory(testDir, "wiremock");

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe("shouldReturnProduct.json");
      expect(contracts[0].request.method).toBe("GET");
      expect(contracts[0].request.urlPath).toBe("/api/products/1");
      expect(contracts[0].response.body).toEqual({ id: "1", name: "Widget" });
    });

    it("should_ignore_yaml_files_in_wiremock_mode", async () => {
      await writeFile(join(testDir, "contract.yaml"), YAML_CONTRACT);
      await writeFile(join(testDir, "mapping.json"), WIREMOCK_MAPPING);

      const contracts = await loadFromDirectory(testDir, "wiremock");

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe("mapping.json");
    });

    it("should_throw_on_invalid_json_in_wiremock_mode", async () => {
      await writeFile(join(testDir, "bad.json"), "{not valid json");

      await expect(loadFromDirectory(testDir, "wiremock")).rejects.toThrow();
    });
  });

  describe("auto format", () => {
    it("should_load_both_yaml_and_wiremock_json", async () => {
      await writeFile(join(testDir, "contract.yaml"), YAML_CONTRACT);
      await writeFile(join(testDir, "mapping.json"), WIREMOCK_MAPPING);

      const contracts = await loadFromDirectory(testDir, "auto");

      expect(contracts).toHaveLength(2);
      const names = contracts.map((c) => c.name).sort();
      expect(names).toEqual(["contract.yaml", "mapping.json"]);
    });

    it("should_skip_non_wiremock_json_silently_in_auto_mode", async () => {
      await writeFile(join(testDir, "package.json"), '{"name":"test"}');
      await writeFile(join(testDir, "contract.yaml"), YAML_CONTRACT);

      const contracts = await loadFromDirectory(testDir, "auto");

      expect(contracts).toHaveLength(1);
      expect(contracts[0].name).toBe("contract.yaml");
    });

    it("should_default_to_auto_format", async () => {
      await writeFile(join(testDir, "contract.yaml"), YAML_CONTRACT);

      const contracts = await loadFromDirectory(testDir);

      expect(contracts).toHaveLength(1);
    });
  });

  it("should_return_empty_array_for_empty_directory", async () => {
    const contracts = await loadFromDirectory(testDir);
    expect(contracts).toHaveLength(0);
  });

  it("should_ignore_non_contract_files", async () => {
    await writeFile(join(testDir, "README.md"), "# Contracts");
    await writeFile(join(testDir, "config.xml"), "<config/>");

    const contracts = await loadFromDirectory(testDir);

    expect(contracts).toHaveLength(0);
  });
});
