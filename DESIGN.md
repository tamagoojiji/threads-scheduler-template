# DESIGN.md — スレッズスケジューラー

## 1. 概要
- **一言で**: Googleスプレッドシートに日時と文面を書くだけで、指定時刻に自動でThreadsに投稿される仕組み。
- **ビジネスモデル**: **Zoom同伴の導入代行サービス**。利用者が「自分のMeta Developerアプリ・自分のGitHub repo・自分のGoogleスプシ」を所有し、tamagoさんはセットアップ代行と任意の月額サポート。
- **ターゲット**: 基本的なPC操作ができるSNS運用者・個人事業主・中小企業（厳密なプログラミング知識は不要、ただし「Meta Developerアカウント作成」等は画面同伴で実施）。
- **実行環境**: **利用者所有のGitHub Actions（1利用者=1 Private repo、標準10分cron）**。VPS・GAS・サーバーレス関数すべて不使用。
- **Meta App Review**: **不要**（利用者が自分のアプリから自分のアカウントに投稿するDev Mode運用は永続利用可能なMeta公式仕様）。
- **配信保証レベル**: **at-least-once + reconciliation**（Threads公式APIに冪等キーがないため、投稿側で前方チェック＋事後照合で重複を抑止、ただし二重投稿の可能性はゼロではないことを利用規約で明示）。
- **コスト**:
  - 利用者側: **ランニングコスト ¥0**（Meta無料・Google無料・GitHub Actions Private 10分cron運用で無料枠内）
  - 5分cron運用は有料オプション（GitHub Actions有料プラン、利用者自己負担）
  - 利用者側: 導入代行費 **¥20,000（想定）**、月額サポート **¥2,000/月（任意）**
  - tamago側: インフラコスト **¥0**（常時稼働サーバーなし）

## 2. 機能一覧
| # | 機能名 | 説明 | 優先度 |
|---|--------|------|--------|
| 1 | 予約投稿 | 利用者スプシの投稿予約行を読み、指定時刻以降の未投稿行を catch-up で投稿 | 必須 |
| 2 | ステータス・履歴管理 | 同一スプシ内「投稿予約」「投稿履歴」シートで状態追跡・重複抑止（at-least-once + reconciliation） | 必須 |
| 3 | エラーDiscord通知 | 投稿失敗・トークン失効時、利用者自身のDiscordに通知 | 必須 |
| 4 | 過去日時入力のブロック | Sheetsデータ検証＋実行時ガードで過去日時投稿を防止 | 必須 |
| 5 | トークン自動更新 | Threads長期トークンを週1で refresh（50日目に延命） | 必須 |
| 6 | 画像付き投稿（オプション） | スプシに「画像URL」列を追加、初期設定でON/OFF | あれば嬉しい |

## 3. UI構成
**画面なし**（利用者所有のスプレッドシート + Discord が運用UI）

### 利用者が触るUI
| UI | 用途 | 提供形態 |
|----|------|---------|
| Googleスプレッドシート | 投稿予約入力・履歴確認 | テンプレをコピー |
| Discordチャンネル | 通知受信 | 利用者自身が設定 |

### スプレッドシート構造

**シート「投稿予約」**:
| 列 | 項目 | 入力者 | 備考 |
|---|---|---|---|
| A | 投稿日時 | 利用者 | データ検証で「今日以降」強制 |
| B | 投稿本文 | 利用者 | 500字ガイド、超過は実行時スキップ |
| C | 画像URL（オプション） | 利用者 | 画像機能ONの場合のみ |
| D | ステータス | システム（ProtectedRange） | 未投稿 / 処理中 / 投稿済 / エラー / スキップ |
| E | operation_id | システム（ProtectedRange） | UUID（実行intent識別子、初回のみ生成し不変） |
| F | attempt_count | システム（ProtectedRange） | 試行回数（最大3回） |
| G | state_updated_at | システム（ProtectedRange） | **状態遷移の最終時刻（ISO8601）**。全状態遷移で必ず更新、処理中スタック検出に使用 |
| H | creation_id | システム（ProtectedRange） | Threads公式 2段階APIの `/me/threads` で生成される container ID（再試行時の重複publish検出に使用） |
| I | posted_at | システム（ProtectedRange） | 投稿確定時刻 |
| J | threads_post_id | システム（ProtectedRange） | Threads API返却ID |
| K | error_message | システム（ProtectedRange） | 失敗時のエラー概要 |

