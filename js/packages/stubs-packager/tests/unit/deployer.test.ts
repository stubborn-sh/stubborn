import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";
import { deployStubsJar } from "../../src/deployer.js";

describe("deployStubsJar", () => {
  let tempDir: string;
  let server: Server;
  let serverPort: number;
  let lastRequest: {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  };

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `scc-deploy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });

    // Create a simple HTTP server to capture PUT requests
    lastRequest = { method: "", url: "", headers: {}, body: Buffer.alloc(0) };

    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        lastRequest = {
          method: req.method ?? "",
          url: req.url ?? "",
          headers: req.headers as Record<string, string | string[] | undefined>,
          body: Buffer.concat(chunks),
        };
        res.writeHead(201);
        res.end();
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        serverPort = typeof addr === "object" && addr !== null ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should_deploy_jar_to_correct_maven_path", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "fake jar content");

    // when
    const result = await deployStubsJar({
      jarPath,
      repositoryUrl: `http://localhost:${serverPort}/repository/releases`,
      groupId: "com.example",
      artifactId: "order-service",
      version: "1.0.0",
    });

    // then
    expect(result.statusCode).toBe(201);
    expect(result.url).toContain(
      "/repository/releases/com/example/order-service/1.0.0/order-service-1.0.0-stubs.jar",
    );
    expect(lastRequest.method).toBe("PUT");
    expect(lastRequest.url).toBe(
      "/repository/releases/com/example/order-service/1.0.0/order-service-1.0.0-stubs.jar",
    );
    expect(lastRequest.body.toString()).toBe("fake jar content");
  });

  it("should_send_basic_auth_header", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when
    await deployStubsJar({
      jarPath,
      repositoryUrl: `http://localhost:${serverPort}/repo`,
      groupId: "com.example",
      artifactId: "svc",
      version: "1.0.0",
      username: "admin",
      password: "secret",
    });

    // then
    const expected = Buffer.from("admin:secret").toString("base64");
    expect(lastRequest.headers["authorization"]).toBe(`Basic ${expected}`);
  });

  it("should_send_bearer_token_header", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when
    await deployStubsJar({
      jarPath,
      repositoryUrl: `http://localhost:${serverPort}/repo`,
      groupId: "com.example",
      artifactId: "svc",
      version: "1.0.0",
      token: "my-token-123",
    });

    // then
    expect(lastRequest.headers["authorization"]).toBe("Bearer my-token-123");
  });

  it("should_prefer_bearer_token_over_basic_auth", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when
    await deployStubsJar({
      jarPath,
      repositoryUrl: `http://localhost:${serverPort}/repo`,
      groupId: "com.example",
      artifactId: "svc",
      version: "1.0.0",
      username: "admin",
      password: "secret",
      token: "my-token",
    });

    // then
    expect(lastRequest.headers["authorization"]).toBe("Bearer my-token");
  });

  it("should_use_custom_classifier", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when
    const result = await deployStubsJar({
      jarPath,
      repositoryUrl: `http://localhost:${serverPort}/repo`,
      groupId: "com.example",
      artifactId: "svc",
      version: "2.0.0",
      classifier: "contracts",
    });

    // then
    expect(result.url).toContain("svc-2.0.0-contracts.jar");
    expect(lastRequest.url).toContain("svc-2.0.0-contracts.jar");
  });

  it("should_throw_when_jar_file_does_not_exist", async () => {
    await expect(
      deployStubsJar({
        jarPath: "/nonexistent/stubs.jar",
        repositoryUrl: `http://localhost:${serverPort}/repo`,
        groupId: "com.example",
        artifactId: "svc",
        version: "1.0.0",
      }),
    ).rejects.toThrow("JAR file not found");
  });

  it("should_throw_on_server_error", async () => {
    // given — server returns 500
    server.close();
    server = createServer((_req, res) => {
      res.writeHead(500);
      res.end("Internal Server Error");
    });
    await new Promise<void>((resolve) => {
      server.listen(serverPort, () => resolve());
    });

    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when/then
    await expect(
      deployStubsJar({
        jarPath,
        repositoryUrl: `http://localhost:${serverPort}/repo`,
        groupId: "com.example",
        artifactId: "svc",
        version: "1.0.0",
      }),
    ).rejects.toThrow("Failed to deploy stubs JAR");
  });

  it("should_set_content_type_to_java_archive", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when
    await deployStubsJar({
      jarPath,
      repositoryUrl: `http://localhost:${serverPort}/repo`,
      groupId: "com.example",
      artifactId: "svc",
      version: "1.0.0",
    });

    // then
    expect(lastRequest.headers["content-type"]).toBe("application/java-archive");
  });

  it("should_reject_non_http_url_schemes", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when/then
    await expect(
      deployStubsJar({
        jarPath,
        repositoryUrl: "ftp://evil.com/repo",
        groupId: "com.example",
        artifactId: "svc",
        version: "1.0.0",
      }),
    ).rejects.toThrow("Invalid repository URL scheme");
  });

  it("should_handle_nested_group_id", async () => {
    // given
    const jarPath = join(tempDir, "stubs.jar");
    await writeFile(jarPath, "test");

    // when
    const result = await deployStubsJar({
      jarPath,
      repositoryUrl: `http://localhost:${serverPort}/repo`,
      groupId: "org.springframework.cloud",
      artifactId: "contract-broker",
      version: "1.0.0",
    });

    // then
    expect(lastRequest.url).toBe(
      "/repo/org/springframework/cloud/contract-broker/1.0.0/contract-broker-1.0.0-stubs.jar",
    );
  });
});
