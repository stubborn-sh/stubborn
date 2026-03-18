import { Command } from "commander";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { formatOutput, formatSuccess } from "../formatter.js";

export function createTagCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("tag").description("Manage version tags");

  cmd
    .command("list")
    .description("List tags for a version")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .action(async (opts: { app: string; version: string }) => {
      const tags = await getClient().listTags(opts.app, opts.version);
      console.log(
        formatOutput(
          tags.map((t) => ({ tag: t.tag, version: t.version, createdAt: t.createdAt })),
          getFormat(),
        ),
      );
    });

  cmd
    .command("add")
    .description("Add a tag to a version")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .requiredOption("-t, --tag <tag>", "Tag name")
    .action(async (opts: { app: string; version: string; tag: string }) => {
      await getClient().addTag(opts.app, opts.version, opts.tag);
      console.log(formatSuccess(`Tag "${opts.tag}" added to ${opts.app}@${opts.version}.`));
    });

  cmd
    .command("remove")
    .description("Remove a tag from a version")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .requiredOption("-t, --tag <tag>", "Tag name")
    .action(async (opts: { app: string; version: string; tag: string }) => {
      await getClient().removeTag(opts.app, opts.version, opts.tag);
      console.log(formatSuccess(`Tag "${opts.tag}" removed from ${opts.app}@${opts.version}.`));
    });

  cmd
    .command("latest")
    .description("Get latest version by tag")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-t, --tag <tag>", "Tag name")
    .action(async (opts: { app: string; tag: string }) => {
      const result = await getClient().getLatestVersionByTag(opts.app, opts.tag);
      console.log(result.version);
    });

  return cmd;
}
