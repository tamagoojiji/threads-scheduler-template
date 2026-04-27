// ==========
// スプシのカスタムメニュー
// 開いた時に「スレッズスケジューラー」メニューが表示される
// ==========

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('スレッズスケジューラー')
    .addItem('⚙️ 設定シートを準備', 'setupSettingsSheet')
    .addItem('💾 設定シートからPropertiesに保存', 'saveSettingsFromSheet')
    .addItem('🔍 設定状況を確認', 'checkProperties')
    .addSeparator()
    .addItem('🔧 プロンプト方式で個別設定', 'setupProperties')
    .addSeparator()
    .addItem('▶️ 今すぐ投稿チェック', 'postRunner')
    .addItem('🔄 トークン手動更新', 'refreshTokenManual')
    .addSeparator()
    .addItem('⏰ トリガーをインストール', 'installTriggers')
    .addItem('📋 トリガー一覧', 'listTriggers')
    .addItem('🗑 トリガーを削除', 'uninstallTriggers')
    .addToUi();
}
