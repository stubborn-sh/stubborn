import { describe, it, expect, vi, beforeEach } from "vitest";
import { KafkaSender } from "../../src/kafka-sender.js";
import type { Kafka, Producer } from "kafkajs";

function createMockProducer(): Producer {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    sendBatch: vi.fn(),
    transaction: vi.fn(),
    events: {} as Producer["events"],
    on: vi.fn(),
    logger: vi.fn() as unknown as Producer["logger"],
  };
}

function createMockKafka(producer: Producer): Kafka {
  return {
    producer: () => producer,
    consumer: vi.fn(),
    admin: vi.fn(),
    logger: vi.fn() as unknown as Kafka["logger"],
  };
}

describe("KafkaSender", () => {
  let mockProducer: Producer;
  let sender: KafkaSender;

  beforeEach(() => {
    mockProducer = createMockProducer();
    const mockKafka = createMockKafka(mockProducer);
    sender = new KafkaSender(mockKafka);
  });

  it("should connect on first send", async () => {
    // when
    await sender.send("topic", { data: true });

    // then
    expect(mockProducer.connect).toHaveBeenCalledOnce();
  });

  it("should not reconnect on subsequent sends", async () => {
    // when
    await sender.send("topic", { data: 1 });
    await sender.send("topic", { data: 2 });

    // then
    expect(mockProducer.connect).toHaveBeenCalledOnce();
  });

  it("should send JSON payload to the correct topic", async () => {
    // given
    const payload = { id: "vrf-001", status: "ACCEPTED" };

    // when
    await sender.send("verifications", payload);

    // then
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: "verifications",
      messages: [
        {
          value: JSON.stringify(payload),
          headers: { contentType: "application/json" },
        },
      ],
    });
  });

  it("should send string payload as-is", async () => {
    // when
    await sender.send("topic", "raw string");

    // then
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: "topic",
      messages: [
        {
          value: "raw string",
          headers: { contentType: "application/json" },
        },
      ],
    });
  });

  it("should include custom headers", async () => {
    // given
    const headers = { contentType: "application/json", "X-Custom": "value" };

    // when
    await sender.send("topic", { data: true }, headers);

    // then
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: "topic",
      messages: [
        {
          value: '{"data":true}',
          headers: { contentType: "application/json", "X-Custom": "value" },
        },
      ],
    });
  });

  it("should add contentType header when not provided", async () => {
    // when
    await sender.send("topic", { data: true }, { "X-Custom": "value" });

    // then
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: "topic",
      messages: [
        {
          value: '{"data":true}',
          headers: { "X-Custom": "value", contentType: "application/json" },
        },
      ],
    });
  });

  it("should disconnect on close", async () => {
    // given
    await sender.send("topic", { data: true });

    // when
    await sender.close();

    // then
    expect(mockProducer.disconnect).toHaveBeenCalledOnce();
  });

  it("should not disconnect when not connected", async () => {
    // when
    await sender.close();

    // then
    expect(mockProducer.disconnect).not.toHaveBeenCalled();
  });
});
