import {
  ButtonStyle,
  CommandInteraction,
  ComponentType,
  GuildTextBasedChannel,
  SlashCommandBuilder
} from "discord.js";
import { api, msgContent } from "./conversation.js";
import { event } from "../index.js";
import { ChatMessage } from "chatgpt";
export default {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Prompt ChatGPT without starting a conversation.")
    .addStringOption(option =>
      option.setName("prompt").setDescription("Prompt").setMaxLength(1024).setRequired(true)
    ),
  run: async (interaction: CommandInteraction) => {
    let partial: ChatMessage | undefined = undefined;
    const msg = await interaction.reply({
      content: "<a:loading:781902642267029574>",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Danger,
              label: "Abort",
              customId: "abort"
            }
          ]
        }
      ]
    });
    const controller = new AbortController();
    const signal = controller.signal;
    event.once(`abort-${interaction.channel!.id}-${msg.id}`, () => {
      controller.abort();
    });
    const temp = setInterval(() => {
        if (partial) {
          interaction
            .editReply(msgContent(partial.text + " <a:loading:781902642267029574>"))
            .catch();
          partial = undefined;
        }
      }, 1500),
      channel = interaction.channel as GuildTextBasedChannel,
      sysMsg = `You are a Discord bot. You are currently in a 
      channel called ${channel.name} in a server called ${channel.guild.name}. 
      You are talking to a human. The human is a Discord user. 
      The human's username is ${interaction.user.username}.
      You are to respond to the human's message as shortly as possible.
      The human's message is:\n`,
      res = await api
        .sendMessage((sysMsg + interaction.options.get("prompt")!.value) as string, {
          onProgress: progress => {
            partial = progress;
          },
          abortSignal: signal,
          timeoutMs: 5 * 60 * 1000
        })
        .catch(e => {
          console.error(e);
          interaction.editReply({
            content: "💔 Failed to get response.\n" + e.message.slice(0, 1000),
            components: []
          });
          return undefined;
        });
    clearInterval(temp);
    if (!res || !res.text) return;
    await interaction.editReply({ ...msgContent(res.text), components: [] });
  }
};

