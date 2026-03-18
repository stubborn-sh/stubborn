import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildJarUrl, loadLocalJar } from "../../src/jar-fetcher.js";

describe("buildJarUrl", () => {
  it("should_build_standard_maven_url_with_stubs_classifier", () => {
    const url = buildJarUrl({
      repositoryUrl: "https://repo1.maven.org/maven2",
      groupId: "com.example",
      artifactId: "order-service",
      version: "1.0.0",
    });

    expect(url).toBe(
      "https://repo1.maven.org/maven2/com/example/order-service/1.0.0/order-service-1.0.0-stubs.jar",
    );
  });

  it("should_handle_nested_group_id", () => {
    const url = buildJarUrl({
      repositoryUrl: "https://nexus.internal/repository/releases",
      groupId: "org.springframework.cloud.contract",
      artifactId: "broker",
      version: "2.0.0",
    });

    expect(url).toBe(
      "https://nexus.internal/repository/releases/org/springframework/cloud/contract/broker/2.0.0/broker-2.0.0-stubs.jar",
    );
  });

  it("should_use_custom_classifier", () => {
    const url = buildJarUrl({
      repositoryUrl: "https://repo.example.com",
      groupId: "com.example",
      artifactId: "my-service",
      version: "3.0.0",
      classifier: "contracts",
    });

    expect(url).toBe(
      "https://repo.example.com/com/example/my-service/3.0.0/my-service-3.0.0-contracts.jar",
    );
  });

  it("should_strip_trailing_slash_from_repository_url", () => {
    const url = buildJarUrl({
      repositoryUrl: "https://repo.example.com/maven/",
      groupId: "com.example",
      artifactId: "svc",
      version: "1.0.0",
    });

    expect(url).toBe("https://repo.example.com/maven/com/example/svc/1.0.0/svc-1.0.0-stubs.jar");
  });

  it("should_handle_snapshot_versions", () => {
    const url = buildJarUrl({
      repositoryUrl: "https://repo.example.com",
      groupId: "com.example",
      artifactId: "my-service",
      version: "1.0.0-SNAPSHOT",
    });

    expect(url).toBe(
      "https://repo.example.com/com/example/my-service/1.0.0-SNAPSHOT/my-service-1.0.0-SNAPSHOT-stubs.jar",
    );
  });
});

