import { CommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { ChatGPTUnofficialProxyAPI, ChatMessage } from "chatgpt";
import { threads } from "../index.js";

const api = new ChatGPTUnofficialProxyAPI({
  accessToken: process.env.OPENAI_ACCESS_TOKEN!,
  apiReverseProxyUrl: "https://api.pawan.krd/backend-api/conversation"
});

export { api };
export default {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Prompt chatgpt")
    .addStringOption(option => option.setName("prompt").setDescription("Prompt").setRequired(true)),
  run: async (interaction: CommandInteraction) => {
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
    await interaction.editReply({
      content: `✅ Check out the thread: ${thread.toString()}`
    });
    const txt =
        `${interaction.user.toString()}\n` +
        `**Prompt:** ${interaction.options.get("prompt")!.value as string}\n\n`,
      msg = await thread
        .send(txt + `**Response:** Thinking <a:loading:781902642267029574>`)
        .catch(() => {
          interaction.editReply({
            content: "⚠ Failed to send message in thread."
          });
          return undefined;
        });
    if (!msg) return;
    const temp = setInterval(() => {
        if (partial) {
          msg.edit(txt + "**Response:** " + partial.text).catch();
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
    if (!res || !res.text) {
      await msg.edit(txt + "\n\n**Response:** ⚠ Failed to get response.");
      return;
    }
    threads.set(thread.id, res);

    await msg.edit(txt + "\n\n**Response:** " + res.text);
  }
};

