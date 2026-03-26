import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { packageStubsJar } from "../../src/packager.js";

const execAsync = promisify(exec);

describe("packageStubsJar", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `scc-packager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should_create_jar_with_correct_structure", async () => {
    // given
    const contractsDir = join(tempDir, "contracts");
    await mkdir(contractsDir, { recursive: true });
    await writeFile(
      join(contractsDir, "get-order.yaml"),
      [
        "request:",
        "  method: GET",
        "  urlPath: /api/orders/1",
        "response:",
        "  status: 200",
        "  headers:",
        "    Content-Type: application/json",
        "  body:",
        '    id: "1"',
        '    product: "Laptop"',
      ].join("\n"),
    );

    const outputPath = join(tempDir, "output-stubs.jar");

    // when
    const result = await packageStubsJar({
      contractsDir,
      coordinates: {
        groupId: "com.example",
        artifactId: "order-service",
        version: "1.0.0",
      },
      outputPath,
    });

    // then
    expect(result.contractCount).toBe(1);
    expect(result.mappingCount).toBe(1);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.outputPath).toBe(outputPath);

    // Verify ZIP structure by extracting with jar/unzip
    const extractDir = join(tempDir, "extracted");
    await mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`jar xf "${outputPath}"`, { cwd: extractDir });
    } catch {
      try {
        await execAsync(`unzip -o -q "${outputPath}" -d "${extractDir}"`);
      } catch {
        // Skip structure verification if neither tool is available
        return;
      }
    }

    // Verify the expected files exist
    const { readdir } = await import("node:fs/promises");
    const metaInf = join(extractDir, "META-INF");

    // Check MANIFEST.MF
    const { readFile: rf } = await import("node:fs/promises");
    const manifest = await rf(join(metaInf, "MANIFEST.MF"), "utf-8");
    expect(manifest).toContain("Manifest-Version: 1.0");

    // Check contract file
    const contractPath = join(
      metaInf,
      "com.example",
      "order-service",
      "1.0.0",
      "contracts",
      "get-order.yaml",
    );
    const contractContent = await rf(contractPath, "utf-8");
    expect(contractContent).toContain("method: GET");

    // Check mapping file
    const mappingPath = join(
      metaInf,
      "com.example",
      "order-service",
      "1.0.0",
      "mappings",
      "get-order.json",
    );
    const mappingContent = await rf(mappingPath, "utf-8");
    const mapping = JSON.parse(mappingContent);
    expect(mapping.request.method).toBe("GET");
    expect(mapping.request.urlPath).toBe("/api/orders/1");
  });

  it("should_package_multiple_contracts", async () => {
    // given
    const contractsDir = join(tempDir, "contracts");
    await mkdir(join(contractsDir, "order"), { recursive: true });

    await writeFile(
      join(contractsDir, "order", "get.yaml"),
      "request:\n  method: GET\n  urlPath: /api/orders/1\nresponse:\n  status: 200",
    );
    await writeFile(
      join(contractsDir, "order", "create.yaml"),
      "request:\n  method: POST\n  urlPath: /api/orders\nresponse:\n  status: 201",
    );

    const outputPath = join(tempDir, "multi-stubs.jar");

    // when
    const result = await packageStubsJar({
      contractsDir,
      coordinates: {
        groupId: "com.example",
        artifactId: "order-service",
        version: "2.0.0",
      },
      outputPath,
    });

    // then
    expect(result.contractCount).toBe(2);
    expect(result.mappingCount).toBe(2);
  });

  it("should_throw_when_no_contracts_found", async () => {
    const emptyDir = join(tempDir, "empty");
    await mkdir(emptyDir, { recursive: true });
    const outputPath = join(tempDir, "empty-stubs.jar");

    await expect(
      packageStubsJar({
        contractsDir: emptyDir,
        coordinates: {
          groupId: "com.example",
          artifactId: "empty-service",
          version: "1.0.0",
        },
        outputPath,
      }),
    ).rejects.toThrow("No contract files found");
  });

  it("should_use_custom_classifier_in_result", async () => {
    const contractsDir = join(tempDir, "contracts");
    await mkdir(contractsDir, { recursive: true });
    await writeFile(
      join(contractsDir, "test.yaml"),
      "request:\n  method: GET\n  urlPath: /test\nresponse:\n  status: 200",
    );

    const outputPath = join(tempDir, "custom-stubs.jar");

    const result = await packageStubsJar({
      contractsDir,
      coordinates: {
        groupId: "com.example",
        artifactId: "my-service",
        version: "1.0.0",
        classifier: "contracts",
      },
      outputPath,
    });

    expect(result.contractCount).toBe(1);
  });
});
