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
    const content =
      typeof payload === "string" ? Buffer.from(payload) : Buffer.from(JSON.stringify(payload));

    const messageHeaders: Record<string, string> = {};
    if (headers !== undefined) {
      for (const [key, val] of Object.entries(headers)) {
        messageHeaders[key] = val;
      }
    }

    await this.channel.assertQueue(destination, { durable: false });

    this.channel.sendToQueue(destination, content, {
      contentType: messageHeaders["contentType"] ?? "application/json",
      headers: messageHeaders,
    });
  }
}
