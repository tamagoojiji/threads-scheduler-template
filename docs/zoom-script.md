# Zoom進行台本（tamago用）

スレッズスケジューラー導入Zoom同伴のための進行台本。所要時間の目安: 90〜100分。

---

## 事前準備（Zoom開始前）

### tamago側
- [ ] Metaの共有Developer画面のブックマーク確認
- [ ] Google Cloud Console画面のブックマーク確認
- [ ] 利用者に送付したテンプレートスプシ・テンプレートGitリポURLを手元に準備
- [ ] Discord Webhook URL の作成手順を復習

### 利用者への事前案内（申込確認メール内で送付）
- [ ] 次のアカウントを事前にご準備ください:
  - Googleアカウント（個人でも業務でもOK）
  - Instagram/Threadsアカウント（投稿先）
  - Discordアカウント（通知受信用）
- [ ] 支払い可能なクレジットカード or 携帯電話（電話番号認証用、Meta Developer登録で必須）
- [ ] Zoomで画面共有できる環境

---

## Zoom開始〜挨拶（5分）

### 台本
「本日はスレッズスケジューラーの導入にお時間いただきありがとうございます。
全体の流れとして、GitHub → Meta Developer → Google Cloud → テスト投稿 の順で進めます。所要時間は90分程度を見込んでいます。

重要なお願いとして、
- パスワードやカード情報は**一切お伺いしません**。すべて利用者様ご自身の画面で操作いただきます
- 作業中に不明点があれば、都度お声がけください
- 中断したい箇所があれば遠慮なくお申し出ください

それでは画面共有をお願いします。」

---

## Step 1: GitHubアカウント作成（未登録なら、5分）

### 確認
「GitHubアカウントはお持ちですか？」

### 台本（未登録の場合）
「github.com にアクセスしてください。右上の『Sign up』をクリック、メールアドレス → パスワード → ユーザー名の順で入力します。
ユーザー名は公開されるので、日本語以外で覚えやすいものにしてください（例: yamada-taro-2026）」

### チェックリスト
- [ ] GitHubアカウント登録完了
- [ ] メールアドレス認証完了

---

## Step 2: Meta Developerアカウント作成（15分）

### 台本
「次にMeta（Facebook）のDeveloperアカウントを作ります。`developers.facebook.com` にアクセスしてください。
右上の『Get Started』または『Log in』をクリックして、ご自身のFacebook/Instagramアカウントでログインします。」

### 注意事項
- Meta Developer登録は **電話番号認証が必須**
- Facebook/Instagramアカウントが必要（Threadsと同じアカウント）
- 既存FBアカウントに紐付く

### チェックリスト
- [ ] developers.facebook.com にログイン
- [ ] 電話番号認証完了
- [ ] 開発者規約に同意
- [ ] Developer Dashboardが表示される

---

## Step 3: Meta アプリ作成・Threads API追加（10分）

### 台本
「Developer Dashboardで『Create App』をクリックします。
Use Case は『Other』を選択、次の画面で『Business』を選択してください。

アプリ名は何でも構いません。後から変更可能です。例えば『My Threads Scheduler』など。」

### アプリ作成後の設定
1. 左メニュー「Add Products」→「Threads API」→「Set up」
2. Permission を最小構成で有効化:
   - `threads_basic`
   - `threads_content_publish`
3. 他のPermissionは**追加しない**（`threads_manage_replies`等は不要）

### チェックリスト
- [ ] アプリ作成完了（App IDが表示される）
- [ ] Threads API が Product として追加される
- [ ] 必要最小のPermissionのみ有効化

---

## Step 4: Redirect URI / Data Deletion URL 登録（5分）

### 台本
「Threads API の設定画面で、以下の2つのURLを登録します。

- **Redirect Callback URLs**: `https://tamagoojiji.github.io/threads-scheduler-template/oauth-done.html`
- **Deauthorize Callback URL**: （空欄でOK）
- **Data Deletion Request URL**: `https://tamagoojiji.github.io/threads-scheduler-template/data-deletion.html`

これらは私（tamago）が管理しているページで、認可コードの受け取りと、データ削除手順の案内用です。」

