import 'dotenv/config';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { parseQuestion, parseOverrideCommand } from './nlp.js';
import { getShacharit, getMincha, getMaariv, getHavdala } from './times.js';
import { getOverride, setOverride, clearOverride, listOverrides } from './overrides.js';

const TZ = 'America/New_York';

// Admin JID: digits only in .env, e.g. ADMIN_NUMBER=12125551234
const ADMIN_USER = process.env.ADMIN_NUMBER?.split('@')[0] ?? null;

function senderJid(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function isAdmin(msg) {
  return ADMIN_USER && senderJid(msg).split('@')[0] === ADMIN_USER;
}

function todayET() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: TZ,
  });
}

function dateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .replace('Saturday', 'Shabbat');
}

function localDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// ── Reply builder ─────────────────────────────────────────────────────────────

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

  const resolve = async (svc, computeFn, displayName) => {
    const override = getOverride(dateStr, svc);
    if (override) {
      add(displayName, override.times, override.note ? `${override.note} ⚠️ custom time` : '⚠️ custom time');
    } else {
      const r = await computeFn();
      if (r && r.times) add(displayName, r.times, r.note);
      else if (Array.isArray(r)) add(displayName, r);
      else if (r) add(displayName, r);
    }
  };

  if (service === 'shacharit' || service === 'all') {
    await resolve('shacharit', () => ({ times: getShacharit(date) }), 'Shacharit');
  }
  if (service === 'mincha' || service === 'all') {
    await resolve('mincha', () => getMincha(date), 'Mincha');
  }
  if (service === 'maariv' || service === 'all') {
    await resolve('maariv', () => getMaariv(date), "Ma'ariv");
  }
  if (service === 'havdala' || service === 'all') {
    const override = getOverride(dateStr, 'havdala');
    if (override) {
      add('Havdala', override.times, override.note ? `${override.note} ⚠️ custom time` : '⚠️ custom time');
    } else {
      const r = await getHavdala(date);
      if (r) add('Havdala', r.times);
      else if (service === 'havdala') lines.push('Havdala is only on Motzei Shabbat (Saturday night).');
    }
  }

  return lines.join('\n');
}

// ── Admin override handler ────────────────────────────────────────────────────

async function handleAdminMessage(text, now) {
  const cmd = await parseOverrideCommand(text, now);

  if (!cmd || !cmd.action) return null; // not an override command — fall through to normal query

  if (cmd.action === 'list') {
    const all = listOverrides();
    const entries = Object.entries(all);
    if (entries.length === 0) return 'No custom overrides are currently set.';
    const lines = ['*Current overrides:*'];
    for (const [date, services] of entries) {
      for (const [svc, val] of Object.entries(services)) {
        const t = val.times.join(', ');
        lines.push(`• ${dateLabel(date)} — ${svc}: ${t}${val.note ? ` (${val.note})` : ''}`);
      }
    }
    return lines.join('\n');
  }

  if (cmd.action === 'set') {
    if (!cmd.service || !cmd.date || !cmd.time) {
      return "I didn't catch all the details. Try: _set mincha on 4/21 to 7:15 PM_";
    }
    setOverride(cmd.date, cmd.service, cmd.time, cmd.note);
    const label = dateLabel(cmd.date);
    return `✅ Override saved: ${cmd.service} on ${label} → ${cmd.time}${cmd.note ? ` (${cmd.note})` : ''}`;
  }

  if (cmd.action === 'clear') {
    if (!cmd.service || !cmd.date) {
      return "Please specify a service and date. Try: _clear mincha on 4/21_";
    }
    const removed = clearOverride(cmd.date, cmd.service);
    const label = dateLabel(cmd.date);
    return removed
      ? `✅ Override cleared: ${cmd.service} on ${label} will use the regular schedule.`
      : `No override found for ${cmd.service} on ${label}.`;
  }

  return null;
}

// ── Main message handler ──────────────────────────────────────────────────────

async function handleMessage(text, msg) {
  const now = todayET();

  // Admin-only: check for override commands first
  if (isAdmin(msg)) {
    const adminReply = await handleAdminMessage(text, now);
    if (adminReply) return adminReply;
  }

  // Everyone: answer time queries
  const parsed = await parseQuestion(text, now);
  if (!parsed.service || !parsed.date) return null;

  try {
    return await buildReply(parsed.service, parsed.date);
  } catch (err) {
    console.error('Error building reply:', err);
    return 'Sorry, I had trouble looking up the times. Please try again.';
  }
}

// ── WhatsApp connection ───────────────────────────────────────────────────────

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    console.log('Could not fetch latest Baileys version, using bundled default.');
  }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
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

  const seen = new Set();

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      if (seen.has(msg.key.id)) continue;
      seen.add(msg.key.id);
      if (seen.size > 500) seen.delete(seen.values().next().value);

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text.trim()) continue;

      console.log(`[${msg.key.remoteJid}] ${text}`);

      const reply = await handleMessage(text, msg);
      if (reply) {
        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
      }
    }
  });
}

connectToWhatsApp();
