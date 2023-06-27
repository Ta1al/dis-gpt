import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  CommandInteraction,
  SlashCommandBuilder
} from "discord.js";
import fs from "fs";
import path, { dirname } from "path";
import "dotenv/config";
import { fileURLToPath } from "url";
import Keyv from "keyv";
import prompt from "./commands/prompt.js";

const threads = new Keyv(process.env.MONGO_URI!);
threads.on("error", (err: any) => console.error("Keyv connection error:", err));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  }),
  commands: Collection<string, MyCommand> = new Collection(),
  __filename = fileURLToPath(import.meta.url),
  __dirname = dirname(__filename),
  commandsPath = path.join(__dirname, "commands"),
  commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

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
    await command.run(interaction, commands);
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

client.login(process.env.TOKEN);

interface MyCommand {
  data: SlashCommandBuilder;
  run: (interaction: CommandInteraction, commands?: Collection<string, MyCommand>) => Promise<void>;
}

