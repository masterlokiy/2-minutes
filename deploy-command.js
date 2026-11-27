const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;

// Pastikan semua variabel di .env sudah terbaca
const missing = Object.entries({ CLIENT_ID, GUILD_ID, DISCORD_TOKEN })
	.filter(([, value]) => !value)
	.map(([name]) => name);
if (missing.length) {
	console.error(`Variabel berikut belum ada di .env: ${missing.join(', ')}`);
	console.error('Jalankan dengan: npm run deploy');
	process.exit(1);
}

const commands = [];

// Ambil semua folder perintah di dalam folder "commands"
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	if (!fs.statSync(commandsPath).isDirectory()) continue;

	// Ambil semua file .js di tiap folder
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

	// Ambil hasil SlashCommandBuilder#toJSON() dari tiap perintah untuk didaftarkan
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Siapkan REST dengan token
const rest = new REST().setToken(DISCORD_TOKEN);

// Daftarkan perintah ke server
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// put() mengganti seluruh daftar perintah di server dengan yang sekarang
		const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();