const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const music = require('../../lib/music');

module.exports = {
	data: new SlashCommandBuilder().setName('queue').setDescription('Lihat antrean lagu'),

	async execute(interaction) {
		const queue = music.getQueue(interaction.guildId);
		if (!queue?.current) {
			return interaction.reply({ content: 'Antrean kosong.', flags: MessageFlags.Ephemeral });
		}
		const lines = [`**Sekarang:** ${queue.current.title} (${music.formatDuration(queue.current.duration)})`];
		queue.tracks.slice(0, 10).forEach((t, i) => {
			lines.push(`${i + 1}. ${t.title} (${music.formatDuration(t.duration)})`);
		});
		if (queue.tracks.length > 10) lines.push(`...dan ${queue.tracks.length - 10} lagu lagi`);
		await interaction.reply(lines.join('\n'));
	},
};
