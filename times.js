import { getSunset, getCandleLighting } from './zmanim.js';
import config from './config.js';

const TZ = config.location.timezone;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
}

function addMinutes(date, min) {
  return new Date(date.getTime() + min * 60 * 1000);
}

function subtractMinutes(date, min) {
  return new Date(date.getTime() - min * 60 * 1000);
}

function roundUpTo(date, intervalMinutes) {
  const ms = date.getTime();
  const interval = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(ms / interval) * interval);
}

// Day-of-week in the configured timezone (0 = Sun … 6 = Sat)
function dowET(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: TZ })).getDay();
}

// Return the Sunday of the same week as `date` (midnight UTC of that Sunday)
function sundayOfWeek(date) {
  const localStr = date.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const d = new Date(localStr); // midnight UTC
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

// Return the Friday of the same week as `date`
function fridayOfWeek(date) {
  const d = sundayOfWeek(date);
  d.setUTCDate(d.getUTCDate() + 5);
  return d;
}

// Parse a config time string like "7:00 PM" into { hours, minutes } (24h)
function parseHM(timeStr) {
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return { hours: h, minutes: min };
}

// Compare a Date's wall-clock time in TZ against {hours, minutes}
function isAfterWallTime(date, hours, minutes) {
  const s = date.toLocaleTimeString('en-US', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit',
  });
  const [h, m] = s.split(':').map(Number);
  return h > hours || (h === hours && m > minutes);
}

// Build a Date that represents wallHours:wallMinutes on the same calendar day
// as `reference`, in the configured timezone.
function wallTimeOnDate(reference, hours, minutes) {
  // Format reference as YYYY-MM-DD in TZ, then construct an ISO string
  // and adjust for the TZ offset by finding the UTC offset at that moment.
  const dateStr = reference.toLocaleDateString('en-CA', { timeZone: TZ });
  // Iterate over candidate UTC times to find one whose local time matches
  const candidate = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  // `candidate` was parsed as LOCAL (system) time. Since we force
  // TZ=America/New_York in the start script, this equals ET. ✓
  return candidate;
}

// ── US Federal holidays the shul observes ────────────────────────────────────

function isLegalHoliday(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dow = date.getDay();

  if (m === 1  && d === 1)              return true; // New Year's Day
  if (m === 7  && d === 4)              return true; // Independence Day
  if (m === 12 && d === 25)             return true; // Christmas

  if (m === 1  && dow === 1 && d >= 15 && d <= 21) return true; // MLK Day
  if (m === 2  && dow === 1 && d >= 15 && d <= 21) return true; // Presidents' Day
  if (m === 5  && dow === 1 && d >= 25)            return true; // Memorial Day
  if (m === 9  && dow === 1 && d <= 7)             return true; // Labor Day
  if (m === 11 && dow === 4 && d >= 22 && d <= 28) return true; // Thanksgiving

  return false;
}

// ── Shacharit ────────────────────────────────────────────────────────────────

const DOW_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function getShacharit(date) {
  const dow = dowET(date);

  if (dow === 6) {
    return config.shacharit.shabbat.map(m => `${m.time} — ${m.name}`);
  }

  if (isLegalHoliday(date)) {
    return [config.shacharit.legal_holiday];
  }

  return [config.shacharit.weekday[DOW_KEYS[dow]]];
}

// ── Mincha ───────────────────────────────────────────────────────────────────

export async function getMincha(date) {
  const dow = dowET(date);
  const cfg = config.mincha;

  if (dow === 6) {
    const friday = fridayOfWeek(date);
    const cl = await getCandleLighting(friday);
    return { times: [formatTime(cl)], note: null };
  }

  if (dow === 5) {
    const cl = await getCandleLighting(date);
    const candidate = addMinutes(cl, cfg.friday.after_candle_lighting_minutes);
    let minchaTime = candidate;

    if (cfg.friday.latest_time) {
      const cap = parseHM(cfg.friday.latest_time);
      if (isAfterWallTime(candidate, cap.hours, cap.minutes)) {
        minchaTime = wallTimeOnDate(date, cap.hours, cap.minutes);
      }
    }

    return { times: [formatTime(minchaTime)], note: cfg.friday.note || null };
  }

  // Sun–Thu: use Sunday's sunset for the whole week
  const sunday = sundayOfWeek(date);
  const sunset = await getSunset(sunday);
  const raw = subtractMinutes(sunset, cfg.weekday.subtract_minutes);
  const mincha = roundUpTo(raw, cfg.weekday.round_up_minutes);
  return { times: [formatTime(mincha)], note: 'followed by Maariv' };
}

// ── Maariv ───────────────────────────────────────────────────────────────────

export async function getMaariv(date) {
  const dow = dowET(date);
  const cfg = config.maariv;

  if (dow === 6) {
    const sunset = await getSunset(date);
    return { times: [formatTime(addMinutes(sunset, cfg.shabbat_minutes_after_sunset))], note: null };
  }

  if (dow === 5) {
    const mincha = await getMincha(date);
    return { times: mincha.times, note: 'after Kabbalat Shabbat' };
  }

  const mincha = await getMincha(date);
  return { times: mincha.times, note: 'follows Mincha' };
}

// ── Havdala ──────────────────────────────────────────────────────────────────

export async function getHavdala(date) {
  if (dowET(date) !== 6) return null;
  const sunset = await getSunset(date);
  return { times: [formatTime(addMinutes(sunset, config.havdala.minutes_after_sunset))], note: null };
}