**シート「投稿履歴」**（append-only、システム書き込みのみ）:
投稿成功・失敗のスナップショットを履歴として保持。ProtectedRangeで利用者は閲覧のみ。

**シート「設定」**（利用者閲覧のみ）:
画像機能ON/OFF、タイムゾーン（初期値 Asia/Tokyo）。

## 4. データ構造と保存データ台帳

### 4.1 利用者所有データ（tamagoは一切保持しない）
| 項目 | 保存先 | 所有者 | 削除権限 |
|------|--------|--------|---------|
| Threadsアクセストークン | 利用者のGitHub Secrets | 利用者 | 利用者 |
| Google OAuthリフレッシュトークン | 利用者のGitHub Secrets | 利用者 | 利用者 |
| 投稿予約・履歴 | 利用者のGoogle Sheets | 利用者 | 利用者 |
| Discord Webhook URL | 利用者のGitHub Secrets | 利用者 | 利用者 |
| Meta App情報（App ID/Secret） | 利用者のGitHub Secrets | 利用者 | 利用者 |

### 4.2 tamagoが保持するデータ（最小限）
| # | 項目 | 保存先 | 保存期間 | 削除契機 | 利用目的 |
|---|------|--------|----------|---------|---------|
| 1 | メールアドレス | tamago管理スプシ（連絡先リスト） | 最終連絡+1年 | 経過削除 | サポート連絡 |
| 2 | アカウント名（ハンドル） | 同上 | 最終連絡+1年 | 経過削除 | 顧客識別 |
| 3 | Stripe顧客ID（参照） | 同上 | 解約+30日 | 解約処理 | 決済状態確認 |

### 4.3 収集しないもの（明示）
- 氏名・住所・電話番号
- 決済カード情報（Stripeが保持、tamagoは参照しない）
- 投稿内容・投稿履歴（**利用者所有、tamagoは閲覧権限なし**）
- アクセストークン類（**利用者のGitHub Secrets、tamagoはアクセス不可**）

## 5. 外部サービス・API（利用者視点）

| サービス | 用途 | 認証方法 | 所有者 |
|----------|------|----------|--------|
| Threads Graph API | 投稿実行・トークン更新 | 利用者自身のMeta OAuth | 利用者 |
| Google Sheets API | スプシ読み書き | 利用者自身のGoogle OAuth | 利用者 |
| GitHub Actions | cron実行 | 利用者GitHubアカウント | 利用者 |
| Discord Webhook | 通知 | 利用者発行のWebhook URL | 利用者 |
| **Stripe**（tamago側） | 導入費・月額サポート決済 | Stripe Payment Links | tamago |

### 5.1 利用者のGitHub Secrets（利用者repo内、利用者のみ閲覧可）
| キー | 説明 | 取得元 |
|------|------|--------|
| THREADS_APP_ID | 利用者自身のMeta App ID | Meta for Developers |
| THREADS_APP_SECRET | 利用者自身のMeta App Secret | Meta for Developers |
| THREADS_ACCESS_TOKEN | 長期アクセストークン（60日） | OAuth認可後に生成 |
| THREADS_USER_ID | Threads User ID | Threads API `/me` |
| GOOGLE_OAUTH_REFRESH_TOKEN | Google OAuthリフレッシュトークン | Google OAuth Playground等で取得 |
| GOOGLE_OAUTH_CLIENT_ID | Google OAuth Client ID | Google Cloud Console |
| GOOGLE_OAUTH_CLIENT_SECRET | Google OAuth Client Secret | 同上 |
| SHEET_ID | 利用者のスプシID | スプシURLから抽出 |
| DISCORD_WEBHOOK_URL | 利用者のDiscord Webhook | Discord > チャンネル設定 |

## 6. 認証・権限モデル

### 6.1 Meta App（利用者所有）
- **各利用者が自分のMeta Developerアカウントで自分のアプリを作成**
- **審査不要**: 自分のアプリで自分のアカウントに投稿するのはDev Mode永続利用可能
- Requested Permissions: `threads_basic`, `threads_content_publish` のみ（最小権限）
- Data Deletion Instructions URL: **tamago提供の共通GitHub Pages URL**（例: `https://tamagoojiji.github.io/threads-scheduler-template/data-deletion`）を利用者がMeta App設定画面で指定
  - → このURLは単なる説明ページ（利用者が自分で削除する手順を案内）、HTTPSコールバック不要
