import { describe, it, expect, beforeEach } from "vitest";
import { MessageStub } from "../../src/message-stub.js";

describe("MessageStub", () => {
  let stub: MessageStub;

  beforeEach(() => {
    stub = new MessageStub();
  });

  it("should send and receive a message", async () => {
    // given
    const payload = { id: "123", status: "ACCEPTED" };
    const headers = { contentType: "application/json" };

    // when
    await stub.send("verifications", payload, headers);
    const received = await stub.receive("verifications");

    // then
    expect(received).not.toBeNull();
    expect(received?.destination).toBe("verifications");
    expect(received?.payload).toEqual(payload);
    expect(received?.headers).toEqual(headers);
  });

  it("should return null when no messages available", async () => {
    // when
    const received = await stub.receive("empty-topic");

    // then
    expect(received).toBeNull();
  });

  it("should consume messages in FIFO order", async () => {
    // given
    await stub.send("topic", { order: 1 });
    await stub.send("topic", { order: 2 });
    await stub.send("topic", { order: 3 });

    // when
    const first = await stub.receive("topic");
    const second = await stub.receive("topic");
    const third = await stub.receive("topic");
    const fourth = await stub.receive("topic");

    // then
    expect(first?.payload).toEqual({ order: 1 });
    expect(second?.payload).toEqual({ order: 2 });
    expect(third?.payload).toEqual({ order: 3 });
    expect(fourth).toBeNull();
  });

  it("should isolate messages by destination", async () => {
    // given
    await stub.send("topic-a", { from: "a" });
    await stub.send("topic-b", { from: "b" });

    // when
    const fromA = await stub.receive("topic-a");
    const fromB = await stub.receive("topic-b");

    // then
    expect(fromA?.payload).toEqual({ from: "a" });
    expect(fromB?.payload).toEqual({ from: "b" });
  });

  it("should default headers to empty object when not provided", async () => {
    // given
    await stub.send("topic", { data: true });

    // when
    const received = await stub.receive("topic");

    // then
    expect(received?.headers).toEqual({});
  });

  it("should return all messages for a destination via getMessages", async () => {
    // given
    await stub.send("topic", { order: 1 });
    await stub.send("topic", { order: 2 });

    // when
    const messages = stub.getMessages("topic");

    // then
    expect(messages).toHaveLength(2);
    expect(messages[0]?.payload).toEqual({ order: 1 });
    expect(messages[1]?.payload).toEqual({ order: 2 });
  });

  it("should return empty array for unknown destination via getMessages", () => {
    // when
    const messages = stub.getMessages("unknown");

    // then
    expect(messages).toHaveLength(0);
  });

  it("should return all messages across destinations via getAllMessages", async () => {
    // given
    await stub.send("topic-a", { from: "a" });
    await stub.send("topic-b", { from: "b" });

    // when
    const all = stub.getAllMessages();

    // then
    expect(all).toHaveLength(2);
  });

  it("should clear all messages on reset", async () => {
    // given
    await stub.send("topic-a", { data: 1 });
    await stub.send("topic-b", { data: 2 });

    // when
    stub.reset();

    // then
    expect(stub.getAllMessages()).toHaveLength(0);
    expect(await stub.receive("topic-a")).toBeNull();
    expect(await stub.receive("topic-b")).toBeNull();
  });

  it("should clear all messages on close", async () => {
    // given
    await stub.send("topic", { data: 1 });

    // when
    await stub.close();

    // then
    expect(stub.getAllMessages()).toHaveLength(0);
  });
});
