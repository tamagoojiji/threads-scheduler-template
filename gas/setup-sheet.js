// ==========
// 「設定」シートからPropertiesServiceへの転記
// ==========

const SETTINGS_SHEET = 'APIキー設定';

/**
 * 「設定」シートを初期化（新規作成 or リセット）
 */
function setupSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (sheet) {
    const ui = SpreadsheetApp.getUi();
    const res = ui.alert(
      '「設定」シートを初期化',
      '既存の「設定」シートをリセットします。\n保存済の値は失われませんが（PropertiesService内に保持）、シート上の値・状態表示はクリアされます。\n\n続けますか？',
      ui.ButtonSet.OK_CANCEL
    );
    if (res !== ui.Button.OK) return;
    sheet.clear();
  } else {
    sheet = ss.insertSheet(SETTINGS_SHEET);
  }

  // ヘッダー
  sheet.getRange('A1:C1').setValues([['項目', '値（ここにコピペ）', '状態']]);
  sheet.getRange('A1:C1')
    .setBackground('#6a11cb')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // 項目行（説明付き）
  const rows = [
    ['THREADS_APP_ID', '', '数字（例: 1644523863261410）'],
    ['THREADS_APP_SECRET', '', 'Meta Developer > 設定 > ベーシック > 「表示」'],
    ['THREADS_ACCESS_TOKEN', '', 'THAA で始まる長期トークン（200〜300文字）'],
    ['THREADS_USER_ID', '', '17桁前後の数字（35107700... 形式）'],
    ['DISCORD_WEBHOOK_URL', '', 'https://discord.com/api/webhooks/... で始まるURL'],
  ];
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);

  // A列（項目名）をスタイル
  sheet.getRange(2, 1, rows.length, 1)
    .setBackground('#f3f3f7')
    .setFontWeight('bold');
  // B列（値入力欄）を黄色背景
  sheet.getRange(2, 2, rows.length, 1).setBackground('#fff7e0');

  // 列幅
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 380);
  sheet.setColumnWidth(3, 320);

  // 説明セクション
  const noteRow = rows.length + 4;
  sheet.getRange(noteRow, 1).setValue('使い方:');
  sheet.getRange(noteRow + 1, 1).setValue('1. B列「値」に取得した値をコピペ');
  sheet.getRange(noteRow + 2, 1).setValue('2. メニュー「スレッズスケジューラー → 💾 設定シートからPropertiesに保存」を実行');
  sheet.getRange(noteRow + 3, 1).setValue('3. 保存後、B列の値は自動的に削除されます（PropertiesService内に暗号化保管）');
  sheet.getRange(noteRow + 4, 1).setValue('注意: スプシを他人と共有する際は、念のためこのシートを非表示推奨');
  sheet.getRange(noteRow, 1, 5, 1).setFontStyle('italic').setFontColor('#666');

  SpreadsheetApp.getUi().alert(
    '「設定」シートを準備しました\n\n' +
    'B列に値をコピペしたあと、メニュー「💾 設定シートからPropertiesに保存」を実行してください。'
  );
}

/**
 * 「設定」シートのB列をPropertiesServiceに転記
 * 転記済の値はB列をマスク表示に置換、C列に状態を記録
 */
function saveSettingsFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('「設定」シートがありません。まず「⚙️ 設定シートを準備」を実行してください。');
    return;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('「設定」シートに項目がありません');
    return;
  }
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  let saved = 0;
  let skipped = 0;
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');

  for (let i = 0; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    const rawValue = String(values[i][1] || '').trim();
    if (!key) continue;
    if (REQUIRED_KEYS.indexOf(key) < 0) continue;
    if (!rawValue) {
      skipped++;
      continue;
    }
    // 既に「✅」で始まるマスク済の値はスキップ
    if (rawValue.indexOf('✅') === 0 || rawValue.indexOf('...') > 0 && rawValue.length < 20) {
      skipped++;
      continue;
    }

    PROPS.setProperty(key, rawValue);
    // セキュリティ強化: 保存後は値を完全削除（マスクすら残さない）
    sheet.getRange(i + 2, 2).clearContent();
    sheet.getRange(i + 2, 3).setValue('✅ 保存済 ' + now);
    saved++;
  }

  // 保存状況の確認
  const status = REQUIRED_KEYS.map(k => {
    const v = PROPS.getProperty(k);
    return k + ': ' + (v ? '✅' : '❌');
  }).join('\n');

  SpreadsheetApp.getUi().alert(
    '保存しました\n\n' +
    '新規保存: ' + saved + '件\n' +
    'スキップ: ' + skipped + '件（空欄 or マスク済）\n\n' +
    '【現在の設定状況】\n' + status
  );
}
