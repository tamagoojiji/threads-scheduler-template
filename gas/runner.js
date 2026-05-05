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
  const isTree = row.replies && row.replies.length > 0;
  try {
    if (!row.operationId) {
      row.operationId = Utilities.getUuid();
    }

    // セル内画像が未変換 → リトライしても直らないので即エラー
    if (row.imageError) {
      updateRow(row, {
        status: 'エラー',
        errorMessage: row.imageError,
        attemptCount: MAX_ATTEMPTS,
        stateUpdatedAt: new Date(),
      });
      appendHistory({
        operationId: row.operationId,
        creationId: row.creationId,
        bodyExcerpt: row.body.slice(0, 50),
        result: 'エラー',
        error: row.imageError,
        postedAt: new Date(),
      });
      try {
        notifyDiscord('⚠️ ' + row.imageError + '\n本文: ' + row.body.slice(0, 80), { kind: 'post_failure' });
      } catch (_) {}
      return;
    }

    // reconciliation: 過去に成功している同operationIdの履歴があれば、その結果を反映
    // ツリー行はルート成功だけでは完了とみなさない（ツリー連鎖が未完了の可能性）→ 中断検出としてエラー固定
    const history = findHistorySuccess(row.operationId);
    if (history) {
      if (isTree) {
        const detail = 'ルート投稿成功履歴ありだがツリー完了が未確認（前回実行が中断された可能性）。Threadsで投稿状況を確認の上、必要なら手動でシートを修正してください。';
        updateRow(row, {
          status: 'エラー',
          attemptCount: MAX_ATTEMPTS,
          errorMessage: detail,
          threadsPostId: history.postId,
          stateUpdatedAt: new Date(),
        });
        try {
          notifyDiscord('⚠️ ツリー処理の中断検出（行' + row.rowIndex + '）: ' + detail + '\n本文: ' + row.body.slice(0, 80), { kind: 'tree_failure' });
        } catch (_) {}
        return;
      }
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
        // ツリー行はルートが publish 済みでもツリー連鎖が未完了の可能性 → 中断検出としてエラー固定
        if (isTree) {
          const detail = 'ルートは Threads に publish 済みだがツリーが未投稿（前回実行が中断された可能性）。Threadsで投稿状況を確認の上、必要なら手動でシートを修正してください。';
          updateRow(row, {
            status: 'エラー',
            attemptCount: MAX_ATTEMPTS,
            errorMessage: detail,
            threadsPostId: postId,
            stateUpdatedAt: new Date(),
          });
          try {
            notifyDiscord('⚠️ ツリー処理の中断検出（行' + row.rowIndex + '）: ' + detail + '\n本文: ' + row.body.slice(0, 80), { kind: 'tree_failure' });
          } catch (_) {}
          return;
        }
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

    // ルートを公開
    const publishResult = publishContainer(row.creationId);
    appendHistory({
      operationId: row.operationId,
      creationId: row.creationId,
      bodyExcerpt: row.body.slice(0, 50),
      result: '成功',
      postId: publishResult.id,
      postedAt: new Date(),
    });

    // ツリー連鎖が無ければ単発として完了
    const replies = row.replies || [];
    if (replies.length === 0) {
      updateRow(row, {
        status: '投稿済',
        postedAt: new Date(),
        threadsPostId: publishResult.id,
        errorMessage: '',
        stateUpdatedAt: new Date(),
      });
      notifyDiscord('✅ 投稿成功: ' + row.body.slice(0, 80));
      return;
    }

    // ツリー連鎖publish: ルート成功後、ツリー1〜N を順次連鎖
    let lastPostId = publishResult.id;
    for (let i = 0; i < replies.length; i++) {
      // Bot判定回避のため間隔を空ける
      Utilities.sleep(2000);
      try {
        const replyContainer = createContainer(replies[i], null, lastPostId);
        const replyPublish = publishContainer(replyContainer.id);
        lastPostId = replyPublish.id;
        appendHistory({
          operationId: row.operationId + '-r' + (i + 1),
          creationId: replyContainer.id,
          bodyExcerpt: replies[i].slice(0, 50),
          result: '成功',
          postId: lastPostId,
          postedAt: new Date(),
        });
      } catch (replyErr) {
        // 失敗 → その場で停止・再試行抑止（連続投稿によるBot判定回避）
        const replyMsg = (replyErr && replyErr.message) ? replyErr.message : String(replyErr);
        const detail = 'ツリー' + (i + 1) + 'で失敗: ' + replyMsg + ' / 投稿済: ルート + ツリー1〜' + i;
        appendHistory({
          operationId: row.operationId + '-r' + (i + 1),
          creationId: '',
          bodyExcerpt: replies[i].slice(0, 50),
          result: 'エラー',
          error: replyMsg,
          postedAt: new Date(),
        });
        updateRow(row, {
          status: 'エラー',
          attemptCount: MAX_ATTEMPTS,
          errorMessage: detail,
          threadsPostId: lastPostId,
          stateUpdatedAt: new Date(),
        });
        notifyDiscord('❌ ツリー投稿の途中で失敗\n' + detail + '\n本文: ' + row.body.slice(0, 80), { kind: 'tree_failure' });
        return;
      }
    }

    // 全ツリー成功
    updateRow(row, {
      status: '投稿済',
      postedAt: new Date(),
      threadsPostId: lastPostId,
      errorMessage: '',
      stateUpdatedAt: new Date(),
    });
    notifyDiscord('✅ ツリー投稿成功（ルート+ツリー' + replies.length + '段）: ' + row.body.slice(0, 80), { kind: 'post_success' });
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
