import { describe, it, expect, afterEach } from "vitest";
import { StubServer } from "../../src/stub-server.js";
import type { ParsedContract } from "../../src/contract-parser.js";

describe("StubServer", () => {
  let server: StubServer | null = null;

  afterEach(async () => {
    if (server !== null) {
      await server.stop();
      server = null;
    }
  });

  it("should_start_and_stop", async () => {
    server = new StubServer({ port: 0 });
    const port = await server.start();
    expect(port).toBeGreaterThan(0);
    expect(server.running).toBe(true);
    await server.stop();
    expect(server.running).toBe(false);
    server = null;
  });

  it("should_throw_when_starting_twice", async () => {
    server = new StubServer({ port: 0 });
    await server.start();
    await expect(server.start()).rejects.toThrow("already running");
  });

  it("should_serve_matching_contract", async () => {
    const contract: ParsedContract = {
      name: "test",
      request: { method: "GET", urlPath: "/api/hello" },
      response: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { message: "hello" },
      },
    };

    server = new StubServer({ port: 0 });
    server.setContracts([contract]);
    const port = await server.start();

    const response = await fetch(`http://127.0.0.1:${String(port)}/api/hello`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ message: "hello" });
  });

  it("should_return_404_for_unmatched_request", async () => {
    server = new StubServer({ port: 0 });
    server.setContracts([]);
    const port = await server.start();

    const response = await fetch(`http://127.0.0.1:${String(port)}/api/nothing`);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("No matching contract found");
  });

  it("should_match_POST_with_body", async () => {
    const contract: ParsedContract = {
      name: "create",
      request: {
        method: "POST",
        urlPath: "/api/items",
        headers: { "Content-Type": "application/json" },
        body: { name: "widget" },
      },
      response: {
        status: 201,
        body: { id: "1", name: "widget" },
      },
    };

    server = new StubServer({ port: 0 });
    server.setContracts([contract]);
    const port = await server.start();

    const response = await fetch(`http://127.0.0.1:${String(port)}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "widget" }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ id: "1", name: "widget" });
  });

  it("should_handle_stop_when_not_running", async () => {
    server = new StubServer({ port: 0 });
    await server.stop(); // should not throw
    server = null;
  });
});