### チェックリスト
- [ ] Redirect Callback URL 入力完了
- [ ] Data Deletion Request URL 入力完了
- [ ] 保存成功

---

## Step 5: OAuth認可 → 長期トークン取得（10分）

### 台本
「次にご自身のThreadsアカウントで、このアプリに投稿権限を与える認可を行います。
私（tamago）がブラウザのURLバーに認可URLを入力するので、見守っていてください。
認可画面で『許可』をクリックすると、先ほど設定したページ（oauth-done.html）にリダイレクトされ、認可コードが表示されます。
そのコードをコピーしてZoomチャットに貼ってください（コードは一時的なもので、これ自体で投稿は不可能です）。」

### tamagoのコマンド実行（利用者の画面で）
```bash
# 短期トークン取得（コード → 短期トークン）
curl -X POST https://graph.threads.net/oauth/access_token \
  -d client_id=<App ID> \
  -d client_secret=<App Secret> \
  -d grant_type=authorization_code \
  -d code=<認可コード> \
  -d redirect_uri=https://tamagoojiji.github.io/threads-scheduler-template/oauth-done.html

# 長期トークンへ交換（短期 → 長期60日）
curl -X GET "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=<App Secret>&access_token=<短期トークン>"
```

### チェックリスト
- [ ] 認可URLで「許可」クリック
- [ ] 認可コード取得
- [ ] 短期トークン取得
- [ ] 長期トークン（60日）取得
- [ ] Threads User ID 取得（`/me` エンドポイント）

---

## Step 6: Google Cloud Console でOAuth Client作成（15分）

### 台本
「次にGoogle側の設定です。スプレッドシートにアクセスするためのOAuthクライアントを作成します。
`console.cloud.google.com` にログインしてください。
新しいプロジェクトを作成します。プロジェクト名は『Threads Scheduler』で構いません。」

### 手順
1. Google Cloud Console でプロジェクト作成
2. 「APIs & Services」→「Library」→「Google Sheets API」を有効化
3. 「OAuth consent screen」を設定:
   - User Type: **External**
   - App name: Threads Scheduler
   - User support email / Developer email: 利用者のメール
   - Scopes: `https://www.googleapis.com/auth/spreadsheets` を追加
   - Test users: 利用者自身のGmail追加
4. **「PUBLISH APP」→「PUSH TO PRODUCTION」**（重要: Testing状態だと7日で失効する）
5. verification要求が出たら「Go back」または後述のサービスアカウント方式へ
6. 「Credentials」→「Create Credentials」→「OAuth client ID」
   - Application type: Web application
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
   - Client ID / Client Secret を記録

### チェックリスト
- [ ] プロジェクト作成
- [ ] Google Sheets API 有効化
- [ ] OAuth consent screen設定 → In production化
- [ ] OAuth Client ID / Secret 取得

---

## Step 7: Google OAuth Playground でリフレッシュトークン取得（5分）

### 台本
「次にリフレッシュトークンを取得します。Google OAuth Playground という公式ツールを使います。
`developers.google.com/oauthplayground` にアクセスしてください。」

### 手順
1. 右上の歯車アイコン → Use your own OAuth credentials にチェック
2. Client ID / Client Secret を入力
3. 左メニューで `https://www.googleapis.com/auth/spreadsheets` を選択
4. 「Authorize APIs」→ Googleログイン画面で「許可」
5. 「Exchange authorization code for tokens」
6. 表示された Refresh Token をコピー

### チェックリスト
- [ ] Google OAuth Playground で認可完了
- [ ] Refresh Token 取得

---

## Step 8: GitHub テンプレリポをfork + Secrets登録（10分）

### 台本
「私のテンプレートリポジトリをご自身のGitHubアカウントにfork（複製）します。
`https://github.com/tamagoojiji/threads-scheduler-template` にアクセスして、右上の『Fork』ボタンをクリックしてください。

fork先のリポジトリを **Private** に設定してください（Settings → Danger Zone → Change visibility → Private）。」

### GitHub Secrets登録
Settings → Secrets and variables → Actions → New repository secret

