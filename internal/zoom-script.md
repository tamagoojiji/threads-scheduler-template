# Zoom進行台本（テスター無料版）

スレッズスケジューラー導入Zoom同伴のための進行台本（テスター1名・無料モード）。所要時間の目安: 90〜100分。

正式販売モードへの差し戻しは末尾の「正式販売モードへの切替メモ」を参照。

---

## 事前準備（Zoom開始前）

### tamago側
- [ ] Meta Developer の `tamagoojiji@gmail.com` アカウントでログイン状態を確認
- [ ] Google Cloud Console をブックマーク
- [ ] マスタースプシURL（`1a05tRc9-jMv-P7VNJQgn5jyyJHBQ2Zdp1zwsJiyxYI8`）を手元に
- [ ] テンプレートGitリポURL（`https://github.com/tamagoojiji/threads-scheduler-template`）を手元に
- [ ] フィードバックフォームURLを手元に（Zoom終了時に送付）
- [ ] 公開セットアップ手順書 `https://tamagoojiji.github.io/threads-scheduler-template/setup-guide.html` を開いて画面共有準備

### 利用者への事前案内（応募確定メール内で送付）
- [ ] 当日までに次のアカウントをご準備ください:
  - Googleアカウント（個人でも業務でもOK）
  - Threadsアカウント（投稿先）
  - Discordアカウント（通知受信用）
- [ ] **PCのブラウザで `https://www.threads.net/` にログイン済みの状態にする**（Step 5-3の招待承認をPCで行うため）
- [ ] 携帯電話の準備（Meta Developer登録のSMS認証で必須・IP電話/050は不可な場合あり）
- [ ] Zoomで画面共有できる環境
- [ ] 事前に <code>setup-guide.html</code> を一読していただけると進行がスムーズです

---

## Zoom開始〜挨拶（5分）

### 台本
「本日はスレッズスケジューラーのテスターにお時間いただきありがとうございます。
全体の流れとして、GitHub → Meta Developer → Google Cloud → スプシ → Discord → テスト投稿 の順で進めます。所要時間は90分程度を見込んでいます。

重要なお願いとして、
- パスワードやカード情報は**一切お伺いしません**。すべて利用者様ご自身の画面で操作いただきます
- 作業中に不明点があれば、都度お声がけください
- 中断したい箇所があれば遠慮なくお申し出ください
- 終了後、簡単なフィードバックフォームへのご記入にご協力ください

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

## Step 3: Meta アプリ作成・Threads API追加（15分）

### 台本
「Developer Dashboardで『アプリを作成』をクリックします。
ユースケースは **『Threads APIにアクセス』** を選択してください。」

### アプリの設定 > ベーシック（重要）
新UIでは保存時にエラーが頻発します。以下すべてを揃えます:

- **カテゴリ**: `ビジネス・ページ`（他カテゴリだと保存不可）
- **プライバシーポリシーURL**: `https://www.facebook.com/privacy/policy/`（暫定でOK）
- **利用規約URL**: `https://www.google.com/`（暫定でOK）
- アプリドメイン・アイコンは空欄でも可

### ユースケース > カスタマイズ > 設定
3つすべてに `https://www.google.com/` を入力（空欄不可）:
- コールバックURLをリダイレクト
- アンインストールコールバックURL
- 削除コールバックURL

### Permission（最小構成）
- `threads_basic`
- `threads_content_publish`
- 他は追加しない

### チェックリスト
- [ ] アプリ作成完了（App IDが表示される）
- [ ] カテゴリ「ビジネス・ページ」設定
- [ ] コールバックURL3箇所すべて入力
- [ ] プライバシー・利用規約URL設定
- [ ] 必要最小のPermissionのみ有効化

---

## Step 4: Threads長期トークン取得（10分）

### 台本
「Meta公式の『ユーザートークン生成ツール』を使うと、curlコマンド不要で長期トークンが取れます。」

### 手順
1. 左メニュー `ユースケース → カスタマイズ → 設定` を開く
2. 画面下部「ユーザートークン生成ツール」までスクロール
3. **Threadsテスター** に利用者ご自身のThreadsアカウントを追加
4. 利用者がThreadsアプリ・Webからテスター招待を承認
5. 承認後、対応アカウントの右側「**アクセストークンを生成**」をクリック
6. 表示された長期アクセストークン（60日有効）をコピー保管

