/**
 * テスターフィードバックフォーム作成スクリプト
 *
 * 使い方:
 *   1. https://script.google.com で新規プロジェクトを作成（応募フォームと別プロジェクト推奨）
 *   2. このコードを貼り付け
 *   3. createFeedbackForm を実行
 *   4. 実行ログに表示されるURLをテスターに送付（Zoom終了時 / 1週間後 等）
 */
function createFeedbackForm() {
  const form = FormApp.create('スレッズスケジューラー｜テスターフィードバック');
  form.setDescription(
    'スレッズスケジューラーをご利用いただきありがとうございます。\n' +
    '今後の改善のため、率直なご意見をお聞かせください（所要時間: 5〜10分）。'
  );

  form.addTextItem()
    .setTitle('お名前（応募時と同じ）')
    .setRequired(true);

  // ===== セットアップ体験 =====
  form.addPageBreakItem().setTitle('1. セットアップ体験について');

  form.addScaleItem()
    .setTitle('セットアップ全体の難易度')
    .setBounds(1, 5)
    .setLabels('とても簡単', 'とても難しい')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('特に詰まった or 分かりづらかった工程（複数選択可）')
    .setChoiceValues([
      'GitHubアカウント作成',
      'Meta Developer登録（電話番号認証）',
      'Meta アプリ作成・設定',
      'Threads長期トークン取得',
      'Google Cloud OAuth設定',
      'Refresh Token取得',
      'GitHubリポジトリ複製',
      'スプシのコピー',
      'Discord Webhook作成',
      'GitHub Secrets登録',
      'テスト投稿',
      '特になし',
    ]);

  form.addParagraphTextItem()
    .setTitle('セットアップ手順書（setup-guide.html）の改善点')
    .setHelpText('わかりにくかった表現・追加してほしい説明など')
    .setRequired(false);

  // ===== 運用感 =====
  form.addPageBreakItem().setTitle('2. 運用してみて');

  form.addScaleItem()
    .setTitle('スプシでの予約投稿の使いやすさ')
    .setBounds(1, 5)
    .setLabels('使いにくい', '使いやすい')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('投稿時刻のズレ（最大15分）について')
    .setChoiceValues([
      '気にならない',
      '少し気になるが許容範囲',
      'もっと正確であってほしい',
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Discord通知の頻度')
    .setChoiceValues([
      'ちょうど良い',
      '成功通知が多すぎる（失敗時のみで良い）',
      '通知が足りない（もっと欲しい）',
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('運用中に発生したトラブル（あれば）')
    .setRequired(false);

  // ===== 価値・改善 =====
  form.addPageBreakItem().setTitle('3. 価値・改善');

  form.addScaleItem()
    .setTitle('総合満足度')
    .setBounds(1, 10)
    .setLabels('不満', '大満足')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('正式販売価格 ¥20,000（買い切り） + 月額サポート ¥2,000 についての印象')
    .setChoiceValues([
      '妥当だと思う',
      '少し高いが価値はある',
      '高いと思う',
      '安いと思う',
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('どんな機能が追加されたら、より価値を感じますか？')
    .setHelpText('例: 複数アカウント対応、AI投稿文生成、画像自動最適化、など')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('知人にこのサービスを紹介するとしたら、どんな一言で紹介しますか？')
    .setHelpText('LP文言の参考にさせていただきます')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('正式販売後も継続利用したいですか？')
    .setChoiceValues([
      'はい、有料でも継続したい',
      'はい、無料/割引なら継続したい',
      '今のところ継続予定なし',
      'まだ判断できない',
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('その他、自由なご意見・ご要望')
    .setRequired(false);

  form.setConfirmationMessage(
    'ご回答ありがとうございました！\n' +
    '今後の改善に活用させていただきます。'
  );

  Logger.log('==========');
  Logger.log('公開URL（テスターに送付するURL）:');
  Logger.log(form.getPublishedUrl());
  Logger.log('編集URL（自分用）:');
  Logger.log(form.getEditUrl());
  Logger.log('==========');
}