- Redirect URI: **tamago提供の共通GitHub Pages URL**（例: `https://tamagoojiji.github.io/threads-scheduler-template/oauth-done`）
  - → このページはcodeを表示するだけの静的ページ、tamagoは受信しない

### 6.2 OAuthトークン取得フロー（Zoomセットアップ時に1回だけ実行）
```
Zoomで画面共有しながら tamagoが利用者の画面で実行:

① 利用者のMeta Developerでアプリ作成完了（App ID, App Secret取得）
    ↓
② 認可URLを生成してブラウザで開く
   https://threads.net/oauth/authorize?client_id=<利用者App ID>&redirect_uri=https://tamagoojiji.github.io/threads-scheduler-template/oauth-done&scope=threads_basic,threads_content_publish&response_type=code
    ↓
③ 利用者が自分のThreadsで「許可」
    ↓
④ GitHub Pages のcode表示ページにリダイレクト（codeが表示される）
    ↓
⑤ その場で code → 短期トークン → 長期トークン に交換（コマンド実行）
   curl -X POST https://graph.threads.net/oauth/access_token \
     -d client_id=<App ID> -d client_secret=<App Secret> \
     -d grant_type=authorization_code -d code=<code> \
     -d redirect_uri=https://tamagoojiji.github.io/threads-scheduler-template/oauth-done
    ↓
⑥ 長期トークンを利用者のGitHub Secretsに登録（gh CLI or ブラウザ）
    ↓
完了
```

**tamagoはトークンを保持しない。取得はすべて利用者の画面内で実行。tamagoはZoom画面越しの視認のみ。**

### 6.3 Google OAuth（利用者自身のGoogleアカウント）
- 利用者が自分のGoogle Cloud Consoleでプロジェクト作成→OAuth同意画面設定→認証情報作成
- **OAuth consent screen の publish status を「In production」に変更する**（必須）
  - 理由: Testing状態のままだと Google Sheets スコープのリフレッシュトークンが**7日で失効**する（Google公式仕様）

**Sensitive Scope の扱い（重要）**:
- `https://www.googleapis.com/auth/spreadsheets` は Google公式で **Sensitive scope** に分類される
- 通常は In production化時にGoogle verification（本人確認審査）が必要
- **本設計は personal-use 例外前提**: 各利用者が「自分のアカウントで自分のアプリを使って自分のスプシを読み書きする」運用なので、外部ユーザーは存在しない
- この personal-use / limited-user 条件下では、verification未了でもIn production化で運用可能（Google審査の裁量範囲）
- **将来的な一般公開・第三者ユーザー拡大は想定しない**（拡大する場合はMeta審査と同様、Google verificationも必要）

**具体手順**:
1. Google Cloud Console → APIs & Services → OAuth consent screen
2. User Type: External を選択
3. App情報を入力（App name, User support email, Developer email）
4. Scopes: `https://www.googleapis.com/auth/spreadsheets` を追加
5. Test Users に利用者自身のGmailを追加
6. 「PUBLISH APP」ボタンをクリック → 「PUSH TO PRODUCTION」
7. verification要求画面が出た場合は `docs/faq.md` のfallback手順（サービスアカウント方式）に切り替え
- Google OAuth Playgroundで一度だけ認可→リフレッシュトークン取得
- In production化後のリフレッシュトークンは長期有効（利用者が revoke しない限り失効しない）
- スプシアクセスは **利用者自身のGoogleアカウント権限**で動作

**Fallback（verification要求された場合）**:
- 利用者が自分のGCPでサービスアカウントを発行し、自分のスプシにそのメアドを編集者として追加
- GitHub Secretsにサービスアカウント鍵JSONを登録
- verification不要で運用可能
- `drive.file` スコープ（利用者が明示的に対象化したファイルに限定してアクセス）への切り替えも選択肢
- 詳細手順は `docs/faq.md` に記載予定

### 6.4 GitHub Secretsの管理
- **利用者所有のrepoにSecrets登録**（tamagoはアクセス不可）
- Zoomセットアップ時に一緒に登録
- 解約時は利用者がrepo削除→Secretsも自動消滅

