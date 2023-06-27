import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import util from "util";
export default {
  data: new SlashCommandBuilder()
    .setName("eval")
    .setDescription("Evaluate a JavaScript expression.")
    .addStringOption(option =>
      option.setName("expression").setDescription("The expression to evaluate.").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("depth").setDescription("The depth to evaluate the expression to.")
    )
    .addBooleanOption(option =>
      option
        .setName("ephemeral")
        .setDescription("Whether to send the result as an ephemeral message.")
    ),
  run: async (interaction: CommandInteraction) => {
    const expression = interaction.options.get("expression", true).value as string,
      depth = (interaction.options.get("depth", false)?.value as number) ?? 1,
      ephemeral = (interaction.options.get("ephemeral", false)?.value as boolean) ?? false;

    if (interaction.member?.user.id !== process.env.OWNER_ID)
      return await interaction.reply({
        content: "You are not allowed to use this command",
        ephemeral: true
      });

    await interaction.deferReply({ ephemeral });
    let evaled;
    try {
      evaled = await eval(expression);
    } catch (error) {
      evaled = error;
    }
    const result = util.inspect(evaled, { depth });
    result.length > 1990
      ? interaction.editReply({
          content: `Output:`,
          files: [{ attachment: Buffer.from(result), name: "output.txt" }]
        })
      : interaction.editReply({ content: `\`\`\`js\n${result}\n\`\`\`` });
  }
};

