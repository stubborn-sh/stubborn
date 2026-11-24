import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendToQueue, listContracts } = vi.hoisted(() => ({
  sendToQueue: vi.fn().mockReturnValue(true),
  listContracts: vi.fn(),
}));

vi.mock("amqplib", () => ({
  default: {
    connect: vi.fn().mockResolvedValue({
      createChannel: vi.fn().mockResolvedValue({
        assertQueue: vi.fn().mockResolvedValue({}),
        sendToQueue,
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@stubborn-sh/broker-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@stubborn-sh/broker-client")>()),
  BrokerClient: class {
    listContracts = listContracts;
  },
}));

import { setupRabbitStubs, teardownRabbitStubs } from "../../src/setup.js";

describe("setupRabbitStubs", () => {
  beforeEach(() => {
    sendToQueue.mockClear();
    listContracts.mockResolvedValue({
      content: [
        {
          contractName: "messaging/photos",
          content: [
            "- label: photo_taken",
            "  outputMessage:",
            "    sentTo: photos",
            "    bodyFromFileAsBytes: photo.bin",
            "- label: photo_deleted",
            "  outputMessage:",
            "    sentTo: photos",
          ].join("\n"),
          contentType: "application/x-spring-cloud-contract+yaml",
        },
      ],
      totalPages: 1,
    });
  });

  afterEach(async () => {
    await teardownRabbitStubs();
  });

  const config = {
    brokerUrl: "http://broker",
    applicationName: "photos",
    version: "1.0.0",
    amqpUrl: "amqp://localhost",
  };

  it("should_load_every_contract_of_a_list_document", async () => {
    // when
    const ctx = await setupRabbitStubs(config);

    // then
    expect(ctx.contracts.map((c) => c.name)).toEqual(["photos_0", "photos_0"]);
    expect(ctx.contracts.map((c) => c.label)).toEqual(["photo_taken", "photo_deleted"]);
  });

  it("should_trigger_a_contract_with_its_bytes_read_through_the_config", async () => {
    // given
    const ctx = await setupRabbitStubs({
      ...config,
      readContractFile: (name, path) =>
        name === "messaging/photos" && path === "photo.bin" ? new Uint8Array([7, 8]) : undefined,
    });

    // when
    await ctx.trigger("photo_taken");

    // then
    const [queue, content, options] = sendToQueue.mock.calls[0] ?? [];
    expect(queue).toBe("photos");
    expect(Array.from(content as Buffer)).toEqual([7, 8]);
    expect(options).toEqual(expect.objectContaining({ contentType: "application/octet-stream" }));
  });

  it("should_fail_to_trigger_a_contract_whose_file_body_is_missing", async () => {
    // given
    const ctx = await setupRabbitStubs({ ...config, readContractFile: () => undefined });

    // when/then
    await expect(ctx.trigger("photo_taken")).rejects.toThrow(
      'bodyFromFileAsBytes "photo.bin" is not present next to the contract',
    );
    expect(sendToQueue).not.toHaveBeenCalled();
  });
});
