import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { ThreadsClient } from './threads/client.js';
import { SheetsClient } from './sheets/client.js';
import { readPendingRows, PostRow } from './sheets/reader.js';
import { updateRow, appendHistory, findHistorySuccess } from './sheets/writer.js';
import { notifyDiscord } from './notify/discord.js';

const MAX_ATTEMPTS = 3;
const FINISHED_COOLDOWN_MS = 15 * 60 * 1000;

async function processRow(
  row: PostRow,
  threads: ThreadsClient,
  sheets: SheetsClient,
  discordWebhook: string,
): Promise<void> {
  const prevStateUpdatedAt = row.stateUpdatedAt;

  try {
    if (!row.operationId) {
      row.operationId = randomUUID();
    }

    const history = await findHistorySuccess(sheets, row.operationId);
    if (history) {
      await updateRow(sheets, row, {
        status: '投稿済',
        postedAt: history.postedAt,
        threadsPostId: history.postId,
        errorMessage: '',
        stateUpdatedAt: new Date(),
      });
      return;
    }

    await updateRow(sheets, row, {
      status: '処理中',
      operationId: row.operationId,
      attemptCount: row.attemptCount + 1,
      stateUpdatedAt: new Date(),
    });

    if (row.creationId) {
      const status = await threads.getContainerStatus(row.creationId);
      if (status.status === 'PUBLISHED') {
        const postId = status.id;
        await appendHistory(sheets, {
          operationId: row.operationId,
          creationId: row.creationId,
          bodyExcerpt: row.body.slice(0, 50),
          result: '成功',
          postId,
          postedAt: new Date(),
        });
        await updateRow(sheets, row, {
          status: '投稿済',
          postedAt: new Date(),
          threadsPostId: postId,
          errorMessage: '',
          stateUpdatedAt: new Date(),
        });
        await notifyDiscord(discordWebhook, `✅ 投稿成功: ${row.body.slice(0, 80)}`);
        return;
      }
      if (status.status === 'IN_PROGRESS') {
        await updateRow(sheets, row, { status: '未投稿', stateUpdatedAt: new Date() });
        return;
      }
      if (status.status === 'ERROR' || status.status === 'EXPIRED') {
        const newContainer = await threads.createContainer(row.body, row.imageUrl || undefined);
        await updateRow(sheets, row, { creationId: newContainer.id, stateUpdatedAt: new Date() });
        row.creationId = newContainer.id;
      } else if (status.status === 'FINISHED') {
        if (prevStateUpdatedAt && prevStateUpdatedAt.getTime() > Date.now() - FINISHED_COOLDOWN_MS) {
          await updateRow(sheets, row, { status: '未投稿', stateUpdatedAt: new Date() });
          return;
        }
      }
    } else {
      const container = await threads.createContainer(row.body, row.imageUrl || undefined);
      await updateRow(sheets, row, { creationId: container.id, stateUpdatedAt: new Date() });
      row.creationId = container.id;
    }

    const publishResult = await threads.publishContainer(row.creationId);

    await appendHistory(sheets, {
      operationId: row.operationId,
      creationId: row.creationId,
      bodyExcerpt: row.body.slice(0, 50),
      result: '成功',
      postId: publishResult.id,
      postedAt: new Date(),
    });
    await updateRow(sheets, row, {
      status: '投稿済',
      postedAt: new Date(),
      threadsPostId: publishResult.id,
      errorMessage: '',
      stateUpdatedAt: new Date(),
    });
    await notifyDiscord(discordWebhook, `✅ 投稿成功: ${row.body.slice(0, 80)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (row.attemptCount >= MAX_ATTEMPTS) {
      await appendHistory(sheets, {
        operationId: row.operationId,
        creationId: row.creationId,
        bodyExcerpt: row.body.slice(0, 50),
        result: 'エラー',
        error: message,
        postedAt: new Date(),
      });
      await updateRow(sheets, row, {
        status: 'エラー',
        errorMessage: message,
        stateUpdatedAt: new Date(),
      });
      await notifyDiscord(discordWebhook, `❌ 投稿失敗（${MAX_ATTEMPTS}回リトライ後）: ${message}\n本文: ${row.body.slice(0, 80)}`);
    } else {
      await updateRow(sheets, row, {
        status: '未投稿',
        errorMessage: message,
        stateUpdatedAt: new Date(),
      });
    }
  }
}

async function main() {
  const config = loadConfig();
  const threads = new ThreadsClient(config.threads.userId, config.threads.accessToken);
  const sheets = new SheetsClient({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    refreshToken: config.google.refreshToken,
    sheetId: config.google.sheetId,
  });

  const rows = await readPendingRows(sheets);
  console.log(`処理対象: ${rows.length}行`);

  for (const row of rows) {
    await processRow(row, threads, sheets, config.discord.webhookUrl);
  }

  console.log('完了');
}

main().catch(async (err) => {
  console.error('致命的エラー:', err);
  try {
    const config = loadConfig();
    await notifyDiscord(
      config.discord.webhookUrl,
      `🚨 スケジューラー致命的エラー: ${err instanceof Error ? err.message : String(err)}`,
    );
  } catch {
    // 通知失敗時は諦める
  }
  process.exit(1);
});
