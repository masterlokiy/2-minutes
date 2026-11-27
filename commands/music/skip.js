const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../../lib/music');

module.exports = {
	data: new SlashCommandBuilder().setName('skip').setDescription('Lewati lagu yang sedang diputar'),

	async execute(interaction) {
		const queue = music.getQueue(interaction.guildId);
		if (!queue?.current) {
			return interaction.reply({ content: 'Tidak ada lagu yang diputar.', flags: MessageFlags.Ephemeral });
		}
		if (interaction.member.voice?.channelId !== queue.channelId) {
			return interaction.reply({ content: 'Kamu harus berada di voice channel yang sama dengan bot.', flags: MessageFlags.Ephemeral });
		}
		const title = queue.current.title;
		music.skip(queue);
		await interaction.reply(`⏭️ Dilewati: **${title}**`);
	},
};
