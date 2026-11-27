const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../../lib/music');

module.exports = {
	data: new SlashCommandBuilder().setName('stop').setDescription('Hentikan musik dan keluar dari voice channel'),

	async execute(interaction) {
		const queue = music.getQueue(interaction.guildId);
		if (!queue) {
			return interaction.reply({ content: 'Bot tidak sedang memutar apa pun.', flags: MessageFlags.Ephemeral });
		}
		if (interaction.member.voice?.channelId !== queue.channelId) {
			return interaction.reply({ content: 'Kamu harus berada di voice channel yang sama dengan bot.', flags: MessageFlags.Ephemeral });
		}
		music.destroyQueue(interaction.guildId);
		await interaction.reply('⏹️ Musik dihentikan.');
	},
};
