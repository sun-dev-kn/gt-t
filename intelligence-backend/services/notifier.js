import fetch from 'node-fetch';

export async function notifyFinding({ checkId, siteUrl, severity, enrichment }) {
  const message = formatMessage(checkId, siteUrl, severity, enrichment);
  await Promise.allSettled([
    notifyTelegram(message),
    notifySlack(message),
  ]);
}

function formatMessage(checkId, siteUrl, severity, enrichment) {
  const cve = enrichment?.cve_id ? ` (${enrichment.cve_id})` : '';
  const cvss = enrichment?.cvss_score != null ? ` CVSS ${enrichment.cvss_score}` : '';
  const rem = enrichment?.remediation ? `\n${enrichment.remediation}` : '';
  return `DotGit Alert\n${severity.toUpperCase()} — ${checkId}${cve}${cvss}\nSite: ${siteUrl}${rem}`.slice(0, 4096);
}

async function notifyTelegram(message) {
  const token = process.env.NOTIFY_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.NOTIFY_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error('[notifier] Telegram error:', resp.status, body.slice(0, 200));
    }
  } catch (err) {
    console.error('[notifier] Telegram failed:', err.message);
  }
}

async function notifySlack(message) {
  const webhookUrl = process.env.NOTIFY_SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      console.error('[notifier] Slack error:', resp.status);
    }
  } catch (err) {
    console.error('[notifier] Slack failed:', err.message);
  }
}
