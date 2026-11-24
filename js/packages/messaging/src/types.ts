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
  /**
   * The payload: `outputMessage.body`, the text of `outputMessage.bodyFromFile`, or the bytes
   * (`Uint8Array`) of `outputMessage.bodyFromFileAsBytes`. Null when the contract has none, or
   * when its file could not be read (see {@link unreadableFile}).
   */
  readonly body: unknown;
  readonly triggeredBy?: string;
  /**
   * Set when the body comes from a file that could not be read, describing which file and why.
   * Such a contract cannot be sent: `messageBody(contract)` throws.
   */
  readonly unreadableFile?: string;
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
  /**
   * Reads a file that a contract from the broker references (`outputMessage.bodyFromFile`,
   * `outputMessage.bodyFromFileAsBytes`): the broker stores contracts, not these files. Given
   * the broker contract name and the path as written in the contract (relative to the contract
   * file); returns undefined when the file does not exist. Without it, triggering such a
   * contract fails with an error naming the missing file.
   */
  readonly readContractFile?: (
    contractName: string,
    relativePath: string,
  ) => Uint8Array | undefined;
}
