# MinyanBot

A WhatsApp bot that answers natural-language questions about synagogue prayer times.

> "What time is mincha tonight?"  
> "When is shacharit tomorrow?"  
> "What time is havdala this Shabbat?"

Built with [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp) and [Claude](https://anthropic.com) (natural language).

---

## Setup

### 1. Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A WhatsApp account to run the bot on

### 2. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/minyanbot.git
cd minyanbot
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Edit the schedule

Open [`SCHEDULE.md`](./SCHEDULE.md) and update the YAML frontmatter at the top of the file with your synagogue's details:

- **`location.zip`** — your zip code (used for sunset times)
- **`location.timezone`** — your timezone (e.g. `America/New_York`)
- **`shacharit`** — weekday times by day, legal holiday time, Shabbat minyanim
- **`mincha`** — weekday heuristic, Friday rules, Shabbat rule
- **`maariv`** — Motzei Shabbat offset
- **`havdala`** — offset after sunset
- **`candle_lighting`** — minutes before sunset (community custom)

The markdown body below the YAML explains each field in plain English.

### 4. Install and run

```bash
npm install
npm start
```

Scan the QR code with WhatsApp when prompted. The bot will reconnect automatically if the connection drops.

---

## How it works

1. An incoming WhatsApp message is passed to Claude Haiku, which extracts the **service** (shacharit / mincha / maariv / havdala) and **date** from the natural language query.
2. Sunset and candle-lighting times are fetched from the [HebCal API](https://www.hebcal.com/) and cached per day.
3. Times are computed from the rules in `SCHEDULE.md` and sent back as a formatted reply.

---

## Files

| File | Purpose |
|------|---------|
| `SCHEDULE.md` | **Edit this** — all schedule rules live here |
| `config.js` | Parses `SCHEDULE.md` |
| `zmanim.js` | Fetches sunset/candle-lighting from HebCal |
| `times.js` | Computes service times from schedule rules |
| `nlp.js` | Extracts service + date from natural language |
| `bot.js` | WhatsApp bot (Baileys) |

---

## Legal holidays observed

New Year's Day · MLK Day · Presidents' Day · Memorial Day · Independence Day · Labor Day · Thanksgiving · Christmas Day

To change this list, edit the `isLegalHoliday` function in `times.js`.

---

## License

MIT
