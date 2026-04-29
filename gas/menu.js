// ==========
// スプシのカスタムメニュー
// 開いた時に「スレッズスケジューラー」メニューが表示される
// ==========

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('スレッズスケジューラー')
    .addItem('🔧 初回セットアップ', 'setupProperties')
    .addItem('🔍 設定状況を確認', 'checkProperties')
    .addSeparator()
    .addItem('⚙️ 設定シートで一括入力（上級者向け）', 'setupSettingsSheet')
    .addItem('💾 設定シートからPropertiesに保存', 'saveSettingsFromSheet')
    .addSeparator()
    .addItem('▶️ 今すぐ投稿チェック', 'postRunner')
    .addItem('🔄 トークン手動更新', 'refreshTokenManual')
    .addSeparator()
    .addItem('⏰ トリガーをインストール', 'installTriggers')
    .addItem('📋 トリガー一覧', 'listTriggers')
    .addItem('🗑 トリガーを削除', 'uninstallTriggers')
    .addToUi();
}
