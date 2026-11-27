const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const music = require('../../lib/music');
const { resolveTrack } = require('../../lib/ytdlp');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Putar lagu dari judul atau link')
		.addStringOption((option) =>
			option.setName('query').setDescription('Judul atau link lagu').setRequired(true)),

	async execute(interaction) {
		const voiceChannel = interaction.member.voice?.channel;
		if (!voiceChannel) {
			return interaction.reply({ content: 'Masuk ke voice channel dulu.', flags: MessageFlags.Ephemeral });
		}

		const perms = voiceChannel.permissionsFor(interaction.guild.members.me);
		if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
			return interaction.reply({
				content: 'Bot tidak punya izin View Channel, Connect, dan Speak di voice channel itu.',
				flags: MessageFlags.Ephemeral,
			});
		}

		const queue = music.getQueue(interaction.guildId);
		if (queue && queue.channelId !== voiceChannel.id) {
			return interaction.reply({ content: 'Bot sedang dipakai di voice channel lain.', flags: MessageFlags.Ephemeral });
		}
		if (queue && queue.tracks.length >= music.MAX_QUEUE) {
			return interaction.reply({ content: `Antrean penuh (maksimal ${music.MAX_QUEUE} lagu).`, flags: MessageFlags.Ephemeral });
		}

		await interaction.deferReply(); // pencarian bisa lebih dari 3 detik

		try {
			const track = await resolveTrack(interaction.options.getString('query', true));
			const { startedNow, position } = await music.enqueue(interaction, voiceChannel, track);
			await interaction.editReply(startedNow
				? `✅ Memutar: **${track.title}** (${music.formatDuration(track.duration)})`
				: `➕ Masuk antrean #${position}: **${track.title}**`);
		} catch (error) {
			console.error('/play:', error.message);
			await interaction.editReply(`⚠️ ${error.message}`);
		}
	},
};