### Threads User ID取得（ブラウザのみ）
利用者がブラウザのアドレスバーに以下を入力（`<長期トークン>` を実際の値に置き換え）:

```
https://graph.threads.net/v1.0/me?fields=id&access_token=<長期トークン>
```

→ JSON `{"id":"数字"}` が表示される。`id` の値が `THREADS_USER_ID`。

### チェックリスト
- [ ] Threadsテスター承認完了
- [ ] 長期アクセストークン取得
- [ ] Threads User ID 取得

---

## Step 5: Google Cloud OAuth設定（15分）

### 台本
「次にGoogle側の設定です。スプレッドシートにアクセスするためのOAuthクライアントを作成します。
`console.cloud.google.com` にログインしてください。」

### 手順
1. 新規プロジェクト作成（名前: `Threads Scheduler` 等）
2. 「APIとサービス → ライブラリ」→ **Google Sheets API** を有効化
3. 「OAuth同意画面」を設定:
   - User Type: **External**
   - App name: Threads Scheduler
   - サポートメール・デベロッパーメール: 利用者のGmail
   - スコープに `.../auth/spreadsheets` を追加
   - Test users に利用者自身のGmail追加
4. **「アプリを公開」→「本番環境にプッシュ」**（重要: Testing状態だと7日でRefresh Token失効）
5. 「認証情報 → 認証情報を作成 → OAuthクライアントID」
   - アプリケーションの種類: **ウェブアプリケーション**
   - 承認済みのリダイレクトURI: `https://developers.google.com/oauthplayground`
   - Client ID / Client Secret を記録

### チェックリスト
- [ ] プロジェクト作成
- [ ] Google Sheets API 有効化
- [ ] OAuth consent screen設定 → 本番環境にプッシュ
- [ ] OAuth Client ID / Secret 取得

---

## Step 6: Refresh Token取得（5分）

### 台本
「Google OAuth Playground でRefresh Tokenを取得します。」

### 手順
1. `developers.google.com/oauthplayground` を開く
2. 右上の歯車 → **Use your own OAuth credentials** にチェック
3. Client ID / Client Secret を入力
4. 左の入力欄に `https://www.googleapis.com/auth/spreadsheets` を貼り付け
5. **「Force prompt（強制承認）」** オプションを有効化（必ずRefresh Tokenを返してもらうため）
6. `Authorize APIs` → Googleログイン → 「許可」
7. `Exchange authorization code for tokens`
8. 表示された Refresh Token（`1//` で始まる）をコピー保管

### チェックリスト
- [ ] Force prompt 有効化
- [ ] Refresh Token 取得

---

## Step 7: GitHubテンプレリポ複製（5分）

### 台本
「私のテンプレートリポジトリをご自身のGitHubアカウントに複製します。
`https://github.com/tamagoojiji/threads-scheduler-template` にアクセスして、緑の『Use this template → Create a new repository』をクリックしてください。

リポジトリ名は任意で、**Private** にチェックを入れてください。」

### チェックリスト
- [ ] リポジトリ作成完了
- [ ] Private化済み

---

## Step 8: Googleスプシテンプレをコピー（5分）

### 台本
「私が用意しているマスタースプシをご自身のGoogleドライブにコピーしていただきます。
URLをチャットに送ります。」

### 手順
1. tamagoがマスタースプシURLをチャットに送付
2. 利用者が `ファイル → コピーを作成` で複製
3. コピー後のURLから `SHEET_ID` 部分をコピー

### チェックリスト
- [ ] スプシコピー完了
- [ ] SHEET_ID 取得

---

## Step 9: Discord Webhook作成（5分）

### 台本
「エラー・成功通知を受け取るDiscordチャンネルを作ります。既存サーバーに新規チャンネルを作るか、専用サーバーを作るかはお好みです。」

### 手順
1. Discord で通知用チャンネルを作成
2. チャンネル設定 → 連携サービス → ウェブフック → 新しいウェブフック
3. 名前を「Threads Scheduler」等に
4. **ウェブフックURLをコピー**

