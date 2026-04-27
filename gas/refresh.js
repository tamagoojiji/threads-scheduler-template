// ==========
// Threads長期トークン自動更新
// 週次トリガーから呼ばれる
// ==========

function refreshTokenJob() {
  try {
    // 必須Propertiesの検証（fail-fast）
    assertConfigured();
    const result = refreshAccessToken();
    const days = Math.floor((result.expires_in || 0) / 86400);
    notifyDiscord('✅ Threadsトークンを自動更新しました（次回 +' + days + '日有効）', { kind: 'refresh_success' });
    console.log('トークン更新成功: ' + days + '日');
  } catch (e) {
    const msg = e.message || String(e);
    try {
      notifyDiscord('⚠️ Threadsトークン自動更新失敗: ' + msg, { kind: 'refresh_failure' });
    } catch (_) {}
    console.error('トークン更新失敗:', msg);
    throw e;
  }
}

/**
 * トークン取り直し（手動）
 * 万が一更新失敗が続いた場合に手動で実行
 */
function refreshTokenManual() {
  refreshTokenJob();
  SpreadsheetApp.getUi().alert('トークン更新を手動実行しました。Discord通知をご確認ください。');
}
