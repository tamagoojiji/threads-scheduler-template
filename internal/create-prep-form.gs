/**
 * 事前準備情報入力フォーム作成スクリプト（利用者用）
 *
 * 目的:
 *   セットアップに必要なメアド・ID・電話番号などを事前入力 → 当日コピペで使う。
 *   フォームと回答先スプシは利用者のGoogle Drive内に作成され、
 *   tamago（提供者）には一切届きません。
 *
 * 使い方:
 *   - 初回作成: createPrepForm を実行
 *   - 既存を作り直し: recreatePrepForm を実行（古いフォームをゴミ箱へ→新規作成）
 *
 * パスワードについて:
 *   このフォームにはパスワード欄を**意図的に入れていません**。
 *   ご自身の手書きメモ or ブラウザ標準のパスワード保存機能で管理してください。
 */

// 既存フォームを削除して新しいフォームを作り直す
function recreatePrepForm() {
  const OLD_FORM_ID = '1nteCjDInM0A0QU3v5pQptg5g606YETWs0t3EG2TulP0';
  try {
    const file = DriveApp.getFileById(OLD_FORM_ID);
    file.setTrashed(true);
    Logger.log('🗑 古いフォームをゴミ箱へ移動しました');
  } catch (e) {
    Logger.log('古いフォームは見つかりませんでした（既に削除済み）');
  }
  createPrepForm();
}

function createPrepForm() {
  const form = FormApp.create('スレッズスケジューラー｜事前準備情報');
  form.setDescription(
    'セットアップ当日にコピペで使う情報を事前入力します（所要5分）。\n' +
    '\n' +
    '⚠️ パスワードは入力不要です（手書きメモ or ブラウザ標準のパスワード保存機能で管理してください）。\n' +
    'データはあなたのGoogleドライブにのみ保存され、提供者には届きません。',
  );

  // ===== 基本情報 =====
  addText(form, 'お名前', 'ニックネーム可', true);
  addText(form, '連絡用メールアドレス', 'Zoom連絡用', true);
  addText(form, '電話番号', 'Meta SMS認証用（IP電話/050不可）', true);

  // ===== 各サービスのID/メアド =====
  addText(form, 'Googleアカウント（Gmail）', '例: yamada@gmail.com', true);

  addText(form, 'Threadsアカウント名', '例: @tamago_app（@マーク付き）', true);
  addText(form, 'Threadsログイン用ID/メアド', 'Instagramと同じものでOK', true);

  addText(form, 'Discordユーザー名', '例: tamago または tamago#1234', true);
  addText(form, 'Discordログイン用メールアドレス', '', true);

  addText(form, 'GitHubユーザー名', '未登録なら空欄でOK（当日作成）', false);
  addText(form, 'GitHubログイン用メールアドレス', '未登録なら空欄でOK', false);

  // ===== その他 =====
  addParagraph(
    form,
    'パスワード保管場所メモ',
    '例: 手書きノートの3p / Keychain保存済 / 1Password / など',
    false,
  );
  addParagraph(form, '当日相談したいこと（任意）', '', false);

  // 編集可能・確認メッセージ
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(false);
  form.setConfirmationMessage(
    '保存しました。\n' +
    'いつでもこのフォームから内容を再編集できます。\n' +
    '当日は回答スプシを開いて、各値をコピペしてください。',
  );

  // 回答スプシを自動作成
  const ss = SpreadsheetApp.create('スレッズスケジューラー｜事前準備（回答）');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log('==========');
  Logger.log('✅ フォーム作成完了');
  Logger.log('');
  Logger.log('【フォーム公開URL（事前入力用・スマホ可）】');
  Logger.log(form.getPublishedUrl());
  Logger.log('');
  Logger.log('【フォーム編集URL】');
  Logger.log(form.getEditUrl());
  Logger.log('');
  Logger.log('【回答スプシURL】');
  Logger.log(ss.getUrl());
  Logger.log('==========');
  Logger.log('フォームID（setup-guide.htmlのcopy URLに埋め込み）:');
  Logger.log(form.getId());
  Logger.log('==========');
}

// ヘルパー関数
function addText(form, title, help, required) {
  const item = form.addTextItem().setTitle(title).setRequired(required);
  if (help) item.setHelpText(help);
  return item;
}
function addParagraph(form, title, help, required) {
  const item = form.addParagraphTextItem().setTitle(title).setRequired(required);
  if (help) item.setHelpText(help);
  return item;
}
