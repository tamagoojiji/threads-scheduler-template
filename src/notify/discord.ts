export async function notifyDiscord(webhookUrl: string, message: string): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) {
      console.error(`Discord通知失敗: ${res.status}`);
    }
  } catch (err) {
    console.error('Discord通知エラー:', err);
  }
}
