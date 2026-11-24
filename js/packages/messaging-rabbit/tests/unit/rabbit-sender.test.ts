import { describe, it, expect, vi, beforeEach } from "vitest";
import { RabbitSender } from "../../src/rabbit-sender.js";
import type { Channel } from "amqplib";

function createMockChannel(): Channel {
  return {
    assertQueue: vi.fn().mockResolvedValue({ queue: "test", messageCount: 0, consumerCount: 0 }),
    sendToQueue: vi.fn().mockReturnValue(true),
    consume: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
    close: vi.fn(),
    assertExchange: vi.fn(),
    publish: vi.fn(),
    deleteQueue: vi.fn(),
    bindQueue: vi.fn(),
    unbindQueue: vi.fn(),
    prefetch: vi.fn(),
    cancel: vi.fn(),
    get: vi.fn(),
    reject: vi.fn(),
    recover: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    removeListener: vi.fn(),
    connection: {} as Channel["connection"],
  } as unknown as Channel;
}

describe("RabbitSender", () => {
  let mockChannel: Channel;
  let sender: RabbitSender;

  beforeEach(() => {
    mockChannel = createMockChannel();
    sender = new RabbitSender(mockChannel);
  });

  it("should assert queue before sending", async () => {
    // when
    await sender.send("notifications", { type: "ORDER_CONFIRMED" });

    // then
    expect(mockChannel.assertQueue).toHaveBeenCalledWith("notifications", { durable: false });
  });

  it("should send JSON payload to the correct queue", async () => {
    // given
    const payload = { type: "ORDER_CONFIRMED", recipient: "user@example.com" };

    // when
    await sender.send("notifications", payload);

    // then
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      "notifications",
      Buffer.from(JSON.stringify(payload)),
      expect.objectContaining({
        contentType: "application/json",
      }),
    );
  });

  it("should send string payload as-is", async () => {
    // when
    await sender.send("queue", "raw string");

    // then
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      "queue",
      Buffer.from("raw string"),
      expect.objectContaining({
        contentType: "application/json",
      }),
    );
  });

  it("should include custom headers", async () => {
    // given
    const headers = { contentType: "application/json", "X-Custom": "value" };

    // when
    await sender.send("queue", { data: true }, headers);

    // then
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      "queue",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "application/json",
        headers: expect.objectContaining({ "X-Custom": "value" }),
      }),
    );
  });

  it("should default contentType to application/json", async () => {
    // when
    await sender.send("queue", { data: true });

    // then
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      "queue",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "application/json",
      }),
    );
  });

  it("should_send_bytes_verbatim_as_octet_stream", async () => {
    // when
    await sender.send("queue", new Uint8Array([0, 1, 255]));

    // then
    const [, content, options] = vi.mocked(mockChannel.sendToQueue).mock.calls[0] ?? [];
    expect(Array.from(content as Buffer)).toEqual([0, 1, 255]);
    expect(options).toEqual(expect.objectContaining({ contentType: "application/octet-stream" }));
  });

  it("should_keep_the_contract_content_type_for_bytes", async () => {
    // when
    await sender.send("queue", new Uint8Array([1]), { contentType: "application/avro" });

    // then
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      "queue",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/avro" }),
    );
  });

  it("should_send_an_empty_message_when_the_contract_has_no_body", async () => {
    // when
    await sender.send("queue", null);

    // then
    const [, content] = vi.mocked(mockChannel.sendToQueue).mock.calls[0] ?? [];
    expect((content as Buffer).length).toBe(0);
  });
});
