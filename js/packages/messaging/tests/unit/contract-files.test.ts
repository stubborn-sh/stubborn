import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isMessagingContract,
  messageBody,
  parseMessagingContract,
  parseMessagingContracts,
} from "../../src/contract-parser.js";
import { loadMessagingContractFile } from "../../src/file-loader.js";

const encoder = new TextEncoder();

function reader(files: Record<string, Uint8Array>): (path: string) => Uint8Array | undefined {
  return (path) => files[path];
}

describe("parseMessagingContracts — multiple contracts per file", () => {
  it("should_parse_every_document_named_as_the_jvm_names_them", () => {
    // given
    const yaml = [
      "label: first",
      "outputMessage:",
      "  sentTo: orders",
      "  body: one",
      "---",
      "label: second",
      "outputMessage:",
      "  sentTo: orders",
      "  body: two",
    ].join("\n");

    // when
    const contracts = parseMessagingContracts("order_events.yaml", yaml);

    // then — NamesUtil.defaultContractName: no suffix for document 0, "_1" for document 1
    expect(contracts.map((c) => c.name)).toEqual(["order_events", "order_events_1"]);
    expect(contracts.map((c) => c.label)).toEqual(["first", "second"]);
    expect(contracts.map((c) => c.body)).toEqual(["one", "two"]);
  });

  it("should_parse_a_list_of_contracts_in_one_document", () => {
    // given
    const yaml = [
      "- label: created",
      "  outputMessage:",
      "    sentTo: orders",
      "- label: deleted",
      "  outputMessage:",
      "    sentTo: orders",
    ].join("\n");

    // when
    const contracts = parseMessagingContracts("events.yml", yaml);

    // then — every contract of a list document carries the document index
    expect(contracts.map((c) => c.name)).toEqual(["events_0", "events_0"]);
    expect(contracts.map((c) => c.label)).toEqual(["created", "deleted"]);
  });

  it("should_use_the_contract_own_name_when_it_has_one", () => {
    // given
    const yaml = [
      "name: orderCreated",
      "outputMessage:",
      "  sentTo: orders",
      "---",
      "name: '  '",
      "outputMessage:",
      "  sentTo: orders",
    ].join("\n");

    // when
    const contracts = parseMessagingContracts("events.yaml", yaml);

    // then
    expect(contracts.map((c) => c.name)).toEqual(["orderCreated", "events_1"]);
    expect(contracts[0]?.label).toBe("orderCreated");
  });

  it("should_name_a_single_contract_after_the_file_without_directory_or_extension", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: orders\n";

    // when
    const fromFile = parseMessagingContract("messaging/order.yml", yaml);
    const fromBroker = parseMessagingContract("messaging/shouldSendOrder", yaml);

    // then
    expect(fromFile.name).toBe("order");
    expect(fromBroker.name).toBe("shouldSendOrder");
  });

  it("should_skip_http_documents", () => {
    // given
    const yaml = [
      "request:",
      "  method: GET",
      "  url: /orders",
      "response:",
      "  status: 200",
      "---",
      "label: created",
      "outputMessage:",
      "  sentTo: orders",
    ].join("\n");

    // when
    const contracts = parseMessagingContracts("mixed.yaml", yaml);

    // then — the document index still counts the HTTP document
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.name).toBe("mixed_1");
    expect(isMessagingContract(yaml)).toBe(true);
  });

  it("should_throw_when_a_single_contract_is_expected_but_the_file_holds_several", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: a\n---\noutputMessage:\n  sentTo: b\n";

    // when/then
    expect(() => parseMessagingContract("two.yaml", yaml)).toThrow(
      /holds 2 messaging contracts, not one/,
    );
  });
});

