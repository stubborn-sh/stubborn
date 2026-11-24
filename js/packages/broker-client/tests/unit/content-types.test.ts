import { describe, it, expect } from "vitest";
import { isYamlContract } from "../../src/content-types.js";

describe("isYamlContract", () => {
  it.each([
    "application/x-spring-cloud-contract+yaml",
    "application/x-stubborn+yaml",
    "application/x-yaml",
    "application/yaml",
    "Application/X-Spring-Cloud-Contract+YAML",
    "application/x-yaml; charset=utf-8",
  ])("should_accept_%s", (contentType) => {
    expect(isYamlContract({ contentType })).toBe(true);
  });

  it.each(["application/json", "application/x-spring-cloud-contract+groovy", "text/plain", ""])(
    "should_reject_%s",
    (contentType) => {
      expect(isYamlContract({ contentType })).toBe(false);
    },
  );
});
