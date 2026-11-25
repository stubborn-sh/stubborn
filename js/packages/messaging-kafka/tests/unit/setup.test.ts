import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { send, listContracts } = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue(undefined),
  listContracts: vi.fn(),
}));

vi.mock("kafkajs", () => ({
  Kafka: class {
    producer(): unknown {
      return { connect: vi.fn(), disconnect: vi.fn(), send };
    }
    consumer(): unknown {
      return { connect: vi.fn(), disconnect: vi.fn(), subscribe: vi.fn(), run: vi.fn() };
    }
  },
}));

vi.mock("@stubborn-sh/broker-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@stubborn-sh/broker-client")>()),
  BrokerClient: class {
    listContracts = listContracts;
  },
}));

import { setupKafkaStubs, teardownKafkaStubs } from "../../src/setup.js";

const CONTRACT = [
  "label: order_created",
  "outputMessage:",
  "  sentTo: orders",
  "  bodyFromFile: bodies/created.json",
  "---",
  "label: order_deleted",
  "outputMessage:",
  "  sentTo: orders",
  "  body:",
  "    id: 1",
].join("\n");

describe("setupKafkaStubs", () => {
  beforeEach(() => {
    send.mockClear();
    listContracts.mockResolvedValue({
      content: [
        {
          contractName: "order_events",
          content: CONTRACT,
          contentType: "application/x-spring-cloud-contract+yaml",
        },
      ],
      totalPages: 1,
    });
  });

  afterEach(async () => {
    await teardownKafkaStubs();
  });

  const config = {
    brokerUrl: "http://broker",
    applicationName: "orders",
    version: "1.0.0",
    bootstrapServers: "localhost:9092",
  };

  it("should_load_every_contract_of_a_multi_document_file", async () => {
    // when
    const ctx = await setupKafkaStubs(config);

    // then
    expect(ctx.contracts.map((c) => c.name)).toEqual(["order_events", "order_events_1"]);
    expect(ctx.contracts.map((c) => c.label)).toEqual(["order_created", "order_deleted"]);
  });

  it("should_trigger_a_contract_with_its_file_body_read_through_the_config", async () => {
    // given
    const readContractFile = vi.fn().mockReturnValue(new TextEncoder().encode('{"id":1}\n'));
    const ctx = await setupKafkaStubs({ ...config, readContractFile });

    // when
    await ctx.trigger("order_created");

    // then
    expect(readContractFile).toHaveBeenCalledWith("order_events", "bodies/created.json");
    expect(send).toHaveBeenCalledWith({
      topic: "orders",
      messages: [{ value: '{"id":1}', headers: { contentType: "application/json" } }],
    });
  });

  it("should_fail_to_trigger_a_contract_whose_file_body_cannot_be_read", async () => {
    // given
    const ctx = await setupKafkaStubs(config);

    // when/then
    await expect(ctx.trigger("order_created")).rejects.toThrow(
      'Messaging contract "order_events" cannot be sent: bodyFromFile "bodies/created.json" cannot be read',
    );
    expect(send).not.toHaveBeenCalled();
  });
});
