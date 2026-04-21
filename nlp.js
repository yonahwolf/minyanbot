import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM = `You extract prayer-time queries from WhatsApp messages sent to a synagogue bot.

Return ONLY valid JSON with two fields:
  "service": one of "shacharit" | "mincha" | "maariv" | "havdala" | "all" | null
  "date": ISO date string YYYY-MM-DD, or null if unrelated to prayer times

Rules:
- "tonight" and "this evening" → today's date
- "tomorrow morning" → tomorrow's date
- Bare day names ("sunday", "monday" …) → the next upcoming occurrence of that day
- "shabbat" / "saturday" → the upcoming Saturday
- "this shabbat" → the upcoming Saturday
- If no specific service is mentioned but the question is about times, use "all"
- If the message is not about prayer/minyan times, return {"service": null, "date": null}

Today (Eastern Time): DATE_PLACEHOLDER`;

export async function parseQuestion(text, todayET) {
  const system = SYSTEM.replace('DATE_PLACEHOLDER', todayET);

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    system,
    messages: [{ role: 'user', content: text }],
  });

  try {
    const raw = msg.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(raw);
  } catch {
    return { service: null, date: null };
  }
}
