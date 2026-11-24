import type { Channel } from "amqplib";
import type { MessageSender } from "@stubborn-sh/messaging";

/**
 * {@link MessageSender} implementation using amqplib.
 * Sends messages to RabbitMQ queues/exchanges.
 */
export class RabbitSender implements MessageSender {
  constructor(private readonly channel: Channel) {}

  async send(
    destination: string,
    payload: unknown,
    headers?: Readonly<Record<string, string>>,
  ): Promise<void> {
    // As the JVM building block: bytes are sent verbatim (application/octet-stream unless the
    // contract says otherwise), and a contract without a body sends an empty message.
    const binary = payload instanceof Uint8Array;
    const content =
      payload === null || payload === undefined
        ? Buffer.alloc(0)
        : binary
          ? Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength)
          : typeof payload === "string"
            ? Buffer.from(payload)
            : Buffer.from(JSON.stringify(payload));

    const messageHeaders: Record<string, string> = {};
    if (headers !== undefined) {
      for (const [key, val] of Object.entries(headers)) {
        messageHeaders[key] = val;
      }
    }

    await this.channel.assertQueue(destination, { durable: false });

    this.channel.sendToQueue(destination, content, {
      contentType:
        messageHeaders["contentType"] ?? (binary ? "application/octet-stream" : "application/json"),
      headers: messageHeaders,
    });
  }
}
