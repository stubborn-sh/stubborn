import { describe, it, expect } from "vitest";
import { brokerContractName, detectContentType, knownExtensions } from "../../src/content-type.js";

describe("detectContentType", () => {
  it("should_detect_yaml_files", () => {
    expect(detectContentType("contract.yaml")).toBe("application/x-spring-cloud-contract+yaml");
    expect(detectContentType("contract.yml")).toBe("application/x-spring-cloud-contract+yaml");
  });

  it("should_detect_json_files", () => {
    expect(detectContentType("contract.json")).toBe("application/json");
  });

  it("should_detect_groovy_files", () => {
    expect(detectContentType("Contract.groovy")).toBe("application/x-spring-cloud-contract+groovy");
  });

  it("should_not_publish_kotlin_or_java_files_as_the_jvm_publisher", () => {
    expect(detectContentType("Contract.kts")).toBeNull();
    expect(detectContentType("Contract.kt")).toBeNull();
    expect(detectContentType("Contract.java")).toBeNull();
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
    expect(detectContentType("CONTRACT.YAML")).toBe("application/x-spring-cloud-contract+yaml");
    expect(detectContentType("contract.JSON")).toBe("application/json");
  });

  it("should_handle_nested_dots_in_filename", () => {
    expect(detectContentType("my.contract.v2.yaml")).toBe(
      "application/x-spring-cloud-contract+yaml",
    );
  });
});

describe("knownExtensions", () => {
  it("should_return_all_known_extensions", () => {
    const exts = knownExtensions();
    expect(exts).toContain(".yaml");
    expect(exts).toContain(".yml");
    expect(exts).toContain(".json");
    expect(exts).toContain(".groovy");
    expect(exts).toHaveLength(4);
  });
});

describe("brokerContractName", () => {
  it("should_strip_the_extension_as_the_jvm_publisher", () => {
    expect(brokerContractName("shouldReturnOrder.yaml")).toBe("shouldReturnOrder");
    expect(brokerContractName("Contract.groovy")).toBe("Contract");
    expect(brokerContractName("my.contract.v2.yml")).toBe("my.contract.v2");
  });

  it("should_keep_the_directory", () => {
    expect(brokerContractName("orders/get.yaml")).toBe("orders/get");
    expect(brokerContractName("v1.0/get")).toBe("v1.0/get");
  });

  it("should_keep_a_name_that_is_only_an_extension", () => {
    expect(brokerContractName(".yaml")).toBe(".yaml");
    expect(brokerContractName("orders/.yaml")).toBe("orders/.yaml");
  });
});
