import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!"),
  run: async (interaction: CommandInteraction) => {
    await interaction.reply(`Pong! ${interaction.client.ws.ping}ms`);
  }
};