## 7. スケジューラ設計（catch-up + at-least-once + reconciliation）

### 7.1 配信保証レベルの明示
- **保証レベルは at-least-once + reconciliation に留まる**（少なくとも1回は投稿され、失敗後は事後照合で整合回復）
- Threads公式publish APIに冪等キー機能がないため、より強い保証は提供しない
- 二重投稿の可能性はゼロではないが、`creation_id` の記録と履歴シート照合で **実用上の重複を限りなく抑制**
- 利用規約で「ごくまれに重複投稿の可能性があります」旨を明記

### 7.2 Threads 公式 publish フロー（2段階API）
Threads Graph APIは以下の2段階で投稿:

```
Stage 1: POST /{user-id}/threads
  Body: { media_type: 'TEXT'/'IMAGE', text: 本文, image_url: ... }
  → レスポンス: creation_id（container ID）

Stage 2: POST /{user-id}/threads_publish
  Body: { creation_id: <Stage 1で得たID> }
  → レスポンス: 投稿ID（post ID）
```
※ 未publishのcontainerは24時間で自動失効するため、orphan containerは無害。

### 7.3 シンプル化の根拠
利用者=1 repo=1 runner なので、**他ジョブとの競合がない**。排他制御は「workflow concurrency（同一workflowの直列化）」だけで十分。分散ロックは不要。

### 7.4 実行ロジック（疑似コード）
```python
# 10分ごとのcron（.github/workflows/post.yml）
# concurrency: group: 'post', cancel-in-progress: false で直列化

行一覧 = スプシ「投稿予約」.getRows(
  where: 投稿日時 <= now()
    AND (
      (status = '未投稿')
      OR (status = '処理中' AND state_updated_at < now() - 20分)
    )
    AND attempt_count < 3
)

for 行 in 行一覧:
  try:
    # ① 初回のみ operation_id 確保
    if 行.operation_id が空:
      行.operation_id = uuid()
    
    # ② 前回の state_updated_at を保存（FINISHED クールダウン判定に使用、後続の更新前に退避）
    prev_state_updated_at = 行.state_updated_at
    
    # ③ 事前 reconciliation: 履歴シートに成功記録があれば予約シートを整合化して終了
    history_entry = 履歴シート.find(operation_id=行.operation_id)
    if history_entry?.result == '成功':
      行.update(
        status='投稿済',
        posted_at=history_entry.posted_at,
        threads_post_id=history_entry.post_id,
        error_message='',
        state_updated_at=now()
      )
      continue
    
    # ④ 状態を「処理中」に遷移（必ず state_updated_at 更新）
    行.update(
      status='処理中',
      state_updated_at=now(),
      attempt_count=attempt_count + 1
    )
    
    # ④ Stage 1: container 作成 or 既存container状態確認
    if 行.creation_id が空:
      container = threads.createContainer(本文, 画像URL)  # POST /me/threads
      行.update(creation_id=container.id, state_updated_at=now())
    else:
      # 既存creation_idがある再試行 → Threads Container Status APIで分岐
      # GET /{container_id}?fields=id,status,error_message
      container_status = threads.getContainerStatus(行.creation_id)
      
      if container_status.status == 'PUBLISHED':
        # 既に投稿済み（publish成功後の後続処理失敗で再試行した場合）
        # → 履歴・予約シートを完全整合化（posted_at/post_id/error_message全て設定）
        post_id = container_status.published_post_id
        # status APIでpost_id取得不可な場合はThreads の /me/threads で最新投稿からcreation_id一致を探す
        履歴シート.append({
          operation_id: 行.operation_id,
          creation_id: 行.creation_id,
          result: '成功',
          post_id: post_id,
          posted_at: now()
        })
        行.update(
          status='投稿済',
          posted_at=now(),
          threads_post_id=post_id,
          error_message='',
          state_updated_at=now()
        )
        continue
      elif container_status.status == 'IN_PROGRESS':
        # Meta側でまだ処理中 → 今回はスキップ、次回再試行
        行.update(status='未投稿', state_updated_at=now())
        continue
      elif container_status.status in ['ERROR', 'EXPIRED']:
        # containerが壊れた/失効 → creation_idをクリアして新container作成
        行.update(creation_id='', state_updated_at=now())
        container = threads.createContainer(本文, 画像URL)
        行.update(creation_id=container.id, state_updated_at=now())
      elif container_status.status == 'FINISHED':
        # publishの前段階が完了、ただし前回publishがtimeout等で曖昧成功の可能性あり
        # クールダウン: 前回処理（prev_state_updated_at）から15分以内なら
        #   publish済みだが PUBLISHED 反映前の可能性ありと見なし、次回に持ち越し
        if prev_state_updated_at > now() - 15分:
          行.update(status='未投稿', state_updated_at=now())
          continue
        # 15分以上経過して FINISHED のまま = 未publish確定 → publish へ進む
    
    # ⑤ Stage 2: publish
    result = threads.publishContainer(行.creation_id)  # POST /me/threads_publish
    
    # ⑥ 履歴シートappend（source of truth）
    履歴シート.append({
      operation_id: 行.operation_id,
      creation_id: 行.creation_id,
      本文抜粋: 本文[:50],
      result: '成功',
      post_id: result.id,
      posted_at: now()
    })
    
    # ⑦ 予約シート更新
    行.update(
      status='投稿済',
      posted_at=now(),
      threads_post_id=result.id,
      error_message='',
      state_updated_at=now()
    )
  
  except Exception as e:
    if 行.attempt_count >= 3:
      履歴シート.append({operation_id, creation_id, result: 'エラー', error: str(e)})
      行.update(status='エラー', error_message=str(e), state_updated_at=now())
      discord.notify(f'投稿失敗: {e}')
    else:
      行.update(status='未投稿', error_message=str(e), state_updated_at=now())
```

