import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const QUERY_SYSTEM = `You extract prayer-time queries from WhatsApp messages sent to a synagogue bot.

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

const OVERRIDE_SYSTEM = `You parse admin override commands for a synagogue WhatsApp bot.

Return ONLY valid JSON:
{
  "action": "set" | "clear" | "list" | null,
  "service": "shacharit" | "mincha" | "maariv" | "havdala" | null,
  "date": "YYYY-MM-DD" | null,
  "time": "H:MM AM/PM" | null,
  "note": "short note to append" | null
}

- "set": admin is setting a custom time. Examples: "set mincha on 4/21 to 7:15 PM", "mincha friday is 7pm", "change shacharit tomorrow to 8am"
- "clear": admin is removing an override. Examples: "clear mincha on 4/21", "remove override for tomorrow's shacharit"
- "list": admin wants to see all saved overrides. Examples: "show overrides", "list overrides", "what overrides are set"
- null: not an override command (a regular time query or unrelated message)

Normalize the time to "H:MM AM" or "H:MM PM" format (e.g. "7:15 PM", "8:00 AM").

Today (Eastern Time): DATE_PLACEHOLDER`;

function stripFences(text) {
  return text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
}

async function callClaude(system, text, todayET) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    system: system.replace('DATE_PLACEHOLDER', todayET),
    messages: [{ role: 'user', content: text }],
  });
  try {
    return JSON.parse(stripFences(msg.content[0].text));
  } catch {
    return null;
  }
}

export async function parseQuestion(text, todayET) {
  const result = await callClaude(QUERY_SYSTEM, text, todayET);
  return result ?? { service: null, date: null };
}

export async function parseOverrideCommand(text, todayET) {
  const result = await callClaude(OVERRIDE_SYSTEM, text, todayET);
  return result ?? { action: null };
}
