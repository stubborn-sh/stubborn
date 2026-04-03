import type { Producer, Kafka } from "kafkajs";
import type { MessageSender } from "@stubborn-sh/messaging";

/**
 * {@link MessageSender} implementation using kafkajs Producer.
 * Sends messages to Kafka topics with headers.
 */
export class KafkaSender implements MessageSender {
  private readonly producer: Producer;
  private connected = false;

  constructor(kafka: Kafka) {
    this.producer = kafka.producer();
  }

  async send(
    destination: string,
    payload: unknown,
    headers?: Readonly<Record<string, string>>,
  ): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }

    const value = typeof payload === "string" ? payload : JSON.stringify(payload);

    const kafkaHeaders: Record<string, string> = {};
    if (headers !== undefined) {
      for (const [key, val] of Object.entries(headers)) {
        kafkaHeaders[key] = val;
      }
    }
    if (kafkaHeaders["contentType"] === undefined) {
      kafkaHeaders["contentType"] = "application/json";
    }

    await this.producer.send({
      topic: destination,
      messages: [{ value, headers: kafkaHeaders }],
    });
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}