```
THREADS_APP_ID = <Step 3で取得>
THREADS_APP_SECRET = <Step 3で取得>
THREADS_ACCESS_TOKEN = <Step 5の長期トークン>
THREADS_USER_ID = <Step 5の User ID>
GOOGLE_OAUTH_CLIENT_ID = <Step 6>
GOOGLE_OAUTH_CLIENT_SECRET = <Step 6>
GOOGLE_OAUTH_REFRESH_TOKEN = <Step 7>
SHEET_ID = <Step 9で取得>
DISCORD_WEBHOOK_URL = <Step 10で取得>
```

### チェックリスト
- [ ] forkまたはリポジトリ作成完了
- [ ] Private化完了
- [ ] 全Secrets登録完了

---

## Step 9: Googleスプシテンプレをコピー（5分）

### 台本
「私が管理しているスプレッドシートのテンプレートをご自身のGoogleドライブにコピーしていただきます。
テンプレートURLをチャットに送ります。
開いたら『ファイル』→『コピーを作成』でご自身のドライブに複製してください。」

### チェックリスト
- [ ] スプシコピー完了
- [ ] スプシURLのSHEET_ID部分をSecretsに登録

---

## Step 10: Discord Webhook作成・Secrets登録（5分）

### 台本
「エラー通知を受け取るDiscordチャンネルを作ります。既存のDiscordサーバーに新しいチャンネルを作るか、専用サーバーを作るかはお好みです。
チャンネル設定 → 連携サービス → Webhook → 新しいWebhook → Webhook URL をコピー、GitHub Secrets の `DISCORD_WEBHOOK_URL` に登録してください。」

### チェックリスト
- [ ] Discordチャンネル作成
- [ ] Webhook URL 取得
- [ ] Secrets登録完了

---

## Step 11: テスト投稿・動作確認（10分）

### 台本
「最後に動作確認をします。スプシに『3分後の日時 + テスト本文』を1行入れて、GitHub Actions を手動実行します。」

### 手順
1. スプシの予約シート A列に「今から3分後の日時」、B列に「テスト投稿（削除予定）」を入力
2. GitHub リポジトリ → Actions → 「post」workflow → 「Run workflow」手動実行
3. Actions のログで投稿成功を確認
4. Threadsアカウントで投稿が反映されたか確認
5. スプシの該当行の「ステータス」列が「投稿済」になったか確認

### トラブル時の確認項目
- Actions ログにエラー → エラーメッセージを確認
- 「投稿済」にならない → Google OAuth認可切れの可能性
- Threadsに反映されない → App Review未提出で自分以外に投稿している可能性

### チェックリスト
- [ ] テスト投稿成功
- [ ] Threadsに反映確認
- [ ] スプシステータス更新確認
- [ ] Discord通知確認（成功時は無通知が標準動作）

---

## クロージング（5分）

### 台本
「お疲れさまでした。これでセットアップは完了です。
以降は、スプシのA列に投稿日時、B列に投稿本文を書くだけで自動投稿されます。

サポートプラン（月額¥2,000）にご加入いただくと、エラー発生時の調査・対応や、Meta/Google仕様変更時の更新通知を受けられます。ご検討いただければ幸いです。

解約や削除をご希望の際は、docs/faq.md にある手順通りに進めていただけます。何か不明点があればメールでご連絡ください。」

### 配布物
- [ ] セットアップ手順書PDF（Claude.ai Artifactsで作成したもの、別途送付）
- [ ] FAQ（docs/faq.md）
- [ ] サポートプラン申込URL

---

## 補足: FAQ・トラブル対応の準備

Zoom中に発生しやすいトラブル:

| トラブル | 原因 | 対応 |
|--------|-----|------|
| Meta Developer登録で電話番号認証失敗 | SMS受信設定 | 別の電話番号 or アカウント再確認 |
| Google Cloud Consoleで権限エラー | 組織アカウント制限 | 個人Gmailで再実行 |
| Threads認可画面が出ない | スコープ設定ミス | Permissionを再確認 |
| リフレッシュトークンが `expires_in` 付き | Testing状態のまま | 必ず In production に切替 |

以上。
