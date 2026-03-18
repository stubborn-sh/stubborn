import { describe, it, expect } from "vitest";
import { resolveConfig, buildAuthHeader } from "../../src/config.js";

describe("resolveConfig", () => {
  it("should_strip_trailing_slashes_from_baseUrl", () => {
    const config = resolveConfig({ baseUrl: "http://localhost:8080///" });
    expect(config.baseUrl).toBe("http://localhost:8080");
  });

  it("should_default_page_size_to_20", () => {
    const config = resolveConfig({ baseUrl: "http://localhost:8080" });
    expect(config.defaultPageSize).toBe(20);
  });

  it("should_use_provided_page_size", () => {
    const config = resolveConfig({ baseUrl: "http://localhost:8080", defaultPageSize: 50 });
    expect(config.defaultPageSize).toBe(50);
  });

  it("should_default_timeout_to_30000", () => {
    const config = resolveConfig({ baseUrl: "http://localhost:8080" });
    expect(config.timeoutMs).toBe(30_000);
  });

  it("should_use_provided_timeout", () => {
    const config = resolveConfig({ baseUrl: "http://localhost:8080", timeoutMs: 5000 });
    expect(config.timeoutMs).toBe(5000);
  });

  it("should_reject_invalid_url_scheme", () => {
    expect(() => resolveConfig({ baseUrl: "file:///etc/passwd" })).toThrow(
      "Invalid baseUrl scheme",
    );
    expect(() => resolveConfig({ baseUrl: "ftp://example.com" })).toThrow("Invalid baseUrl scheme");
  });

  it("should_accept_http_and_https", () => {
    expect(() => resolveConfig({ baseUrl: "http://localhost" })).not.toThrow();
    expect(() => resolveConfig({ baseUrl: "https://broker.example.com" })).not.toThrow();
  });

  it("should_preserve_other_config_fields", () => {
    const config = resolveConfig({
      baseUrl: "http://localhost:8080",
      username: "admin",
      password: "secret",
      token: "jwt-token",
    });
    expect(config.username).toBe("admin");
    expect(config.password).toBe("secret");
    expect(config.token).toBe("jwt-token");
  });
});

describe("buildAuthHeader", () => {
  it("should_return_bearer_token_when_token_is_set", () => {
    const header = buildAuthHeader({ baseUrl: "http://x", token: "my-jwt" });
    expect(header).toBe("Bearer my-jwt");
  });

  it("should_prefer_token_over_basic_auth", () => {
    const header = buildAuthHeader({
      baseUrl: "http://x",
      token: "my-jwt",
      username: "admin",
      password: "pass",
    });
    expect(header).toBe("Bearer my-jwt");
  });

  it("should_return_basic_auth_when_username_is_set", () => {
    const header = buildAuthHeader({
      baseUrl: "http://x",
      username: "admin",
      password: "secret",
    });
    expect(header).toBe(`Basic ${Buffer.from("admin:secret").toString("base64")}`);
  });

  it("should_handle_basic_auth_with_empty_password", () => {
    const header = buildAuthHeader({
      baseUrl: "http://x",
      username: "admin",
    });
    expect(header).toBe(`Basic ${Buffer.from("admin:").toString("base64")}`);
  });

  it("should_handle_non_ascii_credentials", () => {
    const header = buildAuthHeader({
      baseUrl: "http://x",
      username: "user",
      password: "p\u00e4ssw\u00f6rd",
    });
    expect(header).toBe(`Basic ${Buffer.from("user:p\u00e4ssw\u00f6rd").toString("base64")}`);
    // Verify it decodes correctly
    expect(header).toBeDefined();
    const decoded = Buffer.from((header ?? "").replace("Basic ", ""), "base64").toString("utf-8");
    expect(decoded).toBe("user:p\u00e4ssw\u00f6rd");
  });

  it("should_return_undefined_when_no_auth_configured", () => {
    const header = buildAuthHeader({ baseUrl: "http://x" });
    expect(header).toBeUndefined();
  });

  it("should_return_undefined_when_token_is_empty_string", () => {
    const header = buildAuthHeader({ baseUrl: "http://x", token: "" });
    expect(header).toBeUndefined();
  });

  it("should_return_undefined_when_username_is_empty_string", () => {
    const header = buildAuthHeader({ baseUrl: "http://x", username: "" });
    expect(header).toBeUndefined();
  });
});