### 7.5 重複抑止の仕掛け（at-least-onceでの現実解）
| 失敗シナリオ | 動作 |
|------------|-----|
| container作成成功・creation_id書き戻し失敗 | 次回、新containerを作成（前container は24h後自動失効、重複publishにはならない） |
| publish成功・履歴append失敗 | 次回、**Container Status API で `PUBLISHED` を検出**して履歴整合化（重複publishを回避） |
| publish成功・履歴append成功・予約シート更新失敗 | 次回、履歴の成功記録を見て予約シートのみ整合化（reconciliation） |
| publish API timeout（送信済み不明） | 次回、Container Status APIで確認 → `PUBLISHED` なら履歴整合化、`FINISHED` なら再publish |
| Container Status API自体が失敗 | 次回再試行、`state_updated_at` 超過で再処理対象に含まれる |

→ **Container Status API による事前確認**で実用上の重複を抑止する。ただし保証レベルは **at-least-once + reconciliation のまま**であり、Metaの`PUBLISHED` 反映遅延や異常系で稀に重複投稿が発生する可能性はゼロではない。利用規約で明示。

### 7.6 処理中スタック検出
- `status = '処理中'` かつ `state_updated_at < now() - 20分` の行は、前回runner死亡と判断して再試行対象に含める
- 10分cron × 2サイクル = 20分を閾値にして重複リスクを下げる

### 7.7 取りこぼし対策
- 10分cronがドロップしても、次回実行で `投稿日時 <= now()` 条件で拾える（catch-up）
- workflow_dispatch で手動起動も可能（緊急時）

### 7.8 60日無効化問題（Private repoなので該当しない）
GitHub公式ドキュメントで **60日無活動で scheduled workflow が自動 disable** と明記されているのは **Public repository に限る**。本設計は **Private repo** 固定なので該当しない。

- 参考: GitHub Docs "Scheduled workflows will only run on the default branch... For public repositories, if a scheduled workflow has not run for 60 days, it will be disabled"
- Private repo では継続実行される（ただしActions課金分数制限を超えた場合は停止、これは別問題）
- **対策**: 不要
- **監視**: 月次でActionsログをチェック（サポートプラン契約者向けのFAQに記載）

### 7.9 Google Sheets API クォータ
- 1利用者あたり毎分リクエスト数は極小（10分cron × 3read + 4write = 42req/run）
- **利用者ごとに独立したGoogle OAuth** → プロジェクト単位でのクォータ衝突なし
- 429/5xxは exponential backoff（1s→2s→4s、3回リトライ）
- batchUpdateで書き込みをまとめる

## 8. ユーザー作業（セットアップと運用）

### 8.1 セットアップフロー（Zoom同伴、所要1〜1.5時間）

