// ==========
// シートを新レイアウト（ツリー対応）に変換するマイグレーション
// 旧レイアウト: A日付 B時刻 C投稿本文 D画像URL E ステータス F op_id ... M投稿日時
// 新レイアウト: A ステータス B日付 C時刻 D画像URL E投稿本文 F〜I ツリー1〜4 J投稿日時 K〜Q システム列(非表示)
// ==========

const NEW_LAYOUT_HEADERS = [
  'ステータス', '日付', '時刻', '画像URL', '投稿本文',
  'ツリー1', 'ツリー2', 'ツリー3', 'ツリー4', '投稿日時',
  'operation_id', 'attempt_count', 'state_updated_at', 'creation_id',
  'posted_at', 'threads_post_id', 'error_message',
];

const NEW_LAYOUT_HIDDEN_FROM_COL = 11; // K列（operation_id）以降を非表示
const NEW_LAYOUT_HIDDEN_COUNT = 7;     // K〜Q（7列）

/**
 * 旧レイアウトのシートを新レイアウト（ツリー対応）に変換する
 * - バックアップシートを自動作成
 * - 既存データは保持して列順を並び替え + ツリー1〜4列追加
 * - K以降を非表示
 */
function migrateSheetToTreeLayout() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    ui.alert('「' + SHEET_NAME + '」シートが見つかりません');
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    ui.alert('シートが空です');
    return;
  }

  // 既に新レイアウトかチェック
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  if (existingHeaders[0] === 'ステータス' && (existingHeaders.indexOf('ツリー1') >= 0 || existingHeaders.indexOf('返信1') >= 0)) {
    // 旧名称「返信1〜4」だったら現名称「ツリー1〜4」にリネーム
    const renamed = renameLegacyReplyHeaders(sheet, existingHeaders);
    // 既に新レイアウト化済でもデータ検証/条件付き書式が旧位置に残っている可能性があるので冪等に再適用
    applyValidationsAndFormatting(sheet);
    if (renamed > 0) {
      ui.alert('既存の新レイアウトを検知しました。\n旧ヘッダー名「返信1〜4」→「ツリー1〜4」にリネーム: ' + renamed + ' 列\nデータ検証・条件付き書式も最新に再適用しました。');
    } else {
      ui.alert('このシートは既に最新レイアウト。\nデータ検証・条件付き書式を最新に再適用しました（プルダウン・色分けが正しい列に設定されます）。');
    }
    return;
  }

  const res = ui.alert(
    'シートをツリー対応レイアウトに変換',
    '以下を実行します:\n\n' +
    '1. 現在のシートを「' + SHEET_NAME + '_backup_(日時)」にバックアップ\n' +
    '2. 列を新レイアウトに並び替え\n' +
    '   A=ステータス / B=日付 / C=時刻 / D=画像URL / E=投稿本文\n' +
    '   F〜I=ツリー1〜4（連鎖用） / J=投稿日時(数式)\n' +
    '3. K列以降（operation_id等）を非表示\n\n' +
    'バックアップが残るのでデータ消失リスクなし。進めますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (res !== ui.Button.OK) return;

  // 旧ヘッダーから列番号を特定
  function findOldCol(name) {
    const idx = existingHeaders.indexOf(name);
    return idx >= 0 ? idx + 1 : null;
  }
  const oldCols = {
    DATE: findOldCol('日付'),
    TIME: findOldCol('時刻'),
    BODY: findOldCol('投稿本文'),
    IMAGE: findOldCol('画像URL'),
    STATUS: findOldCol('ステータス'),
    OP_ID: findOldCol('operation_id'),
    ATTEMPT: findOldCol('attempt_count'),
    STATE_AT: findOldCol('state_updated_at'),
    CREATION: findOldCol('creation_id'),
    POSTED_AT: findOldCol('posted_at'),
    POST_ID: findOldCol('threads_post_id'),
    ERROR_MSG: findOldCol('error_message'),
  };
  const missing = [];
  Object.keys(oldCols).forEach(function (k) {
    if (!oldCols[k]) missing.push(k);
  });
  if (missing.length > 0) {
    ui.alert(
      '既存ヘッダーが見つかりません: ' + missing.join(', ') + '\n\n' +
      'シートのヘッダー行（1行目）が想定と違います。マニュアル修正してから再実行してください。'
    );
    return;
  }

  // バックアップ作成（先にやる: 万一以降の処理で失敗してもバックアップは残る）
  const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
  const backupName = SHEET_NAME + '_backup_' + ts;
  sheet.copyTo(ss).setName(backupName);

  // 既存データ（行2〜）を読み取り
  let oldData = [];
  if (lastRow >= 2) {
    oldData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  }

  // 新配列を構築
  const newData = [];
  for (let i = 0; i < oldData.length; i++) {
    const r = oldData[i];
    newData.push([
      r[oldCols.STATUS - 1],     // A: ステータス
      r[oldCols.DATE - 1],       // B: 日付
      r[oldCols.TIME - 1],       // C: 時刻
      r[oldCols.IMAGE - 1],      // D: 画像URL
      r[oldCols.BODY - 1],       // E: 投稿本文
      '', '', '', '',            // F〜I: ツリー1〜4（新規・空欄）
      '',                        // J: 投稿日時（数式は後で）
      r[oldCols.OP_ID - 1],      // K: operation_id
      r[oldCols.ATTEMPT - 1],    // L: attempt_count
      r[oldCols.STATE_AT - 1],   // M: state_updated_at
      r[oldCols.CREATION - 1],   // N: creation_id
      r[oldCols.POSTED_AT - 1],  // O: posted_at
      r[oldCols.POST_ID - 1],    // P: threads_post_id
      r[oldCols.ERROR_MSG - 1],  // Q: error_message
    ]);
  }

  // シートをクリアして新レイアウトを書き込み
  sheet.clear();

  // ヘッダー
  const colCount = NEW_LAYOUT_HEADERS.length;
  sheet.getRange(1, 1, 1, colCount).setValues([NEW_LAYOUT_HEADERS]);
  sheet.getRange(1, 1, 1, colCount)
    .setFontWeight('bold')
    .setBackground('#6a11cb')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // データ
  if (newData.length > 0) {
    sheet.getRange(2, 1, newData.length, colCount).setValues(newData);
  }

  // J列「投稿日時」を ARRAYFORMULA でシート全体カバー（既存データ + 将来行）
  // J2 だけ式を入れれば配下全行に自動展開される
  sheet.getRange('J2').setFormula(
    '=ARRAYFORMULA(IF(LEN(B2:B)*LEN(C2:C)=0,"",IFERROR(B2:B+TIMEVALUE(C2:C),"")))'
  );

  // データ検証（プルダウン）と条件付き書式を新レイアウトに合わせて適用
  applyValidationsAndFormatting(sheet);

  // 列幅調整（読みやすさ）
  sheet.setColumnWidth(1, 80);   // ステータス
  sheet.setColumnWidth(2, 100);  // 日付
  sheet.setColumnWidth(3, 70);   // 時刻
  sheet.setColumnWidth(4, 140);  // 画像URL
  sheet.setColumnWidth(5, 280);  // 投稿本文
  sheet.setColumnWidth(6, 220);  // ツリー1
  sheet.setColumnWidth(7, 220);  // ツリー2
  sheet.setColumnWidth(8, 220);  // ツリー3
  sheet.setColumnWidth(9, 220);  // ツリー4
  sheet.setColumnWidth(10, 130); // 投稿日時

  // K以降のシステム列を非表示
  sheet.hideColumns(NEW_LAYOUT_HIDDEN_FROM_COL, NEW_LAYOUT_HIDDEN_COUNT);

  ui.alert(
    '✅ 変換完了\n\n' +
    '新レイアウト:\n' +
    '・A=ステータス / B=日付 / C=時刻 / D=画像URL / E=投稿本文\n' +
    '・F〜I=ツリー1〜4（ツリー連鎖用、空欄なら単発投稿）\n' +
    '・J=投稿日時（数式、自動計算）\n' +
    '・K以降=システム列（非表示）\n\n' +
    '📦 バックアップ: シート「' + backupName + '」\n' +
    '※ データを確認してから不要なら削除してOKです'
  );
}

