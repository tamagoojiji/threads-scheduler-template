function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 3シート作成
  const sheetNames = ['投稿予約', '投稿履歴', '設定'];
  for (const name of sheetNames) {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  }

  // 既定のシート1を削除
  const defaultSheet = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }

  // 投稿予約シート
  const reservation = ss.getSheetByName('投稿予約');
  reservation.getRange('A1:K1').setValues([[
    '投稿日時', '投稿本文', '画像URL', 'ステータス', 'operation_id',
    'attempt_count', 'state_updated_at', 'creation_id', 'posted_at',
    'threads_post_id', 'error_message'
  ]]);
  reservation.getRange('A1:K1').setFontWeight('bold').setBackground('#e0e0e0');
  reservation.setFrozenRows(1);
  reservation.setColumnWidth(1, 160);
  reservation.setColumnWidth(2, 400);
  reservation.setColumnWidth(3, 200);
  reservation.setColumnWidth(4, 100);

  // データ検証: A列を今日以降の日付のみ
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validation = SpreadsheetApp.newDataValidation()
    .requireDateAfter(new Date(today.getTime() - 86400000))
    .setAllowInvalid(false)
    .setHelpText('今日以降の日時を入力してください')
    .build();
  reservation.getRange('A2:A1000').setDataValidation(validation);

  // 条件付き書式(ステータス列D)
  const statusRange = reservation.getRange('D2:D1000');
  const existing = reservation.getConditionalFormatRules();
  const newRules = existing.concat([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('処理中').setBackground('#fff4c4')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('投稿済').setBackground('#ccefcc')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('エラー').setBackground('#ffcccc')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('スキップ').setBackground('#e0e0e0')
      .setRanges([statusRange]).build()
  ]);
  reservation.setConditionalFormatRules(newRules);

  // 投稿履歴シート
  const history = ss.getSheetByName('投稿履歴');
  history.getRange('A1:G1').setValues([[
    'ログ時刻', 'operation_id', 'creation_id', '本文抜粋', '結果', 'post_id', 'エラー内容'
  ]]);
  history.getRange('A1:G1').setFontWeight('bold').setBackground('#e0e0e0');
  history.setFrozenRows(1);

  // 設定シート
  const settings = ss.getSheetByName('設定');
  settings.getRange('A1:B3').setValues([
    ['項目', '値'],
    ['画像機能', 'OFF'],
    ['タイムゾーン', 'Asia/Tokyo']
  ]);
  settings.getRange('A1:B1').setFontWeight('bold').setBackground('#e0e0e0');
  settings.setFrozenRows(1);
  settings.setColumnWidth(1, 150);
  settings.setColumnWidth(2, 150);

  SpreadsheetApp.getUi().alert('✅ セットアップ完了');
}
