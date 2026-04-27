// ==========
// 時間トリガーのインストール・アンインストール
// ==========

const TRIGGER_HANDLERS = ['postRunner', 'refreshTokenJob'];

/**
 * 投稿用（10分ごと）+ トークン更新（毎週日曜9時）のトリガーをインストール
 */
function installTriggers() {
  // 必須設定が揃っているか検証（未設定のままトリガー登録を防ぐ）
  try {
    assertConfigured();
  } catch (e) {
    SpreadsheetApp.getUi().alert('インストールできません\n\n' + e.message);
    return;
  }

  // 既存トリガーを削除
  removeOurTriggers_();

  // 投稿用: 10分ごと
  ScriptApp.newTrigger('postRunner')
    .timeBased()
    .everyMinutes(10)
    .create();

  // トークン更新: 毎週日曜 9時
  ScriptApp.newTrigger('refreshTokenJob')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(9)
    .create();

  SpreadsheetApp.getUi().alert(
    'トリガーをインストールしました\n\n' +
    '・postRunner: 10分ごと（投稿チェック）\n' +
    '・refreshTokenJob: 毎週日曜 9時（トークン更新）'
  );
}

/**
 * 全トリガー削除
 */
function uninstallTriggers() {
  const count = removeOurTriggers_();
  SpreadsheetApp.getUi().alert(count + '個のトリガーを削除しました');
}

/**
 * 現在のトリガー状況を表示
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const lines = triggers.map(t => {
    return '・' + t.getHandlerFunction() + ' (id=' + t.getUniqueId() + ')';
  });
  SpreadsheetApp.getUi().alert(
    '現在のトリガー: ' + triggers.length + '件\n\n' +
    (lines.join('\n') || '(なし)')
  );
}

function removeOurTriggers_() {
  let count = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (TRIGGER_HANDLERS.indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
      count++;
    }
  });
  return count;
}
