import type { BrokerClientConfig } from "@stubborn-sh/broker-client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** CLI-specific configuration. */
export interface CliConfig extends BrokerClientConfig {
  readonly format: "json" | "table";
}

interface ConfigFile {
  brokerUrl?: string;
  username?: string;
  password?: string;
  token?: string;
  format?: string;
}

/**
 * Resolve CLI config from flags → env vars → config file → defaults.
 * Priority: flags > env > config file > defaults.
 */
export async function resolveCliConfig(flags: Partial<CliConfig>): Promise<CliConfig> {
  const configFile = await loadConfigFile();

  const baseUrl =
    flags.baseUrl ??
    process.env["SCC_BROKER_URL"] ??
    configFile?.brokerUrl ??
    "http://localhost:8080";

  const username = flags.username ?? process.env["SCC_BROKER_USERNAME"] ?? configFile?.username;

  const password = flags.password ?? process.env["SCC_BROKER_PASSWORD"] ?? configFile?.password;

  const token = flags.token ?? process.env["SCC_BROKER_TOKEN"] ?? configFile?.token;

  const rawFormat =
    flags.format ??
    (process.env["SCC_BROKER_FORMAT"] as "json" | "table" | undefined) ??
    (configFile?.format as "json" | "table" | undefined) ??
    "table";
  const format: "json" | "table" = rawFormat === "json" ? "json" : "table";

  return { baseUrl, username, password, token, format };
}

async function loadConfigFile(): Promise<ConfigFile | null> {
  const configPath = join(
    process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".",
    ".stubborn.json",
  );

  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as ConfigFile;
  } catch {
    return null;
  }
}
