import {
  ButtonStyle,
  CommandInteraction,
  ComponentType,
  MessageEditOptions,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { ChatGPTUnofficialProxyAPI, ChatMessage } from "chatgpt";
import { threads, event } from "../index.js";


const api = new ChatGPTUnofficialProxyAPI({
  accessToken: process.env.OPENAI_ACCESS_TOKEN!,
  apiReverseProxyUrl: "https://api.pawan.krd/backend-api/conversation"
});

export default {
  data: new SlashCommandBuilder()
    .setName("prompt")
    .setDescription("Prompt chatgpt")
    .addStringOption(option => option.setName("prompt").setDescription("Prompt").setRequired(true)),
  run: async (interaction: CommandInteraction) => {
    let partial: ChatMessage | undefined = undefined;
    const channelId = process.env.CHANNEL_ID!;
    if (interaction.channel?.id !== channelId) {
      return interaction.reply({
        content: `⛔ This command can only be used in <#${channelId}>.`,
        ephemeral: true
      });
    }

    await interaction.deferReply();
    const channel = interaction.channel as TextChannel,
      thread = await channel.threads
        .create({
          name: interaction.user.id
        })
        .catch(() => {
          interaction.editReply({
            content: "❌ Failed to create thread."
          });
          return undefined;
        });
    if (!thread) return;
    thread.members.add(interaction.user.id).catch();
    threads.set(thread.id, { userId: interaction.user.id, res: undefined });
    await interaction.editReply({
      content: `✅ Check out the thread: ${thread.toString()}`
    });
    const txt =
        `${interaction.user.toString()}\n` +
        `**Prompt:** ${interaction.options.get("prompt")!.value as string}\n\n`,
      msg = await thread
        .send({
          content: txt + `**Response:** Thinking <a:loading:781902642267029574>`,
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
        })
        .catch(() => {
          interaction.editReply({
            content: "❌ Failed to send message in thread."
          });
          threads.delete(thread.id);
          thread.delete().catch();
          return undefined;
        });
    if (!msg) return;

    const controller = new AbortController();
    const signal = controller.signal;
    event.once(`abort-${thread.id}`, () => {
      controller.abort();
    });
    const temp = setInterval(() => {
        if (partial) {
          msg
            .edit(
              msgContent(txt + "**Response:** " + partial.text + " <a:loading:781902642267029574>")
            )
            .catch();
          partial = undefined;
        }
      }, 1500),
      res = await api
        .sendMessage(interaction.options.get("prompt")!.value as string, {
          onProgress: progress => {
            partial = progress;
          },
          abortSignal: signal,
          timeoutMs: 5 * 60 * 1000
        })
        .catch(e => {
          console.error(e);
          threads.delete(thread.id);
          thread.delete().catch();
          interaction.editReply({
            content: "💔 Failed to get response.\n" + e.message.slice(0, 1000),
            components: []
          });
          return undefined;
        });
    clearInterval(temp);

    if (!res || !res.text) return;
    threads.set(thread.id, { userId: interaction.user.id, res });

    await msg
      .edit({ ...msgContent(txt + "\n\n**Response:** " + res.text), components: [] })
      .catch();
  }
};

function msgContent(txt: string): MessageEditOptions {
  if (txt.length < 2000) return { content: txt };
  if (txt.length < 4000)
    return {
      content: "",
      embeds: [
        {
          description: txt,
          color: 0x2b2d31
        }
      ]
    };
  else {
    return {
      content: "",
      embeds: [],
      files: [
        {
          name: "response.txt",
          attachment: Buffer.from(txt)
        }
      ]
    };
  }
}

export { api, msgContent };

