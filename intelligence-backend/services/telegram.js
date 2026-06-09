import fetch from 'node-fetch';
import { getDb } from '../db.js';

const BASE_URL = 'https://api.telegram.org/bot';

let lastUpdateId = 0;

export async function pollChannel(botToken, channelId) {
  const url = `${BASE_URL}${botToken}/getUpdates?offset=${lastUpdateId + 1}&allowed_updates=["channel_post"]&limit=100`;

  let data;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    data = await res.json();
  } catch (err) {
    console.error('[telegram] Poll failed:', err.message);
    return [];
  }

  if (!data.ok || !data.result?.length) return [];

  const db = getDb();
  const messages = [];

  for (const update of data.result) {
    if (update.update_id > lastUpdateId) lastUpdateId = update.update_id;

    const post = update.channel_post;
    if (!post?.text) continue;
    // Filter by channelId if specified (channel_post.chat.username)
    if (channelId && post.chat?.username !== channelId.replace('@', '')) continue;

    try {
      db.prepare(`
        INSERT OR IGNORE INTO telegram_messages
          (channel_id, update_id, message_text, received_at, processed)
        VALUES (?, ?, ?, ?, 0)
      `).run(channelId, update.update_id, post.text, Date.now());
      messages.push({ updateId: update.update_id, text: post.text });
    } catch (err) {
      console.error('[telegram] DB insert error:', err.message);
    }
  }

  return messages;
}

export async function pollAllChannels(botToken, channelIds) {
  const all = [];
  for (const channelId of channelIds) {
    const messages = await pollChannel(botToken, channelId);
    all.push(...messages);
  }
  return all;
}
