import { SheetsClient } from './client.js';

export interface PostRow {
  rowIndex: number;
  scheduledAt: Date;
  body: string;
  imageUrl: string;
  status: string;
  operationId: string;
  attemptCount: number;
  stateUpdatedAt: Date | null;
  creationId: string;
  postedAt: Date | null;
  threadsPostId: string;
  errorMessage: string;
}

const SHEET_NAME = '投稿予約';
const DATA_RANGE = `${SHEET_NAME}!A2:K`;

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseRow(values: string[], rowIndex: number): PostRow | null {
  const [
    scheduledAt,
    body,
    imageUrl,
    status,
    operationId,
    attemptCount,
    stateUpdatedAt,
    creationId,
    postedAt,
    threadsPostId,
    errorMessage,
  ] = values;

  const parsedScheduledAt = parseDate(scheduledAt);
  if (!parsedScheduledAt || !body) return null;

  return {
    rowIndex,
    scheduledAt: parsedScheduledAt,
    body,
    imageUrl: imageUrl ?? '',
    status: status ?? '未投稿',
    operationId: operationId ?? '',
    attemptCount: Number(attemptCount ?? '0') || 0,
    stateUpdatedAt: parseDate(stateUpdatedAt),
    creationId: creationId ?? '',
    postedAt: parseDate(postedAt),
    threadsPostId: threadsPostId ?? '',
    errorMessage: errorMessage ?? '',
  };
}

export async function readPendingRows(sheets: SheetsClient): Promise<PostRow[]> {
  const values = await sheets.getValues(DATA_RANGE);
  const now = Date.now();
  const twentyMinAgo = now - 20 * 60 * 1000;

  const rows: PostRow[] = [];
  for (let i = 0; i < values.length; i++) {
    const row = parseRow(values[i], i + 2);
    if (!row) continue;

    if (row.scheduledAt.getTime() > now) continue;
    if (row.attemptCount >= 3) continue;

    const isPending = row.status === '未投稿';
    const isStuckProcessing =
      row.status === '処理中' &&
      row.stateUpdatedAt !== null &&
      row.stateUpdatedAt.getTime() < twentyMinAgo;

    if (isPending || isStuckProcessing) rows.push(row);
  }
  return rows;
}
