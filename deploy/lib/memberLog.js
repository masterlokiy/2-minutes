'use strict';

const { Events, EmbedBuilder } = require('discord.js');

const { LOG_CHANNEL_ID } = process.env;

async function sendLog(guild, embed) {
	if (!LOG_CHANNEL_ID) return;
	const channel = guild.channels.cache.get(LOG_CHANNEL_ID)
		?? await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
	if (channel?.isTextBased()) {
		channel.send({ embeds: [embed] }).catch((e) => console.error('Log gagal:', e.message));
	}
}

function register(client) {
	client.on(Events.GuildMemberAdd, (member) => {
		const embed = new EmbedBuilder()
			.setColor(0x57f287)
			.setTitle('Member masuk')
			.setDescription(`${member} (**${member.user.username}**)`)
			.addFields(
				{ name: 'Akun dibuat', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
				{ name: 'Total member', value: String(member.guild.memberCount) },
			)
			.setThumbnail(member.user.displayAvatarURL())
			.setFooter({ text: `ID: ${member.id}` })
			.setTimestamp();
		sendLog(member.guild, embed);
	});

	client.on(Events.GuildMemberRemove, (member) => {
		const embed = new EmbedBuilder()
			.setColor(0xed4245)
			.setTitle('Member keluar')
			.setDescription(`**${member.user.username}**`)
			.addFields({ name: 'Total member', value: String(member.guild.memberCount) })
			.setThumbnail(member.user.displayAvatarURL())
			.setFooter({ text: `ID: ${member.id}` })
			.setTimestamp();
		if (member.joinedTimestamp) {
			embed.addFields({ name: 'Bergabung', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` });
		}
		sendLog(member.guild, embed);
	});
}

module.exports = { register };
