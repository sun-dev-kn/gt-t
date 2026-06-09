import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXTRACT_MODEL = 'claude-haiku-4-5-20251001';
const ENRICH_MODEL = 'claude-sonnet-4-6';

/**
 * Call Claude with a prompt and return the text response.
 * Falls back to OpenAI if OPENAI_API_KEY is set and Anthropic fails.
 */
export async function callAI(prompt, useEnrichModel = false) {
  const model = useEnrichModel ? ENRICH_MODEL : EXTRACT_MODEL;
  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0].text;
  } catch (err) {
    // Fallback to OpenAI if available
    if (process.env.OPENAI_API_KEY) {
      return callOpenAI(prompt);
    }
    throw err;
  }
}

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}
