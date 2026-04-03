/** Direction a message flows relative to the application under test. */
export type MessageDirection = "PUBLISH" | "SUBSCRIBE";

/** A message received from a broker or stub. */
export interface ReceivedMessage {
  readonly destination: string;
  readonly payload: unknown;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Sends messages to a destination (topic/queue).
 * JS equivalent of SCC's {@code MessageVerifierSender<Message<?>>}.
 */
export interface MessageSender {
  send(
    destination: string,
    payload: unknown,
    headers?: Readonly<Record<string, string>>,
  ): Promise<void>;
}

/**
 * Receives messages from a destination (topic/queue).
 * JS equivalent of SCC's {@code MessageVerifierReceiver<Message<?>>}.
 */
export interface MessageReceiver {
  receive(destination: string, timeoutMs?: number): Promise<ReceivedMessage | null>;
  close(): Promise<void>;
}

/** Parsed messaging contract from a YAML file. */
export interface MessagingContract {
  readonly name: string;
  readonly description: string;
  readonly label: string;
  readonly destination: string;
  readonly direction: MessageDirection;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly triggeredBy?: string;
}

/** Configuration for messaging stub setup. */
export interface MessagingStubConfig {
  /** Broker URL to fetch contracts from. */
  readonly brokerUrl: string;
  /** Application name whose messaging contracts to load. */
  readonly applicationName: string;
  /** Version of the application. */
  readonly version: string;
  /** Broker authentication. */
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
}
