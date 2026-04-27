# スレッズスケジューラー

Googleスプレッドシートに日時と本文を書くだけで、Threadsへ自動投稿される仕組み。**Google Apps Script版（GitHub不要・完全無料）**。

- 公開サイト: https://tamagoojiji.github.io/threads-scheduler-template/
- セットアップ手順: https://tamagoojiji.github.io/threads-scheduler-template/setup-guide.html

## 構成

```
docs/      公開LP・手順書・プラポリ等（GitHub Pages公開）
gas/       Apps Scriptコード（マスタースプシのApps Scriptに反映）
internal/  内部用ドキュメント（Zoom台本・テスター応募フォーム生成GAS等）
templates/ スプシテンプレ仕様書
```

## 動作の仕組み

1. 利用者がマスタースプシをコピー → 自分のGoogleドライブに作成（Apps Scriptもコピーされる）
2. スプシのカスタムメニュー「スレッズスケジューラー」から:
   - 初回セットアップ（Secrets登録）
   - トリガーをインストール（10分ごとの投稿チェック + 週次のトークン更新）
3. A列に日付、B列に時刻、C列に本文を入力
4. 10分以内にThreadsへ自動投稿、Discordに通知

## スプシの列構造（B方式）

| 列 | 用途 | 入力方法 |
|---|---|---|
| A | 日付 | カレンダーピッカー |
| B | 時刻 | 30分刻みプルダウン |
| C | 投稿本文 | 自由入力 |
| D | 画像URL | 任意 |
| E | ステータス | プルダウン（自動更新） |
| F〜L | システム管理 | 触らない |
| M | 投稿日時 | 数式（A+B自動結合） |

## ライセンス

Personal use only. 商用配布や転売はお問い合わせください。
