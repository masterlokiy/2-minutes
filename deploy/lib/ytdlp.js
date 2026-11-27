'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const ROOT = path.join(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'bin');
const IS_WIN = process.platform === 'win32';
const YTDLP = path.join(BIN_DIR, IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');
const COOKIES = path.join(ROOT, 'cookies.txt'); // opsional, taruh di folder utama bot
const FORMAT = 'bestaudio[acodec=opus]/bestaudio'; // Opus = tanpa transcoding = hemat CPU

function assetName() {
	if (process.platform === 'win32') return process.arch === 'arm64' ? 'yt-dlp_arm64.exe' : 'yt-dlp.exe';
	if (process.platform === 'darwin') return 'yt-dlp_macos';
	return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
}

// Unduh binary yt-dlp (standalone, tidak butuh Python) sekali saja.
async function ensureYtDlp() {
	if (!fs.existsSync(YTDLP)) {
		fs.mkdirSync(BIN_DIR, { recursive: true });
		const file = assetName();
		console.log(`Mengunduh ${file} ...`);
		const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${file}`);
		if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
		await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(YTDLP));
		if (!IS_WIN) fs.chmodSync(YTDLP, 0o755);
		console.log('yt-dlp siap.');
	} else {
		// perbarui diam-diam di latar belakang, YouTube sering berubah
		execFile(YTDLP, ['-U'], { timeout: 120000 }, () => {});
	}
}

function baseArgs() {
	const args = ['--no-warnings', '--no-playlist', '--js-runtimes', 'node'];
	if (fs.existsSync(COOKIES)) args.push('--cookies', COOKIES);
	return args;
}

// Ambil info lagu (judul, durasi, URL audio) dari judul pencarian atau link.
function resolveTrack(query) {
	return new Promise((resolve, reject) => {
		const target = /^https?:\/\//i.test(query) ? query : `ytsearch1:${query}`;
		const args = [...baseArgs(), '-j', '-f', FORMAT, target];
		execFile(YTDLP, args, { maxBuffer: 20 * 1024 * 1024, timeout: 60000 }, (err, stdout, stderr) => {
			if (err) {
				const msg = (stderr || err.message).split('\n').filter(Boolean).pop() || 'yt-dlp gagal';
				return reject(new Error(msg.slice(0, 200)));
			}
			try {
				const line = stdout.split('\n').find((l) => l.trim().startsWith('{'));
				const info = JSON.parse(line);
				resolve({
					title: info.title || 'Tanpa judul',
					url: info.url,
					headers: info.http_headers || {},
					webpage_url: info.webpage_url || target,
					duration: info.duration || 0,
				});
			} catch {
				reject(new Error('Lagu tidak ditemukan.'));
			}
		});
	});
}

// Buka aliran audio. Utama: fetch langsung (hemat RAM). Cadangan: yt-dlp pipe.
async function openStream(track) {
	try {
		const res = await fetch(track.url, { headers: track.headers });
		if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
		return Readable.fromWeb(res.body);
	} catch (err) {
		console.warn('Fetch langsung gagal, memakai yt-dlp pipe:', err.message);
		const proc = spawn(YTDLP, [...baseArgs(), '-f', FORMAT, '-o', '-', track.webpage_url], {
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		proc.on('error', console.error);
		proc.stdout.once('close', () => proc.kill('SIGKILL'));
		return proc.stdout;
	}
}

module.exports = { ensureYtDlp, resolveTrack, openStream };