describe("parseMessagingContracts — file bodies", () => {
  it("should_read_body_from_file_as_text_as_the_jvm_reads_it", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: orders\n  bodyFromFile: bodies/order.json\n";
    const files = { "bodies/order.json": encoder.encode('{\r\n  "id": 1\r\n}\n') };

    // when
    const contract = parseMessagingContract("order.yaml", yaml, { readFile: reader(files) });

    // then — lines joined with "\n", no trailing line terminator (Files.readAllLines)
    expect(contract.body).toBe('{\n  "id": 1\n}');
    expect(contract.unreadableFile).toBeUndefined();
    expect(messageBody(contract)).toBe('{\n  "id": 1\n}');
  });

  it("should_read_body_from_file_as_bytes", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: images\n  bodyFromFileAsBytes: image.bin\n";
    const bytes = new Uint8Array([0, 255, 13, 10]);

    // when
    const contract = parseMessagingContract("image.yaml", yaml, {
      readFile: reader({ "image.bin": bytes }),
    });

    // then
    expect(contract.body).toBeInstanceOf(Uint8Array);
    expect(Array.from(contract.body as Uint8Array)).toEqual([0, 255, 13, 10]);
  });

  it("should_prefer_bytes_over_file_over_inline_body_as_the_jvm", () => {
    // given
    const yaml = [
      "outputMessage:",
      "  sentTo: orders",
      "  body: inline",
      "  bodyFromFile: text.txt",
      "  bodyFromFileAsBytes: bytes.bin",
    ].join("\n");
    const files = { "text.txt": encoder.encode("text"), "bytes.bin": encoder.encode("bytes") };

    // when
    const contract = parseMessagingContract("c.yaml", yaml, { readFile: reader(files) });

    // then
    expect(new TextDecoder().decode(contract.body as Uint8Array)).toBe("bytes");
  });

  it("should_report_a_missing_file_instead_of_sending_null", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: orders\n  bodyFromFile: missing.json\n";

    // when
    const contract = parseMessagingContract("order.yaml", yaml, { readFile: reader({}) });

    // then
    expect(contract.unreadableFile).toBe(
      'bodyFromFile "missing.json" is not present next to the contract',
    );
    expect(() => messageBody(contract)).toThrow(
      'Messaging contract "order" cannot be sent: bodyFromFile "missing.json" is not present next to the contract',
    );
  });

  it("should_report_a_file_body_when_no_file_reader_is_given", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: orders\n  bodyFromFileAsBytes: order.bin\n";

    // when
    const contract = parseMessagingContract("order", yaml);

    // then
    expect(contract.body).toBeNull();
    expect(() => messageBody(contract)).toThrow(
      /bodyFromFileAsBytes "order.bin" cannot be read: no file reader was given/,
    );
  });

  it("should_report_a_file_that_the_reader_fails_to_read", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: orders\n  bodyFromFile: order.json\n";

    // when
    const contract = parseMessagingContract("order", yaml, {
      readFile: () => {
        throw new Error("EACCES");
      },
    });

    // then
    expect(contract.unreadableFile).toBe('bodyFromFile "order.json" cannot be read: EACCES');
  });

  it("should_report_a_text_file_that_is_not_utf8", () => {
    // given
    const yaml = "outputMessage:\n  sentTo: orders\n  bodyFromFile: order.txt\n";

    // when
    const contract = parseMessagingContract("order", yaml, {
      readFile: reader({ "order.txt": new Uint8Array([0xff, 0xfe, 0x41]) }),
    });

    // then
    expect(contract.unreadableFile).toBe('bodyFromFile "order.txt" is not valid UTF-8 text');
  });
});

describe("loadMessagingContractFile", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "stubborn-messaging-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("should_read_file_bodies_relative_to_the_contract_file", async () => {
    // given
    await mkdir(join(dir, "contracts", "bodies"), { recursive: true });
    await writeFile(join(dir, "contracts", "bodies", "created.json"), '{"type":"created"}\n');
    await writeFile(join(dir, "contracts", "bodies", "photo.bin"), Buffer.from([1, 2, 3]));
    await writeFile(
      join(dir, "contracts", "order_events.yaml"),
      [
        "label: created",
        "outputMessage:",
        "  sentTo: orders",
        "  bodyFromFile: bodies/created.json",
        "---",
        "label: photo",
        "outputMessage:",
        "  sentTo: photos",
        "  bodyFromFileAsBytes: bodies/photo.bin",
        "---",
        "label: missing",
        "outputMessage:",
        "  sentTo: photos",
        "  bodyFromFile: bodies/missing.json",
      ].join("\n"),
    );

    // when
    const contracts = loadMessagingContractFile(join(dir, "contracts", "order_events.yaml"));

    // then
    expect(contracts.map((c) => c.name)).toEqual([
      "order_events",
      "order_events_1",
      "order_events_2",
    ]);
    expect(contracts[0]?.body).toBe('{"type":"created"}');
    expect(Array.from(contracts[1]?.body as Uint8Array)).toEqual([1, 2, 3]);
    expect(contracts[2]?.unreadableFile).toBe(
      'bodyFromFile "bodies/missing.json" is not present next to the contract',
    );
  });
});
