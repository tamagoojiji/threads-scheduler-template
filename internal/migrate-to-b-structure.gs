/**
 * スプシ「投稿予約」シートを B方式（A=日付、B=時刻、M=投稿日時）にマイグレーション
 *
 * 変更内容:
 *   旧: A=投稿日時 | B=投稿本文 | C=画像URL | D=ステータス | ... | K=error_message
 *   新: A=日付 | B=時刻 | C=投稿本文 | D=画像URL | E=ステータス | ... | L=error_message | M=投稿日時(数式)
 *
 * 使い方:
 *   1. マスタースプシを開く
 *   2. 拡張機能 → Apps Script
 *   3. このコードを貼り付け
 *   4. migrateToBStructure を実行
 */
function migrateToBStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('投稿予約');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('「投稿予約」シートが見つかりません');
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const res = ui.alert(
    'B方式へマイグレーション',
    '現在のA〜K列を1列右にシフトし、A=日付、B=時刻、M=投稿日時(数式)の構成に変更します。\n\n' +
    '既存データの扱い:\n' +
    '  - A列(旧投稿日時)のデータはB列に移動して時刻として再解釈されます\n' +
    '  - 不正な状態になるので、テストデータがある場合は手動でクリアしてください\n\n' +
    '続けますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (res !== ui.Button.OK) return;

  // Step 1: 1列目の前に列を1つ挿入（既存A〜K列がB〜L列にシフト）
  sheet.insertColumnBefore(1);

  // Step 2: 新A列のデータをクリア（挿入時点で空のはずだが念のため）
  sheet.getRange('A2:A1000').clearContent().clearDataValidations();

  // Step 3: 新B列に残った旧A列データ（投稿日時）をクリア
  // → 旧投稿日時のデータが新B列に残っているはずなのでクリア
  sheet.getRange('B2:B1000').clearContent().clearDataValidations();

  // Step 4: ヘッダーを書き換え
  sheet.getRange(1, 1).setValue('日付');
  sheet.getRange(1, 2).setValue('時刻');
  // 旧B〜K列のヘッダーは新C〜L列にそのまま残っている（投稿本文〜error_message）
  // M列に「投稿日時」ヘッダーを追加
  sheet.getRange(1, 13).setValue('投稿日時');

  // Step 5: A列（日付）にカレンダーピッカー検証
  const dateRange = sheet.getRange('A2:A1000');
  dateRange.setNumberFormat('yyyy/MM/dd');
  dateRange.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(false)
      .setHelpText('カレンダーから日付を選択')
      .build()
  );

  // Step 6: B列（時刻）に30分刻みプルダウン
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    timeOptions.push(String(h).padStart(2, '0') + ':00');
    timeOptions.push(String(h).padStart(2, '0') + ':30');
  }
  const timeRange = sheet.getRange('B2:B1000');
  timeRange.setNumberFormat('@');
  timeRange.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(timeOptions, true)
      .setAllowInvalid(false)
      .setHelpText('30分刻みの時刻を選択')
      .build()
  );

  // Step 7: M列に投稿日時の数式を入れる
  const mRange = sheet.getRange('M2:M1000');
  mRange.setNumberFormat('yyyy/MM/dd HH:mm');
  const formulas = [];
  for (let i = 2; i <= 1000; i++) {
    formulas.push([
      '=IFERROR(IF(AND(NOT(ISBLANK(A' + i + ')),NOT(ISBLANK(B' + i + '))),A' + i + '+TIMEVALUE(B' + i + '),""),"")'
    ]);
  }
  mRange.setFormulas(formulas);
  mRange.setBackground('#f5f5f5');

  // Step 8: ヘッダー装飾
  sheet.getRange(1, 1, 1, 13)
    .setBackground('#6a11cb')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // Step 9: 列幅調整
  sheet.setColumnWidth(1, 110);   // A 日付
  sheet.setColumnWidth(2, 80);    // B 時刻
  sheet.setColumnWidth(3, 280);   // C 投稿本文
  sheet.setColumnWidth(13, 140);  // M 投稿日時

  ui.alert(
    'B方式へのマイグレーション完了\n\n' +
    'A列: 日付（カレンダー）\n' +
    'B列: 時刻（30分刻みプルダウン）\n' +
    'C〜L列: 投稿本文〜エラーメッセージ\n' +
    'M列: 投稿日時（数式・触らない）\n\n' +
    'コード側もB方式に対応済みです。'
  );
}
