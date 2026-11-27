const fs = require('node:fs');
const path = require('node:path');
const {
	Client, Collection, Events, GatewayIntentBits, MessageFlags, Options,
} = require('discord.js');
const { ensureYtDlp } = require('./lib/ytdlp');
const memberLog = require('./lib/memberLog');
const music = require('./lib/music');

const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN) {
	console.error('DISCORD_TOKEN belum terbaca. Jalankan dengan: npm start (atau node --env-file=.env index.js)');
	process.exit(1);
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers, // log masuk/keluar (aktifkan juga "Server Members Intent" di Developer Portal)
		GatewayIntentBits.GuildVoiceStates, // musik
	],
	// Hemat RAM: bot ini tidak membaca pesan, reaksi, maupun presence.
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		MessageManager: 0,
		ReactionManager: 0,
		PresenceManager: 0,
	}),
});

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Muat semua perintah dari commands/<subfolder>/<file>.js
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
	for (const folder of fs.readdirSync(foldersPath)) {
		const commandsPath = path.join(foldersPath, folder);
		if (!fs.statSync(commandsPath).isDirectory()) continue;

		const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			const command = require(filePath);
			if ('data' in command && 'execute' in command) {
				client.commands.set(command.data.name, command);
			} else {
				console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
			}
		}
	}
} else {
	console.log('[WARNING] Folder "commands" tidak ditemukan.');
}

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		const payload = {
			content: 'There was an error while executing this command!',
			flags: MessageFlags.Ephemeral,
		};
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(payload).catch(() => {});
		} else {
			await interaction.reply(payload).catch(() => {});
		}
	}
});

// Log member masuk/keluar + keluar otomatis dari voice kalau ditinggal sendirian
memberLog.register(client);
client.on(Events.VoiceStateUpdate, music.handleVoiceStateUpdate);

// Jaga bot tetap hidup kalau ada error tak terduga
client.on(Events.Error, (e) => console.error('Client error:', e.message));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));

(async () => {
	try {
		await ensureYtDlp();
	} catch (error) {
		console.error('yt-dlp gagal disiapkan, musik tidak akan berfungsi:', error.message);
	}
	await client.login(DISCORD_TOKEN);
})();
