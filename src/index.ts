import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  CommandInteraction,
  SlashCommandBuilder
} from "discord.js";
import { fileURLToPath } from "url";
import { ChatMessage } from "chatgpt";
import path, { dirname } from "path";
import prompt, { api, msgContent } from "./commands/prompt.js";
import fs from "fs";
import Keyv from "keyv";

const threads = new Keyv(process.env.MONGO_URI!);
threads.on("error", (err: any) => console.error("Keyv connection error:", err));

const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  }),
  commands: Collection<string, MyCommand> = new Collection(),
  __filename = fileURLToPath(import.meta.url),
  __dirname = dirname(__filename),
  commandsPath = path.join(__dirname, "commands"),
  commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js") && !file.startsWith("prompt"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file),
    command = (await import(filePath)).default as MyCommand;
  if ("data" in command && "run" in command) {
    commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "run" property.`
    );
  }
}
commands.set(prompt.data.name, prompt as MyCommand);

client.once(Events.ClientReady, client => {
  console.log("Ready!");
  client.application.commands
    .set([...commands.map(c => c.data)], process.env.GUILD_ID!)
    .then(c => console.log(`Registered ${c.size} commands.`));
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.run(interaction, threads);
  } catch (error) {
    console.error(error);
    const errorMsg = {
      content: "There was an error while executing this command!",
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) await interaction.followUp(errorMsg);
    else await interaction.reply(errorMsg);
  }
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.channel.isThread() || message.channel.parentId !== process.env.CHANNEL_ID!) return;
  if (!message.mentions.has(client.user!)) return;
  const { userId, res: prevRes } = await threads.get(message.channelId);
  if (!prevRes || message.author.id !== userId) return;
  message.content = message.content.replace(client.user!.toString(), "").trim();
  let partial: ChatMessage | undefined = undefined;

  const msg = await message.reply("<a:loading:781902642267029574>").catch();
  if (!msg) return;

  const temp = setInterval(() => {
    if (partial) {
      msg.edit(msgContent(partial.text + " <a:loading:781902642267029574>")).catch();
      partial = undefined;
    }
  }, 1500);

  const res = await api
    .sendMessage(message.content, {
      onProgress: progress => {
        partial = progress;
      },
      parentMessageId: prevRes.parentMessageId,
      conversationId: prevRes.conversationId,
      timeoutMs: 5 * 60 * 1000
    })
    .catch(e => {
      console.error(e);
      msg.edit("💔 Failed to get response.\n" + e.message).catch();
      return undefined;
    });
  clearInterval(temp);

  if (!res || !res.text) return;
  threads.set(msg.channel.id, { userId: message.author.id, res });
  await msg.edit(msgContent(res.text)).catch();
});

client.login(process.env.TOKEN);

interface MyCommand {
  data: SlashCommandBuilder;
  run: (
    interaction: CommandInteraction,
    threads?: Keyv<any, Record<string, unknown>>
  ) => Promise<void>;
}

export { client, commands, threads };

