import type { Kafka, Producer } from "kafkajs";

export interface VerificationResult {
  readonly id: string;
  readonly status: string;
  readonly reason: string;
}

export class VerificationService {
  private readonly producer: Producer;
  private connected = false;

  constructor(kafka: Kafka) {
    this.producer = kafka.producer();
  }

  async sendVerificationResult(result: VerificationResult): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
    await this.producer.send({
      topic: "verifications",
      messages: [
        {
          key: result.id,
          value: JSON.stringify(result),
          headers: { contentType: "application/json" },
        },
      ],
    });
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}
