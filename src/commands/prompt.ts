import { CommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { ChatGPTUnofficialProxyAPI, ChatMessage } from "chatgpt";
export default {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Prompt chatgpt")
    .addStringOption(option => option.setName("prompt").setDescription("Prompt").setRequired(true)),
  run: async (interaction: CommandInteraction) => {
    const api = new ChatGPTUnofficialProxyAPI({
      accessToken: process.env.OPENAI_ACCESS_TOKEN!,
      apiReverseProxyUrl: "https://api.pawan.krd/backend-api/conversation",
      debug: true
    });
    let partial: ChatMessage | undefined = undefined;
    if (
      !interaction.channel?.isTextBased() ||
      interaction.channel?.isDMBased() ||
      interaction.channel?.isThread()
    ) {
      return interaction.reply({
        content: "⚠ This command can only be used in a guild text channel.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel as TextChannel,
      thread = await channel.threads
        .create({
          name: interaction.user.username
        })
        .catch(() => {
          interaction.editReply({
            content: "⚠ Failed to create thread."
          });
          return undefined;
        });
    if (!thread) return;
    const txt =
        `${interaction.user.toString()}\n` +
        `Prompt: ${interaction.options.get("prompt")!.value as string}`,
      msg = await thread.send(txt).catch(() => {
        interaction.editReply({
          content: "⚠ Failed to send message in thread."
        });
        return undefined;
      });
    if (!msg) return;
    const temp = setInterval(() => {
        if (partial) {
          msg.edit(txt + "\n\n**Response:** " + partial.text).catch();
          partial = undefined;
        }
      }, 1500),
      res = await api.sendMessage(interaction.options.get("prompt")!.value as string, {
        onProgress: progress => {
          partial = progress;
        },
        timeoutMs: 2 * 60 * 1000
      });
    clearInterval(temp);
    await msg.edit(txt + "\n\n**Response:** " + res.text);
  }
};

