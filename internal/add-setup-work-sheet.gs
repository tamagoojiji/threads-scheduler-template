/**
 * マスタースプシに「セットアップ作業」シートを追加するスクリプト
 *
 * 使い方:
 *   1. マスタースプシを開く（1a05tRc9-jMv-P7VNJQgn5jyyJHBQ2Zdp1zwsJiyxYI8）
 *   2. 拡張機能 → Apps Script
 *   3. このコードを貼り付け
 *   4. addSetupWorkSheet を実行
 *
 * 効果:
 *   - GitHub Secretsに登録する9個の値を貼り付ける場所が1箇所にまとまる
 *   - 値が入った行は自動で緑色になる（進捗が一目で分かる）
 *   - 利用者がスプシをコピーすればこのシートもついてくる
 */
function addSetupWorkSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existing = ss.getSheetByName('セットアップ作業');
  if (existing) {
    const ui = SpreadsheetApp.getUi();
    const res = ui.alert(
      '「セットアップ作業」シートが既に存在します。上書きしますか？',
      ui.ButtonSet.OK_CANCEL,
    );
    if (res !== ui.Button.OK) return;
    ss.deleteSheet(existing);
  }

  const sheet = ss.insertSheet('セットアップ作業', 0);

  // ヘッダー
  sheet.getRange(1, 1, 1, 5).setValues([
    ['#', 'GitHub Secret 名', '値（ここに貼り付け）', '取得元', 'メモ・形式'],
  ]);

  // データ行
  const rows = [
    ['1', 'THREADS_APP_ID', '',
     'Meta Developer > マイアプリ > アプリID',
     '数字の羅列（例: 1644523863261410）'],
    ['2', 'THREADS_APP_SECRET', '',
     'Meta Developer > 設定 > ベーシック > アプリシークレット',
     '「表示」ボタンを押して取得'],
    ['3', 'THREADS_ACCESS_TOKEN', '',
     'Meta Developer > ユースケース > Threads > 設定 > ユーザートークン生成ツール > 「アクセストークンを生成」',
     '長期トークン（60日有効・週1自動更新）'],
    ['4', 'THREADS_USER_ID', '',
     'tamagoがcurlコマンドで取得（Zoom中）',
     '数字の羅列（例: 35107700672178457）'],
    ['5', 'GOOGLE_OAUTH_CLIENT_ID', '',
     'Google Cloud Console > APIとサービス > 認証情報',
     '...apps.googleusercontent.com で終わる'],
    ['6', 'GOOGLE_OAUTH_CLIENT_SECRET', '',
     '同上（OAuthクライアントの詳細）',
     'GOCSPX- で始まる'],
    ['7', 'GOOGLE_OAUTH_REFRESH_TOKEN', '',
     'OAuth Playground > Exchange authorization code for tokens',
     '1// で始まる長い文字列'],
    ['8', 'SHEET_ID', '',
     'このスプシのURL内 /d/ と /edit/ の間の文字列',
     '長英数文字列'],
    ['9', 'DISCORD_WEBHOOK_URL', '',
     'Discord > チャンネル設定 > 連携サービス > Webhook',
     'https://discord.com/api/webhooks/... で始まる'],
  ];
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

  // 列幅
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 360);
  sheet.setColumnWidth(4, 340);
  sheet.setColumnWidth(5, 240);

  // ヘッダー装飾
  sheet.getRange(1, 1, 1, 5)
    .setBackground('#6a11cb')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // データ行スタイル
  sheet.getRange(2, 1, rows.length, 5).setVerticalAlignment('middle');
  sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment('center');
  sheet.getRange(2, 3, rows.length, 1).setBackground('#fff7e0'); // C列だけ目立たせる
  sheet.getRange(2, 1, rows.length, 5).setWrap(true);

  // 値が入ったら緑になる条件付き書式
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C2<>""')
    .setBackground('#d4edda')
    .setRanges([sheet.getRange(2, 1, rows.length, 5)])
    .build();
  const rules = sheet.getConditionalFormatRules();
  rules.push(rule);
  sheet.setConditionalFormatRules(rules);

  // 説明テキスト（最下部）
  const noteRow = rows.length + 3;
  sheet.getRange(noteRow, 1).setValue('使い方:');
  sheet.getRange(noteRow + 1, 1).setValue('1. 各項目の値を「値」列に貼り付ける（行ごとに緑色に変わる）');
  sheet.getRange(noteRow + 2, 1).setValue('2. 全9行緑になったら、tamagoがGitHub Secretsへ転記');
  sheet.getRange(noteRow + 3, 1).setValue('3. 全Secrets登録後、テスト投稿で動作確認');
  sheet.getRange(noteRow, 1, 4, 1).setFontStyle('italic').setFontColor('#666');

  // 一番左に配置（既に insertSheet(name, 0) で先頭にしているが念のため）
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  SpreadsheetApp.getUi().alert('「セットアップ作業」シートを追加しました');
}
