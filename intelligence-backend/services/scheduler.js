import { pollAllChannels } from './telegram.js';
import { extractChecksFromMessage } from './extractor.js';

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let schedulerHandle = null;

export async function runCycle(botToken, channelIds) {
  if (!botToken || !channelIds?.length) return { skipped: true };

  console.log('[scheduler] Running intelligence cycle...');
  const messages = await pollAllChannels(botToken, channelIds);
  console.log(`[scheduler] Fetched ${messages.length} new messages`);

  let newChecks = 0;
  for (const msg of messages) {
    const inserted = await extractChecksFromMessage(msg.text, null, msg.updateId);
    newChecks += inserted.length;
  }

  console.log(`[scheduler] Extracted ${newChecks} new checks`);
  return { messages: messages.length, newChecks };
}

export function startScheduler(botToken, channelIds) {
  if (schedulerHandle) return;
  // Run immediately on start
  runCycle(botToken, channelIds).catch(console.error);
  schedulerHandle = setInterval(() => {
    runCycle(botToken, channelIds).catch(console.error);
  }, POLL_INTERVAL_MS);
}

export function stopScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
