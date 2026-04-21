---
# ──────────────────────────────────────────────────────────────────────────────
# Location
# ──────────────────────────────────────────────────────────────────────────────
location:
  zip: "10605"
  timezone: "America/New_York"

# ──────────────────────────────────────────────────────────────────────────────
# Shacharit
# ──────────────────────────────────────────────────────────────────────────────
shacharit:
  weekday:
    sunday:    "8:00 AM"
    monday:    "6:35 AM"
    tuesday:   "6:45 AM"
    wednesday: "6:45 AM"
    thursday:  "6:35 AM"
    friday:    "6:45 AM"
  legal_holiday: "8:00 AM"
  shabbat:
    - name: "Hashkama"
      time: "7:25 AM"
    - name: "Social Hall"
      time: "8:15 AM"
    - name: "Main"
      time: "9:15 AM"
    - name: "Sephardic"
      time: "10:00 AM"

# ──────────────────────────────────────────────────────────────────────────────
# Mincha
# ──────────────────────────────────────────────────────────────────────────────
mincha:
  weekday:
    # Take Sunday's sunset, subtract this many minutes, then round UP to the
    # nearest `round_up_minutes`. Same time applies Sun–Thu all week.
    subtract_minutes: 10
    round_up_minutes: 5

  friday:
    # Start time = candle lighting + this many minutes
    after_candle_lighting_minutes: 10
    # Never schedule later than this (null = no cap)
    latest_time: "7:00 PM"
    note: "followed by Kabbalat Shabbat & Maariv"

  shabbat:
    # Shabbat Mincha = that week's Friday candle lighting time
    equals_candle_lighting: true

# ──────────────────────────────────────────────────────────────────────────────
# Maariv
# ──────────────────────────────────────────────────────────────────────────────
maariv:
  # Weekday and Friday Maariv follows immediately after Mincha
  weekday_follows_mincha: true
  # Motzei Shabbat: this many minutes after Saturday sunset
  shabbat_minutes_after_sunset: 45

# ──────────────────────────────────────────────────────────────────────────────
# Havdala
# ──────────────────────────────────────────────────────────────────────────────
havdala:
  minutes_after_sunset: 50

# ──────────────────────────────────────────────────────────────────────────────
# Candle Lighting
# ──────────────────────────────────────────────────────────────────────────────
candle_lighting:
  minutes_before_sunset: 18
---

# Synagogue Schedule

This file controls the prayer times for the WhatsApp minyan bot.
Edit the YAML block above and restart the bot — no code changes needed.

## Shacharit

| Day | Time |
|-----|------|
| Sunday | 8:00 AM |
| Monday & Thursday | 6:35 AM |
| Tuesday, Wednesday & Friday | 6:45 AM |
| Legal Holidays | 8:00 AM |

**Legal holidays observed:** New Year's Day, MLK Day, Presidents' Day, Memorial Day,
Independence Day, Labor Day, Thanksgiving, Christmas Day.

**Shabbat Shacharit minyanim:**
- 7:25 AM — Hashkama
- 8:15 AM — Social Hall
- 9:15 AM — Main
- 10:00 AM — Sephardic

## Mincha

**Sunday–Thursday:** Find Sunday's sunset, subtract 10 minutes, round *up* to the nearest
5-minute mark. That time holds for the entire week (Sun–Thu).

> Example: sunset 7:42 PM → 7:42 − 10 = 7:32 → round up → **7:35 PM**

Maariv follows immediately after Mincha.

**Friday:** Candle lighting time + 10 minutes, capped at 7:00 PM.
Followed by Kabbalat Shabbat & Maariv.

**Shabbat:** Shabbat Mincha is davened at the same time as Friday's candle lighting.

## Maariv

- **Weeknights:** Immediately after Mincha
- **Motzei Shabbat:** 45 minutes after Saturday sunset

## Havdala

50 minutes after Saturday sunset.

## Candle Lighting

18 minutes before Friday sunset (standard Ashkenaz custom).
Sunset times are fetched from the [HebCal API](https://www.hebcal.com/) based on your zip code.
