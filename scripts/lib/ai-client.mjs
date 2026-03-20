import fs from 'node:fs';

function readEnv(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

function extractText(raw) {
  if (typeof raw !== 'string') return '';
  const fenced = raw.match(/```(?:json|markdown|md)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  return raw.trim();
}

function formatMessages(messages) {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function generateWithAI({
  systemPrompt,
  userPrompt,
  expect = 'text',
  temperature = 0.1,
}) {
  const apiKey = readEnv('OPENAI_API_KEY');
  const baseUrl = readEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  const model = readEnv('OPENAI_MODEL', 'gpt-5.3-codex');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Set it in your environment before running this script.');
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const payload = {
    model,
    temperature,
    messages: formatMessages([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]),
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`AI request failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const content = data?.choices?.[0]?.message?.content || '';
  const cleaned = extractText(content);

  if (expect === 'json') {
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      const fallback = cleaned
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      return JSON.parse(fallback);
    }
  }

  return cleaned;
}

export function loadPrompt(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}
