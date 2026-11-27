'use strict';

const {
	joinVoiceChannel, createAudioPlayer, createAudioResource, demuxProbe,
	AudioPlayerStatus, VoiceConnectionStatus, entersState, NoSubscriberBehavior,
} = require('@discordjs/voice');
const { resolveTrack, openStream } = require('./ytdlp');

const MAX_QUEUE = 50;
const IDLE_LEAVE_MS = 120_000; // keluar voice 2 menit setelah antrean habis
const EMPTY_LEAVE_MS = 60_000; // keluar voice 1 menit setelah channel kosong

const queues = new Map();

function formatDuration(sec) {
	if (!sec) return 'live';
	const m = Math.floor(sec / 60);
	return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

const getQueue = (guildId) => queues.get(guildId);

function destroyQueue(guildId) {
	const q = queues.get(guildId);
	if (!q) return;
	q.destroyed = true;
	clearTimeout(q.idleTimer);
	clearTimeout(q.emptyTimer);
	q.tracks.length = 0;
	q.player.removeAllListeners();
	q.player.on('error', () => {});
	q.player.stop(true);
	if (q.connection.state.status !== VoiceConnectionStatus.Destroyed) q.connection.destroy();
	queues.delete(guildId);
}

async function playNext(q) {
	if (q.destroyed) return;
	const track = q.tracks.shift();
	if (!track) {
		q.current = null;
		clearTimeout(q.idleTimer);
		q.idleTimer = setTimeout(() => destroyQueue(q.guildId), IDLE_LEAVE_MS);
		return;
	}
	clearTimeout(q.idleTimer);
	q.current = track;
	try {
		let stream;
		try {
			stream = await openStream(track);
		} catch {
			Object.assign(track, await resolveTrack(track.webpage_url)); // URL kedaluwarsa, ambil ulang
			stream = await openStream(track);
		}
		// Format Opus diteruskan langsung ke Discord tanpa FFmpeg (hemat CPU).
		const probe = await demuxProbe(stream);
		q.player.play(createAudioResource(probe.stream, { inputType: probe.type }));
		if (!track.quiet) {
			q.textChannel?.send(`🎶 Memutar: **${track.title}** (${formatDuration(track.duration)})`).catch(() => {});
		}
	} catch (err) {
		console.error('Gagal memutar:', err.message);
		q.textChannel?.send(`⚠️ Gagal memutar **${track.title}**: ${err.message}`).catch(() => {});
		return playNext(q);
	}
}

async function createQueue(interaction, voiceChannel) {
	const guildId = voiceChannel.guild.id;
	const existing = queues.get(guildId);
	if (existing) return existing;

	const connection = joinVoiceChannel({
		channelId: voiceChannel.id,
		guildId,
		adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		selfDeaf: true,
	});
	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
	} catch {
		connection.destroy();
		throw new Error('Gagal terhubung ke voice channel.');
	}

	const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
	connection.subscribe(player);

	const q = {
		guildId, channelId: voiceChannel.id, connection, player,
		tracks: [], current: null, textChannel: interaction.channel,
		idleTimer: null, emptyTimer: null, destroyed: false,
	};
	player.on(AudioPlayerStatus.Idle, () => playNext(q)); // lagu selesai atau di-skip
	player.on('error', (e) => console.error('Player error:', e.message));
	connection.on(VoiceConnectionStatus.Disconnected, async () => {
		try {
			await Promise.race([
				entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
				entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
			]);
		} catch {
			destroyQueue(guildId);
		}
	});
	queues.set(guildId, q);
	return q;
}

async function enqueue(interaction, voiceChannel, track) {
	const q = await createQueue(interaction, voiceChannel);
	const startedNow = !q.current;
	track.quiet = startedNow; // balasan /play sudah memberi tahu judulnya
	q.tracks.push(track);
	if (startedNow) playNext(q);
	return { startedNow, position: q.tracks.length };
}

function skip(q) {
	q.player.stop(); // memicu Idle -> lagu berikutnya
}

// Keluar otomatis kalau voice channel tinggal bot sendiri.
function handleVoiceStateUpdate(oldState, newState) {
	const guild = newState.guild ?? oldState.guild;
	const q = queues.get(guild.id);
	if (!q) return;
	const channel = guild.channels.cache.get(q.channelId);
	if (!channel) return;
	const humans = channel.members.filter((m) => !m.user.bot).size;
	clearTimeout(q.emptyTimer);
	if (humans === 0) q.emptyTimer = setTimeout(() => destroyQueue(q.guildId), EMPTY_LEAVE_MS);
}

module.exports = {
	MAX_QUEUE, formatDuration, getQueue, destroyQueue, enqueue, skip, handleVoiceStateUpdate,
};