describe("loadLocalJar", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `scc-jar-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should_throw_when_jar_file_does_not_exist", async () => {
    await expect(loadLocalJar("/nonexistent/path/stubs.jar")).rejects.toThrow(
      "Local stubs JAR not found: /nonexistent/path/stubs.jar",
    );
  });

  it("should_load_contracts_from_jar_with_root_level_mappings", async () => {
    // given — create a JAR (ZIP) with root-level mappings/
    const jarPath = join(tempDir, "stubs.jar");
    const mappingsDir = join(tempDir, "jar-content", "mappings");
    await mkdir(mappingsDir, { recursive: true });

    await writeFile(
      join(mappingsDir, "get-order.json"),
      JSON.stringify({
        request: { method: "GET", urlPath: "/api/orders/1" },
        response: {
          status: 200,
          headers: { "Content-Type": "application/json" },
          jsonBody: { id: "1", product: "Laptop", amount: 999.99 },
        },
      }),
    );

    // Create a ZIP using jar/zip command
    const { exec: execCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(execCb);

    try {
      await execAsync(`jar cf "${jarPath}" -C "${join(tempDir, "jar-content")}" .`);
    } catch {
      try {
        await execAsync(`cd "${join(tempDir, "jar-content")}" && zip -r "${jarPath}" .`);
      } catch {
        // Neither jar nor zip available — skip test
        return;
      }
    }

    // when
    const contracts = await loadLocalJar(jarPath);

    // then
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.method).toBe("GET");
    expect(contracts[0]!.request.urlPath).toBe("/api/orders/1");
    expect(contracts[0]!.response.status).toBe(200);
  });

  it("should_load_contracts_from_jar_with_nested_meta_inf_mappings", async () => {
    // given — create a JAR (ZIP) with META-INF/com.example/order-service/1.0.0/mappings/
    const jarPath = join(tempDir, "stubs.jar");
    const nestedMappings = join(
      tempDir,
      "jar-content",
      "META-INF",
      "com.example",
      "order-service",
      "1.0.0",
      "mappings",
    );
    await mkdir(nestedMappings, { recursive: true });

    await writeFile(
      join(nestedMappings, "create-order.json"),
      JSON.stringify({
        request: {
          method: "POST",
          urlPath: "/api/orders",
          headers: { "Content-Type": { equalTo: "application/json" } },
        },
        response: {
          status: 201,
          headers: { "Content-Type": "application/json" },
          jsonBody: { id: "42", product: "Phone", amount: 799.99, status: "CREATED" },
        },
      }),
    );

    const { exec: execCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(execCb);

    try {
      await execAsync(`jar cf "${jarPath}" -C "${join(tempDir, "jar-content")}" .`);
    } catch {
      try {
        await execAsync(`cd "${join(tempDir, "jar-content")}" && zip -r "${jarPath}" .`);
      } catch {
        return;
      }
    }

    // when
    const contracts = await loadLocalJar(jarPath);

    // then
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.method).toBe("POST");
    expect(contracts[0]!.request.urlPath).toBe("/api/orders");
    expect(contracts[0]!.response.status).toBe(201);
  });

  it("should_return_empty_array_when_jar_has_no_mappings_or_contracts", async () => {
    // given — create a JAR (ZIP) with no mappings or contracts
    const jarPath = join(tempDir, "empty-stubs.jar");
    const contentDir = join(tempDir, "empty-content", "META-INF");
    await mkdir(contentDir, { recursive: true });
    await writeFile(join(contentDir, "MANIFEST.MF"), "Manifest-Version: 1.0\n");

    const { exec: execCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(execCb);

    try {
      await execAsync(`jar cf "${jarPath}" -C "${join(tempDir, "empty-content")}" .`);
    } catch {
      try {
        await execAsync(`cd "${join(tempDir, "empty-content")}" && zip -r "${jarPath}" .`);
      } catch {
        return;
      }
    }

    // when
    const contracts = await loadLocalJar(jarPath);

    // then
    expect(contracts).toHaveLength(0);
  });

  it("should_prefer_root_mappings_over_nested_when_both_exist", async () => {
    // given — root-level mappings/ AND META-INF/.../mappings/
    const jarPath = join(tempDir, "both-stubs.jar");
    const contentDir = join(tempDir, "both-content");

    const rootMappings = join(contentDir, "mappings");
    await mkdir(rootMappings, { recursive: true });
    await writeFile(
      join(rootMappings, "root.json"),
      JSON.stringify({
        request: { method: "GET", urlPath: "/root" },
        response: { status: 200 },
      }),
    );

    const nestedMappings = join(contentDir, "META-INF", "com.example", "svc", "1.0.0", "mappings");
    await mkdir(nestedMappings, { recursive: true });
    await writeFile(
      join(nestedMappings, "nested.json"),
      JSON.stringify({
        request: { method: "GET", urlPath: "/nested" },
        response: { status: 200 },
      }),
    );

    const { exec: execCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(execCb);

    try {
      await execAsync(`jar cf "${jarPath}" -C "${contentDir}" .`);
    } catch {
      try {
        await execAsync(`cd "${contentDir}" && zip -r "${jarPath}" .`);
      } catch {
        return;
      }
    }

    // when
    const contracts = await loadLocalJar(jarPath);

    // then — BFS finds root-level mappings first, nested are excluded
    expect(contracts.some((c) => c.request.urlPath === "/root")).toBe(true);
    expect(contracts.every((c) => c.request.urlPath !== "/nested")).toBe(true);
  });

  it("should_fall_back_to_yaml_contracts_when_no_mappings_exist", async () => {
    // given — contracts/ directory with YAML files only
    const jarPath = join(tempDir, "yaml-stubs.jar");
    const contentDir = join(tempDir, "yaml-content");
    const contractsDir = join(contentDir, "contracts");
    await mkdir(contractsDir, { recursive: true });

    await writeFile(
      join(contractsDir, "get-order.yaml"),
      [
        "request:",
        "  method: GET",
        "  url: /api/orders/1",
        "response:",
        "  status: 200",
        "  headers:",
        "    Content-Type: application/json",
        "  body:",
        '    id: "1"',
        '    product: "Laptop"',
      ].join("\n"),
    );

    const { exec: execCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(execCb);

    try {
      await execAsync(`jar cf "${jarPath}" -C "${contentDir}" .`);
    } catch {
      try {
        await execAsync(`cd "${contentDir}" && zip -r "${jarPath}" .`);
      } catch {
        return;
      }
    }

    // when
    const contracts = await loadLocalJar(jarPath);

    // then
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.method).toBe("GET");
  });
});
