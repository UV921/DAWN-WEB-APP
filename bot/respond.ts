import {
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

function errText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

/** Reply, edit, or DM — never throw on expired Discord interactions. */
export async function safeRespond(
  interaction: ChatInputCommandInteraction,
  content: string
): Promise<"edit" | "reply" | "dm" | "none"> {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
      return "edit";
    }
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    return "reply";
  } catch (e) {
    console.error(`[cmd] slash-reply-failed ${errText(e)}`);
    try {
      await interaction.user.send(content);
      console.log(`[cmd] result sent via DM to ${interaction.user.id}`);
      return "dm";
    } catch (dm) {
      console.error(`[cmd] dm-failed ${errText(dm)}`);
      return "none";
    }
  }
}
