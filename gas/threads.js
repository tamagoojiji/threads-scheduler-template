// ==========
// Threads API クライアント
// ==========

const THREADS_BASE = 'https://graph.threads.net/v1.0';
const THREADS_AUTH_BASE = 'https://graph.threads.net';

/**
 * コンテナ作成（投稿の下書き）
 * @param body {string} 本文
 * @param imageUrl {string|null} 画像URL（任意）
 * @param replyToId {string|null} 返信先のthreads_post_id（任意・ツリー連鎖時）
 */
function createContainer(body, imageUrl, replyToId) {
  const config = getConfig();
  const url = THREADS_BASE + '/' + config.threadsUserId + '/threads';
  const payload = {
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
    text: body,
    access_token: config.threadsAccessToken,
  };
  if (imageUrl) payload.image_url = imageUrl;
  if (replyToId) payload.reply_to_id = replyToId;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const json = JSON.parse(res.getContentText());
  if (code !== 200) {
    throw new Error('createContainer失敗 ' + code + ': ' + JSON.stringify(json));
  }
  return json; // { id: 'xxx' }
}

/**
 * コンテナのステータス取得
 */
function getContainerStatus(creationId) {
  const config = getConfig();
  const url = THREADS_BASE + '/' + creationId + '?fields=status,id&access_token=' + encodeURIComponent(config.threadsAccessToken);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  const json = JSON.parse(res.getContentText());
  if (code !== 200) {
    throw new Error('getContainerStatus失敗 ' + code + ': ' + JSON.stringify(json));
  }
  return json; // { id, status: 'PUBLISHED'|'IN_PROGRESS'|'FINISHED'|'ERROR'|'EXPIRED' }
}

/**
 * コンテナを公開（実投稿）
 */
function publishContainer(creationId) {
  const config = getConfig();
  const url = THREADS_BASE + '/' + config.threadsUserId + '/threads_publish';
  const payload = {
    creation_id: creationId,
    access_token: config.threadsAccessToken,
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const json = JSON.parse(res.getContentText());
  if (code !== 200) {
    throw new Error('publishContainer失敗 ' + code + ': ' + JSON.stringify(json));
  }
  return json; // { id: 'thread_id' }
}

/**
 * 長期トークン更新（refresh_access_token）
 * 60日有効のトークンを再延長する
 */
function refreshAccessToken() {
  const config = getConfig();
  const url = THREADS_AUTH_BASE + '/refresh_access_token?grant_type=th_refresh_token&access_token=' + encodeURIComponent(config.threadsAccessToken);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code !== 200) {
    throw new Error('refreshAccessToken失敗 ' + code + ': ' + text);
  }
  const json = JSON.parse(text);
  if (json.access_token) {
    PROPS.setProperty('THREADS_ACCESS_TOKEN', json.access_token);
  }
  return json; // { access_token, token_type, expires_in }
}
