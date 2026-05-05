#!/bin/bash
# Apps Script URL（または scriptId）から scriptId を抽出して、その利用者のGASに clasp push する
# 完了後（成功/失敗/中断問わず）、.clasp.json は元の scriptId に自動復元される
#
# Usage:
#   ./push-to-user-script.sh "https://script.google.com/u/0/home/projects/xxxx/edit"
#   ./push-to-user-script.sh "1abc...xyz"   # scriptId 直接指定もOK

set -euo pipefail

GAS_DIR="$HOME/threads-scheduler-template/gas"
LOG_FILE="$HOME/threads-scheduler-template/scripts/push-log.tsv"
LOCK_DIR="$GAS_DIR/.push-lock"

# 引数チェック
if [ -z "${1:-}" ]; then
  cat <<USAGE
Usage:
  $0 "<Apps Script URL or scriptId>"

例1: URL を貼る
  $0 "https://script.google.com/u/0/home/projects/1abc.../edit"
例2: scriptId 直接
  $0 "1abc..."
USAGE
  exit 1
fi

INPUT="$1"

# scriptId 抽出
SCRIPT_ID=""
if [[ "$INPUT" =~ /projects/([a-zA-Z0-9_-]+) ]]; then
  SCRIPT_ID="${BASH_REMATCH[1]}"
elif [[ "$INPUT" =~ /d/([a-zA-Z0-9_-]+) ]]; then
  SCRIPT_ID="${BASH_REMATCH[1]}"
elif [[ "$INPUT" =~ ^[a-zA-Z0-9_-]{20,}$ ]]; then
  SCRIPT_ID="$INPUT"
fi

if [ -z "$SCRIPT_ID" ]; then
  echo "❌ scriptId の抽出に失敗しました"
  echo "   入力: $INPUT"
  echo "   想定形式: https://script.google.com/u/0/home/projects/<scriptId>/edit"
  exit 1
fi

echo "✅ scriptId 抽出: $SCRIPT_ID"

CLASP_FILE="$GAS_DIR/.clasp.json"
if [ ! -f "$CLASP_FILE" ]; then
  echo "❌ $CLASP_FILE が見つかりません"
  exit 1
fi

# 排他制御（mkdir はアトミックなので同時実行を弾ける）
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "❌ 別の push が実行中です（$LOCK_DIR が存在）。完了を待つか、固まっていれば手動で削除してください:"
  echo "   rmdir '$LOCK_DIR'"
  exit 1
fi

# 一時ファイルでバックアップ（プロセス間で衝突しない）
BACKUP_FILE=$(mktemp -t clasp_backup.XXXXXXXX)
cp "$CLASP_FILE" "$BACKUP_FILE"
ORIGINAL_ID=$(python3 -c "import json,sys; print(json.load(open('$CLASP_FILE'))['scriptId'])")
echo "📌 元の scriptId をバックアップ: $ORIGINAL_ID"

# クリーンアップ関数（trap で異常終了でも必ず復元）
cleanup() {
  local rc=$?
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$CLASP_FILE"
    rm -f "$BACKUP_FILE"
    local restored
    restored=$(python3 -c "import json; print(json.load(open('$CLASP_FILE'))['scriptId'])" 2>/dev/null || echo "unknown")
    echo "🔄 .clasp.json を復元: $restored"
  fi
  rmdir "$LOCK_DIR" 2>/dev/null || true
  exit $rc
}
trap cleanup EXIT INT TERM HUP

# 利用者の scriptId に書き換え
echo "{\"scriptId\":\"$SCRIPT_ID\",\"rootDir\":\".\"}" > "$CLASP_FILE"
echo "📝 .clasp.json を利用者 scriptId に切替"

# clasp push 実行
echo "📤 clasp push 中..."
RESULT="success"
if (cd "$GAS_DIR" && clasp push --force); then
  echo "✅ push 完了"
else
  echo "❌ push 失敗"
  RESULT="failure"
fi

# ログ追記
TS=$(date "+%Y-%m-%d %H:%M:%S")
mkdir -p "$(dirname "$LOG_FILE")"
if [ ! -f "$LOG_FILE" ]; then
  echo -e "timestamp\tscriptId\tresult" > "$LOG_FILE"
fi
echo -e "${TS}\t${SCRIPT_ID}\t${RESULT}" >> "$LOG_FILE"
echo "📝 ログ追記: $LOG_FILE"

if [ "$RESULT" = "failure" ]; then
  exit 1
fi

echo ""
echo "🎉 完了。利用者にこう案内してください:"
echo "  「反映完了しました。スプシをリロードして、メニュー『スレッズスケジューラー → 🔧 シートをツリー対応レイアウトに変換』を1回押してください。」"
