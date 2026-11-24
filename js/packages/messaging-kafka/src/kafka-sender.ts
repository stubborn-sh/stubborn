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

    // As the JVM building block: bytes are sent verbatim (application/octet-stream unless the
    // contract says otherwise), and a contract without a body sends a record with no value.
    const binary = payload instanceof Uint8Array;
    const value =
      payload === null || payload === undefined
        ? null
        : binary
          ? Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength)
          : typeof payload === "string"
            ? payload
            : JSON.stringify(payload);

    const kafkaHeaders: Record<string, string> = {};
    if (headers !== undefined) {
      for (const [key, val] of Object.entries(headers)) {
        kafkaHeaders[key] = val;
      }
    }
    if (kafkaHeaders["contentType"] === undefined) {
      kafkaHeaders["contentType"] = binary ? "application/octet-stream" : "application/json";
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
