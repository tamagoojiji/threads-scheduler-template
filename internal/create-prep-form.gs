/**
 * 事前準備情報入力フォーム作成スクリプト（利用者用）
 *
 * 目的:
 *   セットアップに必要なメアド・ID・電話番号などを事前入力 → 当日コピペで使う。
 *   フォームと回答先スプシは利用者のGoogle Drive内に作成され、
 *   tamago（提供者）には一切届きません。
 *
 * 使い方（利用者向け案内）:
 *   1. https://script.google.com にご自身のGoogleアカウントでログイン
 *   2. 「新しいプロジェクト」をクリック
 *   3. このコードをすべて貼り付け
 *   4. 関数選択ドロップダウンで createPrepForm を選択
 *   5. ▷ 実行（初回は権限承認）
 *   6. 実行ログに表示される「公開URL」をブックマーク → スマホで事前入力
 *   7. 当日PCで「回答スプシ」を開いてコピペ
 *
 * パスワードについて:
 *   このフォームにはパスワード欄を**意図的に入れていません**。
 *   ご自身の手書きメモ or ブラウザ標準のパスワード保存機能で管理してください。
 */
function createPrepForm() {
  const form = FormApp.create('スレッズスケジューラー｜事前準備情報');
  form.setDescription(
    'セットアップ当日にコピペで使う情報を事前入力するフォームです。\n' +
    '\n' +
    '⚠️ 重要: このフォームに**パスワードは入力しないでください**。\n' +
    'パスワードは手書きメモ or ブラウザ標準のパスワード保存機能（Keychain / Chrome）で管理してください。\n' +
    '\n' +
    'このフォームと回答スプシはご自身のGoogle Drive内のみに保存され、tamago（提供者）には届きません。',
  );

  // ===== 1. 基本情報 =====
  form.addSectionHeaderItem().setTitle('1. 基本情報');

  form.addTextItem()
    .setTitle('お名前（ニックネーム可）')
    .setRequired(true);

  form.addTextItem()
    .setTitle('連絡用メールアドレス')
    .setHelpText('Zoomリンクの送信に使用するメアド')
    .setRequired(true);

  form.addTextItem()
    .setTitle('電話番号（SMS認証用）')
    .setHelpText('Meta Developer登録のSMS認証で使用。IP電話/050は不可')
    .setRequired(true);

  // ===== 2. Googleアカウント =====
  form.addSectionHeaderItem()
    .setTitle('2. Googleアカウント')
    .setHelpText('スプシ・OAuth設定で使用するGoogleアカウント');

  form.addTextItem()
    .setTitle('Googleアカウント（Gmailアドレス）')
    .setHelpText('例: yamada.taro@gmail.com')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Googleアカウントのパスワード保管場所')
    .setHelpText('例: 手書きメモ帳の3ページ目 / Keychainに保存済 / 1Password / など。実際のパスワードは入力しないでください')
    .setRequired(false);

  // ===== 3. Threadsアカウント =====
  form.addSectionHeaderItem()
    .setTitle('3. Threads / Instagramアカウント')
    .setHelpText('投稿先のアカウント');

  form.addTextItem()
    .setTitle('Threadsアカウント名')
    .setHelpText('例: @tamago_app（@マーク付き）')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Threadsログイン用メールアドレス または ユーザー名')
    .setHelpText('Instagramと同じものでOK')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Threads/Instagramのパスワード保管場所')
    .setHelpText('実際のパスワードは入力しないでください')
    .setRequired(false);

  // ===== 4. Facebookアカウント =====
  form.addSectionHeaderItem()
    .setTitle('4. Facebookアカウント（Meta Developer用）')
    .setHelpText('Meta Developerにログインする際に使用');

  form.addTextItem()
    .setTitle('Facebookログイン用メールアドレス または 電話番号')
    .setHelpText('Threadsと同じMetaアカウントなら同一でOK')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('Facebookパスワード保管場所')
    .setHelpText('実際のパスワードは入力しないでください')
    .setRequired(false);

  // ===== 5. Discordアカウント =====
  form.addSectionHeaderItem()
    .setTitle('5. Discordアカウント')
    .setHelpText('エラー・成功通知の受信用');

  form.addTextItem()
    .setTitle('Discordユーザー名')
    .setHelpText('例: tamago#1234 または tamago')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Discordログイン用メールアドレス')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Discordパスワード保管場所')
    .setHelpText('実際のパスワードは入力しないでください')
    .setRequired(false);

  // ===== 6. GitHubアカウント =====
  form.addSectionHeaderItem()
    .setTitle('6. GitHubアカウント')
    .setHelpText('未登録の方は当日Zoomで作成します');

  form.addMultipleChoiceItem()
    .setTitle('GitHubアカウント')
    .setChoiceValues(['持っている', '持っていない（当日作成）'])
    .setRequired(true);

  form.addTextItem()
    .setTitle('GitHubユーザー名（持っている方のみ）')
    .setHelpText('github.com/<ユーザー名> の部分')
    .setRequired(false);

  form.addTextItem()
    .setTitle('GitHubログイン用メールアドレス（持っている方のみ）')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('GitHubパスワード保管場所（持っている方のみ）')
    .setHelpText('実際のパスワードは入力しないでください')
    .setRequired(false);

  // ===== 7. 補足メモ =====
  form.addSectionHeaderItem().setTitle('7. その他');

  form.addParagraphTextItem()
    .setTitle('当日相談したいこと・気になっていること（任意）')
    .setRequired(false);

  // 確認メッセージ
  form.setConfirmationMessage(
    '保存しました。\n' +
    'いつでもこのフォームURLから内容を再編集できます（「回答を編集」リンク経由）。\n' +
    '当日は回答先スプレッドシートを開いて、各値をコピペしてください。',
  );

  // ユーザーが何度でも編集できるように
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(false);

  // 回答先スプシを自動作成
  const ssName = 'スレッズスケジューラー｜事前準備（回答）';
  const ss = SpreadsheetApp.create(ssName);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ログ出力
  Logger.log('==========');
  Logger.log('✅ フォーム作成完了');
  Logger.log('');
  Logger.log('【フォーム公開URL（事前入力用・スマホ可）】');
  Logger.log(form.getPublishedUrl());
  Logger.log('');
  Logger.log('【フォーム編集URL（必要なら設定変更用）】');
  Logger.log(form.getEditUrl());
  Logger.log('');
  Logger.log('【回答スプシURL（当日コピペ元）】');
  Logger.log(ss.getUrl());
  Logger.log('==========');
  Logger.log('使い方:');
  Logger.log('1. 公開URLをスマホでブックマーク');
  Logger.log('2. 事前にすべての項目を入力 → 送信');
  Logger.log('3. 当日PCで回答スプシを開いて各値をコピペ');
  Logger.log('==========');
}
