// ==========
// Discord Webhook 通知
// ==========

function notifyDiscord(message) {
  const config = getConfig();
  if (!config.discordWebhookUrl) {
    console.log('Discord Webhook 未設定');
    return;
  }
  try {
    UrlFetchApp.fetch(config.discordWebhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ content: message }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    console.error('Discord通知エラー:', e);
  }
}
