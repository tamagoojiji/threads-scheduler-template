import { SheetsClient } from './client.js';
import { PostRow } from './reader.js';

const SHEET_NAME = '投稿予約';
const HISTORY_SHEET = '投稿履歴';

export interface RowUpdate {
  status?: string;
  operationId?: string;
  attemptCount?: number;
  stateUpdatedAt?: Date;
  creationId?: string;
  postedAt?: Date;
  threadsPostId?: string;
  errorMessage?: string;
}

function toIso(date: Date): string {
  return date.toISOString();
}

export async function updateRow(
  sheets: SheetsClient,
  row: PostRow,
  update: RowUpdate,
): Promise<void> {
  const range = `${SHEET_NAME}!D${row.rowIndex}:K${row.rowIndex}`;
  const values: (string | number)[] = [
    update.status ?? row.status,
    update.operationId ?? row.operationId,
    update.attemptCount ?? row.attemptCount,
    update.stateUpdatedAt ? toIso(update.stateUpdatedAt) : row.stateUpdatedAt ? toIso(row.stateUpdatedAt) : '',
    update.creationId ?? row.creationId,
    update.postedAt ? toIso(update.postedAt) : row.postedAt ? toIso(row.postedAt) : '',
    update.threadsPostId ?? row.threadsPostId,
    update.errorMessage ?? row.errorMessage,
  ];
  await sheets.updateRow(range, values);
  Object.assign(row, {
    status: update.status ?? row.status,
    operationId: update.operationId ?? row.operationId,
    attemptCount: update.attemptCount ?? row.attemptCount,
    stateUpdatedAt: update.stateUpdatedAt ?? row.stateUpdatedAt,
    creationId: update.creationId ?? row.creationId,
    postedAt: update.postedAt ?? row.postedAt,
    threadsPostId: update.threadsPostId ?? row.threadsPostId,
    errorMessage: update.errorMessage ?? row.errorMessage,
  });
}

export interface HistoryEntry {
  operationId: string;
  creationId: string;
  bodyExcerpt: string;
  result: '成功' | 'エラー';
  postId?: string;
  error?: string;
  postedAt: Date;
}

export async function appendHistory(
  sheets: SheetsClient,
  entry: HistoryEntry,
): Promise<void> {
  await sheets.appendRow(HISTORY_SHEET, [
    toIso(entry.postedAt),
    entry.operationId,
    entry.creationId,
    entry.bodyExcerpt,
    entry.result,
    entry.postId ?? '',
    entry.error ?? '',
  ]);
}

export async function findHistorySuccess(
  sheets: SheetsClient,
  operationId: string,
): Promise<HistoryEntry | null> {
  const values = await sheets.getValues(`${HISTORY_SHEET}!A2:G`);
  for (const row of values) {
    const [postedAt, opId, creationId, bodyExcerpt, result, postId] = row;
    if (opId === operationId && result === '成功') {
      return {
        operationId: opId,
        creationId: creationId ?? '',
        bodyExcerpt: bodyExcerpt ?? '',
        result: '成功',
        postId: postId ?? '',
        postedAt: new Date(postedAt),
      };
    }
  }
  return null;
}
