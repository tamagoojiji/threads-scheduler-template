// ==========
// スプシ読み書き
// 列はヘッダー名で解決する（ツリー列追加等の将来拡張に対応）
// ==========

const SHEET_NAME = '投稿予約';
const HISTORY_SHEET = '投稿履歴';

const HEADERS = {
  STATUS: 'ステータス',
  DATE: '日付',
  TIME: '時刻',
  IMAGE: '画像URL',
  BODY: '投稿本文',
  // ツリー機能: 1行内に ツリー1〜4 を横並びで配置（任意ヘッダー・無くても単発投稿として動作）
  TREE_1: 'ツリー1',
  TREE_2: 'ツリー2',
  TREE_3: 'ツリー3',
  TREE_4: 'ツリー4',
  SCHEDULED: '投稿日時',
  OP_ID: 'operation_id',
  ATTEMPT: 'attempt_count',
  STATE_AT: 'state_updated_at',
  CREATION: 'creation_id',
  POSTED_AT: 'posted_at',
  POST_ID: 'threads_post_id',
  ERROR_MSG: 'error_message',
};

const TREE_KEYS = ['TREE_1', 'TREE_2', 'TREE_3', 'TREE_4'];

// 旧ヘッダー名の後方互換マップ。getColMap() でメインの HEADERS が見つからなかった時に試す
// 既存シートが旧名（返信1〜4）のままでも次回トリガーで正しくツリー連鎖できるようにする
const HEADER_ALIASES = {
  TREE_1: ['返信1'],
  TREE_2: ['返信2'],
  TREE_3: ['返信3'],
  TREE_4: ['返信4'],
};

const REQUIRED_HEADER_KEYS = [
  'DATE', 'TIME', 'BODY', 'IMAGE', 'STATUS', 'OP_ID', 'ATTEMPT',
  'STATE_AT', 'CREATION', 'POSTED_AT', 'POST_ID', 'ERROR_MSG', 'SCHEDULED',
];

/**
 * ヘッダー名→列番号(1-indexed)の解決
 * 必須ヘッダーが欠けている場合は throw
 * 同一実行内で複数回呼ばれるため60秒キャッシュ（シートIDで分離）
 */
var _colMapCache = null;
var _colMapCacheKey = null;
var _colMapCacheAt = 0;
const COL_MAP_TTL_MS = 60 * 1000;

function getColMap(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('「' + SHEET_NAME + '」シートが見つかりません');
  const cacheKey = sheet.getSheetId();
  const now = Date.now();
  if (_colMapCache && _colMapCacheKey === cacheKey && (now - _colMapCacheAt) < COL_MAP_TTL_MS) {
    return _colMapCache;
  }
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('ヘッダー行が見つかりません');
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const map = {};
  Object.keys(HEADERS).forEach(key => {
    let idx = headers.indexOf(HEADERS[key]);
    if (idx < 0 && HEADER_ALIASES[key]) {
      // 旧ヘッダー名でフォールバック検索（後方互換）
      for (let a = 0; a < HEADER_ALIASES[key].length; a++) {
        idx = headers.indexOf(HEADER_ALIASES[key][a]);
        if (idx >= 0) break;
      }
    }
    if (idx >= 0) map[key] = idx + 1;
  });
  const missing = REQUIRED_HEADER_KEYS.filter(k => !map[k]);
  if (missing.length > 0) {
    throw new Error('必須ヘッダーが不足: ' + missing.map(k => HEADERS[k]).join(', '));
  }
  _colMapCache = map;
  _colMapCacheKey = cacheKey;
  _colMapCacheAt = now;
  return map;
}

/**
 * 未投稿 or リカバリ対象の行を取得
 */
function readPendingRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('「' + SHEET_NAME + '」シートが見つかりません');
  const colMap = getColMap(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const now = Date.now();
  const twentyMinAgo = now - 20 * 60 * 1000;

  const rows = [];
  values.forEach((v, i) => {
    const body = v[colMap.BODY - 1];
    const scheduledAtRaw = v[colMap.SCHEDULED - 1];
    const status = v[colMap.STATUS - 1];
    const attemptCount = Number(v[colMap.ATTEMPT - 1] || 0);
    const stateUpdatedAtRaw = v[colMap.STATE_AT - 1];

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

    // 画像列がCellImage(セル内画像)の場合は投稿前にURL化が必要
    const imgRaw = v[colMap.IMAGE - 1];
    let imageUrl = '';
    let imageError = null;
    if (imgRaw && typeof imgRaw === 'object' && typeof imgRaw.getContentUrl === 'function') {
      imageError = 'D列にセル内画像が配置されています。メニュー「🔄 セル内画像をURL化」を実行してから再度お試しください。';
    } else {
      imageUrl = String(imgRaw || '').trim();
    }

    // ツリー本文を配列化（空欄を除外）。ツリー列が無いシートでは [] になり単発投稿扱い
    const replies = [];
    TREE_KEYS.forEach(function (key) {
      if (!colMap[key]) return;
      const text = String(v[colMap[key] - 1] || '').trim();
      if (text) replies.push(text);
    });

    rows.push({
      rowIndex: i + 2,
      scheduledAt: scheduledAt,
      body: String(body),
      imageUrl: imageUrl,
      imageError: imageError,
      replies: replies,
      status: status || '未投稿',
      operationId: String(v[colMap.OP_ID - 1] || ''),
      attemptCount: attemptCount,
      stateUpdatedAt: stateUpdatedAtRaw ? new Date(stateUpdatedAtRaw) : null,
      creationId: String(v[colMap.CREATION - 1] || ''),
      postedAt: v[colMap.POSTED_AT - 1] ? new Date(v[colMap.POSTED_AT - 1]) : null,
      threadsPostId: String(v[colMap.POST_ID - 1] || ''),
      errorMessage: String(v[colMap.ERROR_MSG - 1] || ''),
    });
  });
  return rows;
}

/**
 * 行のシステム列を更新（列順序非依存・連続列はバッチ書き込みでI/O削減）
 */
function updateRow(row, update) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const colMap = getColMap(sheet);
  const fieldEntries = [
    ['status', colMap.STATUS, false],
    ['operationId', colMap.OP_ID, false],
    ['attemptCount', colMap.ATTEMPT, false],
    ['stateUpdatedAt', colMap.STATE_AT, true],
    ['creationId', colMap.CREATION, false],
    ['postedAt', colMap.POSTED_AT, true],
    ['threadsPostId', colMap.POST_ID, false],
    ['errorMessage', colMap.ERROR_MSG, false],
  ];
  const changes = [];
  fieldEntries.forEach(function (entry) {
    const field = entry[0], col = entry[1], isDate = entry[2];
    if (update[field] === undefined) return;
    const value = isDate ? toIso(update[field]) : update[field];
    changes.push({ col: col, value: value });
  });
  if (changes.length === 0) {
    Object.assign(row, update);
    return;
  }
  changes.sort(function (a, b) { return a.col - b.col; });
  // 連続列をまとめてバッチ書き込み
  let i = 0;
  while (i < changes.length) {
    let j = i;
    while (j + 1 < changes.length && changes[j + 1].col === changes[j].col + 1) j++;
    const runValues = [changes.slice(i, j + 1).map(function (c) { return c.value; })];
    sheet.getRange(row.rowIndex, changes[i].col, 1, j - i + 1).setValues(runValues);
    i = j + 1;
  }
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