### チェックリスト
- [ ] Discord チャンネル作成
- [ ] Webhook URL 取得

---

## Step 10: GitHub Secrets登録（10分）

### 設定箇所
複製したリポジトリ → `Settings → Secrets and variables → Actions` → `New repository secret`

### 登録するキー（9個）
```
THREADS_APP_ID         = <Step 3で取得>
THREADS_APP_SECRET     = <Step 3で取得>
THREADS_ACCESS_TOKEN   = <Step 4の長期トークン>
THREADS_USER_ID        = <Step 4のUser ID>
GOOGLE_OAUTH_CLIENT_ID     = <Step 5>
GOOGLE_OAUTH_CLIENT_SECRET = <Step 5>
GOOGLE_OAUTH_REFRESH_TOKEN = <Step 6>
SHEET_ID               = <Step 8>
DISCORD_WEBHOOK_URL    = <Step 9>
```

### チェックリスト
- [ ] 全9個のSecrets登録完了

---

## Step 11: テスト投稿・動作確認（10分）

### 手順
1. スプシ「投稿予約」シートのA列に「3分後の日時」、B列に「テスト投稿」を入力
2. D列ステータスのプルダウンから `未投稿` を選択
3. GitHub リポジトリ → Actions → `post` workflow → `Run workflow`
4. Actionsログで「処理対象: 1行 → 完了」を確認
5. Threadsアカウントで投稿が反映されたか確認
6. スプシのD列ステータスが `投稿済` になったか確認
7. Discordに `✅ 投稿成功` が届いたか確認

### トラブル時の確認項目
- Actions ログにエラー → エラーメッセージを確認
- 「投稿済」にならない → Google OAuth認可切れの可能性
- Threadsに反映されない → Threadsテスター承認の確認

### チェックリスト
- [ ] テスト投稿成功
- [ ] Threadsに反映確認
- [ ] スプシステータス更新確認
- [ ] Discord ✅通知確認

---

## クロージング（5分）

### 台本
「お疲れさまでした。これでセットアップは完了です。
以降は、スプシのA列に投稿日時、B列に投稿本文を書くだけで自動投稿されます。

テスターとしてご協力いただいたお礼に、後ほどフィードバックフォームのURLをチャットでお送りします。お時間あるときにご記入いただけると助かります。

何か不明点があればメールでご連絡ください。」

### 配布物（チャットで送付）
- [ ] セットアップ手順書 URL: `https://tamagoojiji.github.io/threads-scheduler-template/setup-guide.html`
- [ ] FAQ: `internal/faq.md`（必要時）
- [ ] フィードバックフォームURL（テスター運用1〜2週間後に送付）

---

## 補足: トラブル対応の準備

Zoom中に発生しやすいトラブル:

| トラブル | 原因 | 対応 |
|--------|-----|------|
| Meta「フォームを保存できません」 | カテゴリ未設定 / 必須URL空欄 | カテゴリ「ビジネス・ページ」+ 3箇所URL+プラポリ・利用規約全埋め |
| Meta SMS認証失敗 | キャリア / IP電話 | 別の電話番号 or 5〜10分置いて再試行 |
| Google `verification required` | Sensitive scope判定 | サービスアカウント方式へfallback（faq.md Q6参照） |
| Google `403 access_denied / 審査プロセス未完了` | OAuth同意画面が「テスト中」のまま | OAuth同意画面で「アプリを公開→本番環境にプッシュ」 |
| 「このアプリは確認されていません」警告 | verification未済（少人数なら問題なし） | 「詳細→安全ではないページに移動」をクリックして進む |
| Refresh Token返ってこない | Force prompt未設定 | Force prompt有効化して再認可 |
| Threads認可画面が出ない | テスター未承認 | Threadsアプリでテスター招待を承認 |

---

## 正式販売モードへの切替メモ

テスト終了後、有料販売に戻すときの差分:

- 挨拶台本: 「テスター」→「お申込み」
- 料金パート（クロージング）を復活: ¥20,000導入 + ¥2,000/月サポート
- フィードバックフォーム送付タスクを削除（または任意化）
- Stripe決済リンクを `docs/index.html` に埋め込み
- 申込フォームに支払い完了確認項目を追加

以上。
