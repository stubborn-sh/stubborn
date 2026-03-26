import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveCliConfig } from "../../src/config.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
}));

describe("resolveCliConfig", () => {
  beforeEach(() => {
    delete process.env["SCC_BROKER_URL"];
    delete process.env["SCC_BROKER_USERNAME"];
    delete process.env["SCC_BROKER_PASSWORD"];
    delete process.env["SCC_BROKER_TOKEN"];
    delete process.env["SCC_BROKER_FORMAT"];
  });

  it("should_use_defaults_when_nothing_provided", async () => {
    const config = await resolveCliConfig({});
    expect(config.baseUrl).toBe("http://localhost:8080");
    expect(config.format).toBe("table");
  });

  it("should_prefer_flags_over_env", async () => {
    process.env["SCC_BROKER_URL"] = "http://env:9090";
    const config = await resolveCliConfig({ baseUrl: "http://flag:8080" });
    expect(config.baseUrl).toBe("http://flag:8080");
  });

  it("should_use_env_when_no_flags", async () => {
    process.env["SCC_BROKER_URL"] = "http://env:9090";
    process.env["SCC_BROKER_USERNAME"] = "env-user";
    process.env["SCC_BROKER_PASSWORD"] = "env-pass";
    process.env["SCC_BROKER_FORMAT"] = "json";

    const config = await resolveCliConfig({});
    expect(config.baseUrl).toBe("http://env:9090");
    expect(config.username).toBe("env-user");
    expect(config.password).toBe("env-pass");
    expect(config.format).toBe("json");
  });

  it("should_use_token_from_flags", async () => {
    const config = await resolveCliConfig({ token: "my-jwt" });
    expect(config.token).toBe("my-jwt");
  });

  it("should_use_token_from_env", async () => {
    process.env["SCC_BROKER_TOKEN"] = "env-jwt";
    const config = await resolveCliConfig({});
    expect(config.token).toBe("env-jwt");
  });
});