| # | 作業 | 所要 | 担当 |
|---|------|-----|------|
| 1 | GitHubアカウント作成（未登録なら） | 5分 | 利用者（tamago画面共有） |
| 2 | Meta Developerアカウント作成・電話番号認証 | 15分 | 利用者（tamago画面共有） |
| 3 | Meta アプリ作成・Threads API追加・Permission設定 | 10分 | 利用者（tamago画面共有） |
| 4 | Data Deletion URL/Redirect URI 登録（tamagoの共通URL） | 5分 | 利用者（tamago画面共有） |
| 5 | OAuth認可 → code → 長期トークン取得 | 10分 | 利用者（tamago画面共有） |
| 6 | Google Cloud Console でOAuth Client作成 | 15分 | 利用者（tamago画面共有） |
| 7 | Google OAuth Playgroundでリフレッシュトークン取得 | 5分 | 利用者（tamago画面共有） |
| 8 | tamagoのテンプレリポをfork + Secrets登録 | 10分 | 利用者（tamago画面共有） |
| 9 | Googleスプシテンプレをコピー | 5分 | 利用者（tamago画面共有） |
| 10 | Discord Webhook作成・Secrets登録 | 5分 | 利用者（tamago画面共有） |
| 11 | テスト投稿・動作確認 | 10分 | 両者 |

**合計: 90〜100分程度**

### 8.2 運用中（利用者）
- スプシの「投稿予約」シートに日時と本文を書くだけ
- **10分cronで自動投稿**（標準仕様、無料枠内で運用可能）
- 5分cron希望の場合は有料オプション（GitHub Actions有料プラン加入が必要、利用者負担）
- エラーは自分のDiscordに通知される
- トークン更新は自動（週1）

### 8.3 tamagoさんの継続関与
- **サポートプラン契約者のみ**:
  - エラー発生時の調査・助言（利用者のrepoに一時的にCollaborator権限付与してもらう）
  - Meta/Google仕様変更時の更新通知
  - トラブル対応
- **サポート非契約者**: 個別対応しない（導入時の手順書で自己解決）

### 8.4 認証情報取り扱いポリシー（明文化）
- tamagoは**利用者のパスワード・トークン・OAuth codeを一切保存しない**
- Zoomセットアップ中は画面越しに見るのみ、録画禁止
- 録画する場合は**秘密情報が映る箇所を事前にカット**する運用（同意書で明示）

## 9. フェーズ定義

**審査不要のため1トラック構成**。

| Phase | 内容 | ローカル完了条件 | 本番完了条件 |
|-------|------|-----------------|------------|
| 0 | 初期設定 | — | tamagoテンプレリポ雛形完成、GitHub Pages（プラポリ・利用規約・Data Deletion・OAuth redirect用静的ページ）公開、Stripe商品登録 |
| 1 | コア投稿ロジック | `node scripts/manual-post.ts` で手動投稿成功 | GitHub Actions workflow_dispatch で投稿成功 |
| 2 | catch-up + at-least-once + reconciliation | テスト行を多重投下しても Container Status API で重複抑止され、失敗後に reconciliation で回復する | 10分cronで重複抑止が許容範囲で動作、失敗時の reconciliation で整合回復 |
| 3 | エラー通知 + 履歴記録 | Discord Webhook送信・履歴追記OK | 実エラー発生時にDiscord通知 |
| 4 | トークン自動更新 | refresh_access_token 呼び出し成功・期限延長確認 | 週次ジョブ完走、50日目の自動延命確認 |
| 5 | 画像投稿オプション | 画像URL付き投稿成功 | 設定ON時に画像付き投稿 |
| 6 | 導入手順書・Zoom台本 | — | **セットアップ手順書は Claude.ai（Artifacts）で別途作成**（本リポジトリ外）、Zoom進行台本・トラブル時FAQは `docs/` に格納 |
| 7 | プラポリ・利用規約公開 | — | GitHub Pagesで日本語公開（英語は任意） |
| 8 | Stripe連携 | Stripe Payment Linksで決済動作 | 自動返信→Zoom日程調整メール |
| 9 | **βリリース** | — | 知人2〜3名で完全セットアップ実施、問題なく稼働 |
| 10 | **一般販売開始** | — | LP公開、申込フォーム稼働 |

## 10. ファイル構成（計画）

