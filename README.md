# スレッズスケジューラー（threads-scheduler-template）

Threadsの予約投稿をGitHub Actionsで自動化するテンプレートリポジトリです。

## 概要

Googleスプレッドシートに「投稿日時」と「投稿本文」を書くだけで、指定時刻に自動でThreadsに投稿されます。

- **実行環境**: 利用者所有のGitHub Actions（Private repo、10分cron）
- **データ所有権**: すべて利用者所有（投稿予約・トークン・スプシ）
- **Meta App Review**: 不要（自分のアプリで自分のアカウントに投稿するDev Mode運用）

## このテンプレを使うには

本テンプレは **tamago 運営の導入代行サービス** と組み合わせて使うことを前提としています。
個人でセットアップしたい場合は `docs/faq.md` を参照してください。

## 重要な制約

- **標準10分cron**（5分cronは有料オプション）
- **配信保証**: at-least-once + reconciliation（稀に重複投稿の可能性あり）
- **Threadsアカウント**: 1リポジトリ=1アカウント（複数アカウントはv2）
- **Google OAuth**: consent screen を `In production` に変更必須（Testing状態だと7日失効）

## ディレクトリ構成

```
threads-scheduler-template/
├── .github/workflows/     # GitHub Actions（post / refresh-token）
├── src/                   # TypeScript実装
├── scripts/               # 手動実行スクリプト
├── docs/                  # GitHub Pages用静的HTML（LP・プラポリ等）
├── internal/              # 内部用: Zoom台本・FAQ（公開対象外）
└── templates/             # スプシテンプレ・Discord設定手順
```

## ライセンス

UNLICENSED（商用配布物、無断複製・転載禁止）

## 問い合わせ

@tamago_app 運営まで
