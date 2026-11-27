const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Replies with user information!"),
  async execute(interaction) {
    await interaction.reply(`
            Your username: ${interaction.user.username}\nYour ID: ${interaction.user.id}`);
  },
};
