import { CommandInteraction, SlashCommandBuilder } from "discord.js";
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
    await interaction.deferReply();
    let partial: ChatMessage | undefined = undefined;

    const temp = setInterval(() => {
      if (partial) {
        interaction.editReply(partial.text);
        partial = undefined;
      }
    }, 1500);
    const res = await api.sendMessage(interaction.options.get("prompt")!.value as string, {
      onProgress: progress => {
        partial = progress;
      }
    });
    clearInterval(temp);
    await interaction.editReply(res.text);
  }
};