/**
 * シート全体のデータ検証を一旦クリアし、新レイアウトに合った位置に再適用する
 * - A列: ステータス プルダウン
 * - C列: 時刻 30分刻みプルダウン
 * - 条件付き書式: ステータス別の行色分け（A〜J列）
 *
 * sheet.clear() ではデータ検証/条件付き書式が消えないため、旧レイアウトの残骸が
 * 新レイアウトの別列に残ってしまう問題（例: 旧E列ステータス→新E列投稿本文 にプルダウン残存）を解決する
 */
function applyValidationsAndFormatting(sheet) {
  // 既存データ検証を全面クリア（旧位置の残骸を消す）
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();

  // ステータス列(A)プルダウン
  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['未投稿', '処理中', '投稿済', 'エラー', 'スキップ'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('A2:A').setDataValidation(statusValidation);

  // 時刻列(C)プルダウン: 30分刻み 00:00〜23:30
  const times = [];
  for (let h = 0; h < 24; h++) {
    times.push(('0' + h).slice(-2) + ':00');
    times.push(('0' + h).slice(-2) + ':30');
  }
  const timeValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(times, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('C2:C').setDataValidation(timeValidation);

  // 条件付き書式: ステータス別の行色分け（旧ルールを破棄して再設定）
  const visibleRange = sheet.getRange('A2:J');
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$A2="処理中"').setBackground('#fff7e0').setRanges([visibleRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$A2="投稿済"').setBackground('#e6f4ea').setRanges([visibleRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$A2="エラー"').setBackground('#fce4e4').setRanges([visibleRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$A2="スキップ"').setBackground('#eeeeee').setRanges([visibleRange]).build(),
  ];
  sheet.setConditionalFormatRules(rules);
}

/**
 * 既存シートのヘッダー名「返信1〜4」を「ツリー1〜4」に書き換える
 * @return リネームした列数
 */
function renameLegacyReplyHeaders(sheet, headers) {
  const map = { '返信1': 'ツリー1', '返信2': 'ツリー2', '返信3': 'ツリー3', '返信4': 'ツリー4' };
  let count = 0;
  Object.keys(map).forEach(function (oldName) {
    const idx = headers.indexOf(oldName);
    if (idx >= 0) {
      sheet.getRange(1, idx + 1).setValue(map[oldName]);
      count++;
    }
  });
  return count;
}
