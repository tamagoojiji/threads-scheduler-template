// ==========
// 投稿ランナー（メインロジック）
// 時間トリガーで定期実行される
// ==========

const MAX_ATTEMPTS = 3;
const FINISHED_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_ROWS_PER_RUN = 20;       // 1実行あたりの最大処理件数
const RUN_DEADLINE_MS = 5 * 60 * 1000; // 5分（GAS 6分制限の余裕）

/**
 * メイン: 投稿予定をチェックして処理
 * 時間トリガー（10分ごと）から呼ばれる
 *
 * - LockService で同時実行を防止（取得失敗時は即終了）
 * - 必須Propertiesが未設定の場合は throw
 * - 1実行あたり MAX_ROWS_PER_RUN 件 + RUN_DEADLINE_MS で打ち切り、残件は次回
 */
function postRunner() {
  // 同時実行防止
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    console.log('別の実行が進行中のためスキップ');
    return;
  }
  try {
    // 必須設定の検証（fail-fast）
    assertConfigured();

    const startedAt = Date.now();
    const deadline = startedAt + RUN_DEADLINE_MS;

    const allRows = readPendingRows();
    const rows = allRows.slice(0, MAX_ROWS_PER_RUN);
    console.log('処理対象: ' + rows.length + '行（全 ' + allRows.length + ' 行中）');

    let processed = 0;
    for (const row of rows) {
      if (Date.now() >= deadline) {
        console.log('締切到達、残りは次回トリガーで処理: 完了 ' + processed + '/' + rows.length);
        break;
      }
      processRow(row);
      processed++;
    }
    console.log('完了 ' + processed + '行 / 残 ' + (allRows.length - processed) + '行');
  } catch (err) {
    console.error('致命的エラー:', err);
    try {
      notifyDiscord('🚨 スケジューラー致命的エラー: ' + (err.message || err), { kind: 'fatal' });
    } catch (_) {}
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function processRow(row) {
  const prevStateUpdatedAt = row.stateUpdatedAt;
  try {
    if (!row.operationId) {
      row.operationId = Utilities.getUuid();
    }

    // reconciliation: 過去に成功している同operationIdの履歴があれば、その結果を反映
    const history = findHistorySuccess(row.operationId);
    if (history) {
      updateRow(row, {
        status: '投稿済',
        postedAt: history.postedAt,
        threadsPostId: history.postId,
        errorMessage: '',
        stateUpdatedAt: new Date(),
      });
      return;
    }

    // 処理中フラグ
    updateRow(row, {
      status: '処理中',
      operationId: row.operationId,
      attemptCount: row.attemptCount + 1,
      stateUpdatedAt: new Date(),
    });

    // creationId がある場合はステータスを確認
    if (row.creationId) {
      const status = getContainerStatus(row.creationId);
      if (status.status === 'PUBLISHED') {
        const postId = status.id;
        appendHistory({
          operationId: row.operationId,
          creationId: row.creationId,
          bodyExcerpt: row.body.slice(0, 50),
          result: '成功',
          postId: postId,
          postedAt: new Date(),
        });
        updateRow(row, {
          status: '投稿済',
          postedAt: new Date(),
          threadsPostId: postId,
          errorMessage: '',
          stateUpdatedAt: new Date(),
        });
        notifyDiscord('✅ 投稿成功: ' + row.body.slice(0, 80), { kind: 'post_success' });
        return;
      }
      if (status.status === 'IN_PROGRESS') {
        updateRow(row, { status: '未投稿', stateUpdatedAt: new Date() });
        return;
      }
      if (status.status === 'ERROR' || status.status === 'EXPIRED') {
        const newContainer = createContainer(row.body, row.imageUrl || null);
        updateRow(row, { creationId: newContainer.id, stateUpdatedAt: new Date() });
        row.creationId = newContainer.id;
      } else if (status.status === 'FINISHED') {
        if (prevStateUpdatedAt && prevStateUpdatedAt.getTime() > Date.now() - FINISHED_COOLDOWN_MS) {
          updateRow(row, { status: '未投稿', stateUpdatedAt: new Date() });
          return;
        }
      }
    } else {
      // 新規作成
      const container = createContainer(row.body, row.imageUrl || null);
      updateRow(row, { creationId: container.id, stateUpdatedAt: new Date() });
      row.creationId = container.id;
    }

    // 公開
    const publishResult = publishContainer(row.creationId);
    appendHistory({
      operationId: row.operationId,
      creationId: row.creationId,
      bodyExcerpt: row.body.slice(0, 50),
      result: '成功',
      postId: publishResult.id,
      postedAt: new Date(),
    });
    updateRow(row, {
      status: '投稿済',
      postedAt: new Date(),
      threadsPostId: publishResult.id,
      errorMessage: '',
      stateUpdatedAt: new Date(),
    });
    notifyDiscord('✅ 投稿成功: ' + row.body.slice(0, 80));
  } catch (err) {
    const message = err.message || String(err);
    console.error('行' + row.rowIndex + 'でエラー:', message);
    if (row.attemptCount >= MAX_ATTEMPTS) {
      appendHistory({
        operationId: row.operationId,
        creationId: row.creationId,
        bodyExcerpt: row.body.slice(0, 50),
        result: 'エラー',
        error: message,
        postedAt: new Date(),
      });
      updateRow(row, {
        status: 'エラー',
        errorMessage: message,
        stateUpdatedAt: new Date(),
      });
      notifyDiscord('❌ 投稿失敗（' + MAX_ATTEMPTS + '回リトライ後）: ' + message + '\n本文: ' + row.body.slice(0, 80), { kind: 'post_failure' });
    } else {
      updateRow(row, {
        status: '未投稿',
        errorMessage: message,
        stateUpdatedAt: new Date(),
      });
    }
  }
}
