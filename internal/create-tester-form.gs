/**
 * テスター申込フォーム作成スクリプト
 *
 * 使い方:
 *   1. https://script.google.com で新規プロジェクトを作成
 *   2. このコードを貼り付け
 *   3. createTesterApplicationForm を実行
 *   4. 実行ログに表示されるURLを docs/index.html の apply-link に設定
 */
function createTesterApplicationForm() {
  const form = FormApp.create('スレッズスケジューラー｜テスター応募フォーム');
  form.setDescription(
    'スレッズスケジューラーのテスター（無料・先着1名様）にご応募いただきありがとうございます。\n' +
    '導入Zoomは1〜1.5時間、所要時間は90分程度を見込んでいます。\n\n' +
    '※ 応募多数の場合は、運用シーン・投稿頻度を踏まえて選考させていただきます。'
  );

  form.addTextItem()
    .setTitle('お名前（ニックネーム可）')
    .setRequired(true);

  form.addTextItem()
    .setTitle('連絡先メールアドレス')
    .setHelpText('Zoomリンク・選考結果のご連絡に使用します')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Threadsアカウント名（@マーク付き）')
    .setHelpText('例: @tamago_app')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Threadsの運用目的・投稿テーマ')
    .setHelpText('例: 子連れUSJ攻略の発信、ビジネス自動化のTips発信、など')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('現在の投稿頻度')
    .setChoiceValues(['週1回未満', '週2〜3回', '毎日', '1日複数回'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Zoom同伴セットアップの希望日時候補（複数選択可）')
    .setChoiceValues([
      '平日 朝（9〜11時）',
      '平日 昼（13〜16時）',
      '平日 夜（19〜22時）',
      '土日 朝（9〜11時）',
      '土日 昼（13〜16時）',
      '土日 夜（19〜22時）',
    ])
    .setRequired(true);

  form.addTextItem()
    .setTitle('上記候補から具体的な希望日（例: 4/30 夜）')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('質問・要望（任意）')
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('同意事項')
    .setChoiceValues([
      '導入後にフィードバックフォームへの回答に協力します',
      '利用規約・プライバシーポリシーを確認しました',
    ])
    .setRequired(true);

  form.setConfirmationMessage(
    'ご応募ありがとうございました。\n' +
    '内容を確認のうえ、ご記入いただいたメールアドレス宛にご連絡いたします（通常2〜3日以内）。'
  );

  Logger.log('==========');
  Logger.log('公開URL（応募者がアクセスするURL）:');
  Logger.log(form.getPublishedUrl());
  Logger.log('編集URL（自分用）:');
  Logger.log(form.getEditUrl());
  Logger.log('回答スプシ作成: フォーム編集画面の「回答」タブから「スプレッドシートにリンク」を実行');
  Logger.log('==========');
}