**tamagoのテンプレリポ**:
```
threads-scheduler-template/
├── .github/
│   └── workflows/
│       ├── post.yml              — 10分ごとの予約投稿実行（5分は有料オプション）
│       └── refresh-token.yml     — 週1のトークン更新
├── src/
│   ├── index.ts                  — postエントリポイント
│   ├── config.ts                 — Secrets読み込み
│   ├── threads/
│   │   ├── client.ts             — Threads Graph APIクライアント
│   │   └── token.ts              — トークン更新
│   ├── sheets/
│   │   ├── client.ts             — Google Sheets APIクライアント（batchUpdate/backoff）
│   │   ├── reader.ts             — 予約行の読み取り
│   │   └── writer.ts             — ステータス・履歴書き込み
│   └── notify/
│       └── discord.ts            — Discord Webhook通知
├── scripts/
│   ├── manual-post.ts            — 手動投稿（開発・緊急時用）
│   └── setup-helper.ts           — セットアップ時のトークン検証
├── docs/
│   ├── zoom-script.md            — tamago用Zoom進行台本
│   └── faq.md                    — トラブル時FAQ
# ※ 利用者向けセットアップ手順書は Claude.ai（Artifacts）で別途作成・配布
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**tamagoのGitHub Pagesリポ**（別repo）:
```
threads-scheduler-site/
├── index.html                    — 商品LP
├── privacy-policy.html           — プライバシーポリシー
├── terms.html                    — 利用規約
├── data-deletion.html            — データ削除手順（Meta要求）
└── oauth-done.html               — OAuth redirect 着地ページ（codeを表示するだけ）
```

### ファイル分割ルール
- 1ファイル300行以内
- 抽象化は最小限（将来のSNS追加前提の adapter層は v2）

## 11. やらないこと（v1スコープ外）
- X（Twitter）対応
- Instagram / Facebook対応
- 複数Threadsアカウント管理（v2：別repo運用で対応可能）
- Web管理画面
- AI投稿文生成（別プロジェクト）
- 投稿内容の自動編集（500字超は実行時スキップ）
- 「改ざん耐性」レベルの監査証跡
- tamago側によるデータ共有プール・中央管理

## 12. 既知の制約・注意

### 時刻精度
- GitHub Actions cronは ±5〜15分のズレ（公式仕様）。「09:00指定 → 09:00〜09:15」と商品説明に明記
- catch-up方式なのでドロップしても次回実行で拾える

### Threads API制限
- テキスト500文字
- 1日250投稿/アカウント
- 長期トークン60日（自動更新で延命）

### GitHub Actions 料金・制限
- Private repo 無料枠: **月2000分/アカウント**（個人アカウントのFreeプラン）
- **標準仕様（10分cron × 30秒/run × 30日 = 1080分/月）** → 無料枠内に収まる
- 5分cron希望の場合（有料オプション）: 2160分/月となり有料プラン加入が必要（利用者負担）
- 60日無効化問題: **Private repoでは該当しない**（Public repoのみ対象、GitHub公式仕様）

### Google Sheets API
- 利用者ごとに独立プロジェクトなのでクォータ衝突なし
- 想定: 1利用者あたり毎分25req 以下（余裕）

### Meta App（利用者所有）
- 利用者のMeta DeveloperアカウントでDev Mode永続利用
- 審査不要
- App Secret漏洩時: 利用者が自身のMeta Consoleでreset→GitHub Secrets更新

### セキュリティ
- tamagoはトークン・スプシデータに一切アクセスしない（所有権が利用者にある）
- tamagoが保持するのは連絡用メール・アカウント名のみ
- Zoomセットアップ時の画面越し視認は「OAuth画面での許可ボタン押下」「トークン登録コマンド実行」のみ、生トークン値を目視しない運用

### Google OAuth refresh token の長期運用
- `spreadsheets` スコープは **Sensitive scope**（Google公式分類）
- 本設計は **personal-use / limited-user 前提**でIn production化し運用（各利用者が自分のアカウントで自分のスプシのみ操作）
- OAuth consent screen を In production にすれば、Sensitive scope でもリフレッシュトークンは長期有効
- **Testing状態のまま運用した場合**: refresh tokenが7日で失効する（Google公式仕様）→ 導入後すぐに投稿停止
- → セットアップ手順で **In production化を必須** とする（§6.3 参照）
- verification要求された場合のfallback: サービスアカウント方式への切り替え（`docs/faq.md` に記載）
- 第三者ユーザー拡大（不特定多数向け）は本設計スコープ外

### 責任分界（RACI相当）

| 項目 | 利用者 | tamago（サポートあり） | tamago（なし） |
|------|-------|---------------------|------------------|
| Meta App作成・管理 | R | C | — |
| Meta App Secret漏洩対応 | R | C（支援） | — |
| GitHub repo管理 | R | C | — |
| トークン失効時対応 | R | C | — |
| Google Sheets権限管理 | R | C | — |
| 投稿内容の適法性 | R | — | — |
| Meta Platform Terms遵守 | R | — | — |
| 初期セットアップ | C | R | R |
| エラー調査 | R | R（サポート範囲） | — |
| Meta/Google仕様変更追従 | R | R（通知＋対応支援） | — |

R=Responsible（実行責任）, C=Consulted（相談対象）

## 13. プライバシーポリシー・利用規約（GitHub Pages公開）

### 13.1 プライバシーポリシー項目（tamago運営者の責任範囲のみ）
1. 事業者情報
2. 収集する情報: **連絡用メールアドレス・アカウント名のみ**
3. **収集しない情報（明示）: 氏名、住所、電話番号、投稿内容、アクセストークン、決済情報**
4. 利用目的: サポート連絡・更新通知
5. 第三者提供: なし
6. 保存期間: 最終連絡から1年
7. Cookie: 使用しない
8. 問い合わせ先（メール）

**重要**: 利用者の投稿内容・トークン・スプシデータは **利用者所有**であり、tamago側のプラポリの範疇外。

### 13.2 利用規約項目
1. サービス概要（**セットアップ代行サービス**であることを明記）
2. 利用料金（初期代行費・月額サポート）
3. **免責範囲の明示**:
   - 初期セットアップ完了後、利用者が自己責任で運用
   - Meta/Google/GitHubの仕様変更による影響は免責
   - 投稿内容の適法性は利用者責任
4. 禁止事項: Meta Platform Terms違反、スパム、違法コンテンツ
5. tamago側の支援停止権（規約違反時）
6. 解約フロー: 月額サポート解除のみ（利用者のシステムは利用者所有のまま稼働継続）
7. 準拠法・管轄

### 13.3 Data Deletion Instructions ページ
- tamagoはデータを保持しないため、「削除したいデータは利用者自身のGoogleスプシ・GitHub Secretsにあり、利用者自身が削除してください」と案内
- tamago側の連絡先メールを削除したい場合の窓口も案内

## 14. 確定事項

| 項目 | 内容 |
|---|---|
| 商品名 | **スレッズスケジューラー** |
| ビジネスモデル | Zoom同伴の導入代行サービス（完全個人所有型） |
| 価格 | 導入費 ¥20,000（想定） + 月額サポート ¥2,000/月（任意） |
| Meta App Review | **不要**（利用者所有アプリで自己アカウント投稿） |
| Meta App | 利用者所有（利用者1人に1アプリ） |
| GitHub repo | 利用者所有（利用者のGitHubアカウント） |
| Googleスプシ | 利用者所有 |
| Google認証 | 利用者自身のOAuthリフレッシュトークン |
| トークン管理 | 利用者のGitHub Secrets |
| tamago側インフラ | GitHub Pages（静的のみ）＋ テンプレリポ |
| 個人情報 | **tamagoは連絡用メールのみ保持** |
| 決済 | Stripe経由、tamagoは氏名・カード情報非取得 |
| 氏名 | 収集しない |
| 排他制御 | 1利用者=1 runner なので GitHub Actions concurrency で十分 |
| 配信保証 | **at-least-once + reconciliation**（二重投稿ゼロではないが実用上抑制、利用規約で明示） |
| 標準cron間隔 | **10分**（無料枠内）、5分は有料オプション |
| Google OAuth | consent screen を **In production化が必須**（Testingだと7日失効） |
| Threads publish API | 公式2段階フロー（`/me/threads` → `/me/threads_publish`）に沿う |
| 60日無効化対策 | **不要**（Private repoでは該当しない、GitHub公式仕様） |

---

この設計で進めていいか承認をお願いします。承認後、Phase 0（GitHub Pages立ち上げ・テンプレリポ骨格作成・Stripe商品登録）に着手します。
