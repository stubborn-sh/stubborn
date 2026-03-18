import { describe, it, expect } from "vitest";
import { detectContentType, knownExtensions } from "../../src/content-type.js";

describe("detectContentType", () => {
  it("should_detect_yaml_files", () => {
    expect(detectContentType("contract.yaml")).toBe("application/x-yaml");
    expect(detectContentType("contract.yml")).toBe("application/x-yaml");
  });

  it("should_detect_json_files", () => {
    expect(detectContentType("contract.json")).toBe("application/json");
  });

  it("should_detect_groovy_files", () => {
    expect(detectContentType("Contract.groovy")).toBe("application/x-groovy");
  });

  it("should_detect_kotlin_files", () => {
    expect(detectContentType("Contract.kts")).toBe("application/x-kotlin");
    expect(detectContentType("Contract.kt")).toBe("application/x-kotlin");
  });

  it("should_detect_java_files", () => {
    expect(detectContentType("Contract.java")).toBe("text/x-java-source");
  });

  it("should_return_null_for_unknown_extensions", () => {
    expect(detectContentType("readme.md")).toBeNull();
    expect(detectContentType("image.png")).toBeNull();
    expect(detectContentType("script.py")).toBeNull();
  });

  it("should_return_null_for_no_extension", () => {
    expect(detectContentType("Makefile")).toBeNull();
  });

  it("should_return_null_for_empty_string", () => {
    expect(detectContentType("")).toBeNull();
  });

  it("should_be_case_insensitive", () => {
    expect(detectContentType("CONTRACT.YAML")).toBe("application/x-yaml");
    expect(detectContentType("contract.JSON")).toBe("application/json");
  });

  it("should_handle_nested_dots_in_filename", () => {
    expect(detectContentType("my.contract.v2.yaml")).toBe("application/x-yaml");
  });
});

describe("knownExtensions", () => {
  it("should_return_all_known_extensions", () => {
    const exts = knownExtensions();
    expect(exts).toContain(".yaml");
    expect(exts).toContain(".yml");
    expect(exts).toContain(".json");
    expect(exts).toContain(".groovy");
    expect(exts.length).toBeGreaterThanOrEqual(6);
  });
});
