import 'dotenv/config';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { parseQuestion } from './nlp.js';
import { getShacharit, getMincha, getMaariv, getHavdala } from './times.js';

const TZ = 'America/New_York';

function todayET() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: TZ,
  });
}

function dateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).replace('Saturday', 'Shabbat');
}

function localDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // noon local — avoids DST edge cases
}

async function buildReply(service, dateStr) {
  const date = localDate(dateStr);
  const label = dateLabel(dateStr);
  const lines = [`*${label}*`];

  const add = (name, times, note) => {
    if (Array.isArray(times) && times.length > 1) {
      lines.push(`${name}:`);
      times.forEach(t => lines.push(`  • ${t}`));
      if (note) lines.push(`  _(${note})_`);
    } else {
      const timeStr = Array.isArray(times) ? times[0] : times;
      lines.push(`${name}: ${timeStr}${note ? ` _(${note})_` : ''}`);
    }
  };

  if (service === 'shacharit' || service === 'all') {
    add('Shacharit', getShacharit(date));
  }
  if (service === 'mincha' || service === 'all') {
    const r = await getMincha(date);
    add('Mincha', r.times, r.note);
  }
  if (service === 'maariv' || service === 'all') {
    const r = await getMaariv(date);
    add("Ma'ariv", r.times, r.note);
  }
  if (service === 'havdala') {
    const r = await getHavdala(date);
    if (r) {
      add('Havdala', r.times);
    } else {
      lines.push('Havdala is only on Motzei Shabbat (Saturday night).');
    }
  }

  return lines.join('\n');
}

async function handleMessage(text) {
  const now = todayET();
  const parsed = await parseQuestion(text, now);
  if (!parsed.service || !parsed.date) return null;

  try {
    return await buildReply(parsed.service, parsed.date);
  } catch (err) {
    console.error('Error building reply:', err);
    return 'Sorry, I had trouble looking up the times. Please try again.';
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nScan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnect:', shouldReconnect, '| Code:', code);
      if (shouldReconnect) connectToWhatsApp();
    }

    if (connection === 'open') {
      console.log('WhatsApp connected!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text.trim()) continue;

      console.log(`[${msg.key.remoteJid}] ${text}`);

      const reply = await handleMessage(text);
      if (reply) {
        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
      }
    }
  });
}

connectToWhatsApp();
