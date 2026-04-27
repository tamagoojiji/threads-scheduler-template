// ==========
// スプシ読み書き
// ==========

const SHEET_NAME = '投稿予約';
const HISTORY_SHEET = '投稿履歴';

// 列番号（1-indexed）
const COL = {
  DATE: 1,    // A
  TIME: 2,    // B
  BODY: 3,    // C
  IMAGE: 4,   // D
  STATUS: 5,  // E
  OP_ID: 6,   // F
  ATTEMPT: 7, // G
  STATE_AT: 8,// H
  CREATION: 9,// I
  POSTED_AT: 10, // J
  POST_ID: 11,// K
  ERROR_MSG: 12, // L
  SCHEDULED: 13, // M
};

const TOTAL_COLS = 13;

/**
 * 未投稿 or リカバリ対象の行を取得
 */
function readPendingRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('「' + SHEET_NAME + '」シートが見つかりません');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const now = Date.now();
  const twentyMinAgo = now - 20 * 60 * 1000;

  const rows = [];
  values.forEach((v, i) => {
    const body = v[COL.BODY - 1];
    const scheduledAtRaw = v[COL.SCHEDULED - 1];
    const status = v[COL.STATUS - 1];
    const attemptCount = Number(v[COL.ATTEMPT - 1] || 0);
    const stateUpdatedAtRaw = v[COL.STATE_AT - 1];

    if (!body || !scheduledAtRaw) return;
    const scheduledAt = scheduledAtRaw instanceof Date ? scheduledAtRaw : new Date(scheduledAtRaw);
    if (isNaN(scheduledAt.getTime())) return;
    if (scheduledAt.getTime() > now) return;
    if (attemptCount >= 3) return;

    const isPending = !status || status === '未投稿';
    let isStuckProcessing = false;
    if (status === '処理中' && stateUpdatedAtRaw) {
      const stateAt = stateUpdatedAtRaw instanceof Date ? stateUpdatedAtRaw : new Date(stateUpdatedAtRaw);
      if (!isNaN(stateAt.getTime()) && stateAt.getTime() < twentyMinAgo) {
        isStuckProcessing = true;
      }
    }
    if (!isPending && !isStuckProcessing) return;

    rows.push({
      rowIndex: i + 2,
      scheduledAt: scheduledAt,
      body: String(body),
      imageUrl: String(v[COL.IMAGE - 1] || ''),
      status: status || '未投稿',
      operationId: String(v[COL.OP_ID - 1] || ''),
      attemptCount: attemptCount,
      stateUpdatedAt: stateUpdatedAtRaw ? new Date(stateUpdatedAtRaw) : null,
      creationId: String(v[COL.CREATION - 1] || ''),
      postedAt: v[COL.POSTED_AT - 1] ? new Date(v[COL.POSTED_AT - 1]) : null,
      threadsPostId: String(v[COL.POST_ID - 1] || ''),
      errorMessage: String(v[COL.ERROR_MSG - 1] || ''),
    });
  });
  return rows;
}

/**
 * 行のシステム列（E〜L）を更新
 */
function updateRow(row, update) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const newValues = [
    update.status !== undefined ? update.status : row.status,
    update.operationId !== undefined ? update.operationId : row.operationId,
    update.attemptCount !== undefined ? update.attemptCount : row.attemptCount,
    toIso(update.stateUpdatedAt !== undefined ? update.stateUpdatedAt : row.stateUpdatedAt),
    update.creationId !== undefined ? update.creationId : row.creationId,
    toIso(update.postedAt !== undefined ? update.postedAt : row.postedAt),
    update.threadsPostId !== undefined ? update.threadsPostId : row.threadsPostId,
    update.errorMessage !== undefined ? update.errorMessage : row.errorMessage,
  ];
  sheet.getRange(row.rowIndex, COL.STATUS, 1, 8).setValues([newValues]);
  // ローカルrowも更新
  Object.assign(row, update);
}

function toIso(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString();
}

/**
 * 投稿履歴に追記
 */
function appendHistory(entry) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HISTORY_SHEET);
  if (!sheet) throw new Error('「' + HISTORY_SHEET + '」シートが見つかりません');
  sheet.appendRow([
    toIso(entry.postedAt),
    entry.operationId || '',
    entry.creationId || '',
    entry.bodyExcerpt || '',
    entry.result || '',
    entry.postId || '',
    entry.error || '',
  ]);
}

/**
 * 同じoperationIdの成功履歴を探す（reconciliation用）
 */
function findHistorySuccess(operationId) {
  if (!operationId) return null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HISTORY_SHEET);
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (row[1] === operationId && row[4] === '成功') {
      return {
        operationId: row[1],
        creationId: row[2] || '',
        bodyExcerpt: row[3] || '',
        result: '成功',
        postId: row[5] || '',
        postedAt: row[0] ? new Date(row[0]) : new Date(),
      };
    }
  }
  return null;
}
