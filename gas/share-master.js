// ==========
// マスタースプシを「リンクを知っている全員が閲覧可」に設定（/copy 用）
// tamagoが1回だけ実行する。実行後、誰でもsetup-guideのコピーボタンが動く
// ==========

function makeMasterSheetPublic() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(ss.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const message = 'マスタースプシを「リンクを知っている全員が閲覧可」に設定しました\n\n' +
    'これで誰でも以下のURLからコピーできます:\n' +
    'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/copy';
  console.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (_) {
    // Apps Scriptエディタからの直接実行時は無視
  }
}
