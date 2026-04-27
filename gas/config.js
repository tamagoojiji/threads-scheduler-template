// ==========
// 設定（PropertiesService 経由）
// ==========

const PROPS = PropertiesService.getScriptProperties();

const REQUIRED_KEYS = [
  'THREADS_APP_ID',
  'THREADS_APP_SECRET',
  'THREADS_ACCESS_TOKEN',
  'THREADS_USER_ID',
  'DISCORD_WEBHOOK_URL',
];

function getConfig() {
  const config = {};
  REQUIRED_KEYS.forEach(key => {
    config[key.toLowerCase().replace(/_(\w)/g, (_, c) => c.toUpperCase())] = PROPS.getProperty(key) || '';
  });
  // alias
  config.threadsAppId = PROPS.getProperty('THREADS_APP_ID') || '';
  config.threadsAppSecret = PROPS.getProperty('THREADS_APP_SECRET') || '';
  config.threadsAccessToken = PROPS.getProperty('THREADS_ACCESS_TOKEN') || '';
  config.threadsUserId = PROPS.getProperty('THREADS_USER_ID') || '';
  config.discordWebhookUrl = PROPS.getProperty('DISCORD_WEBHOOK_URL') || '';
  return config;
}

/**
 * 初回セットアップ: Secrets を1つずつ入力
 * メニューから実行
 */
function setupProperties() {
  const ui = SpreadsheetApp.getUi();
  REQUIRED_KEYS.forEach(key => {
    const current = PROPS.getProperty(key);
    const masked = current ? current.slice(0, 4) + '...' + current.slice(-4) : '(未設定)';
    const res = ui.prompt(
      key + ' を設定',
      '現在の値: ' + masked + '\n\n新しい値を入力（変更しない場合は空欄でOK）:',
      ui.ButtonSet.OK_CANCEL
    );
    if (res.getSelectedButton() !== ui.Button.OK) return;
    const v = res.getResponseText().trim();
    if (v) PROPS.setProperty(key, v);
  });

  // 確認
  const status = REQUIRED_KEYS.map(k => {
    const v = PROPS.getProperty(k);
    return k + ': ' + (v ? '✅ 設定済' : '❌ 未設定');
  }).join('\n');
  ui.alert('セットアップ完了\n\n' + status);
}

/**
 * 必須項目が揃っているか検証。揃っていなければ throw
 */
function assertConfigured() {
  const missing = REQUIRED_KEYS.filter(k => !PROPS.getProperty(k));
  if (missing.length > 0) {
    throw new Error(
      'Properties未設定: ' + missing.join(', ') +
      '\n「スレッズスケジューラー → 🔧 初回セットアップ」を実行してください。'
    );
  }
}

/**
 * 設定状況の確認
 */
function checkProperties() {
  const status = REQUIRED_KEYS.map(k => {
    const v = PROPS.getProperty(k);
    if (!v) return k + ': ❌ 未設定';
    return k + ': ✅ ' + v.slice(0, 4) + '...' + v.slice(-4);
  }).join('\n');
  SpreadsheetApp.getUi().alert('設定状況\n\n' + status);
}
