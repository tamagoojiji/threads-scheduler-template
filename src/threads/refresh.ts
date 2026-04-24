const GRAPH_BASE = 'https://graph.threads.net';

export interface RefreshedToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function refreshLongLivedToken(
  currentAccessToken: string,
): Promise<RefreshedToken> {
  const url = `${GRAPH_BASE}/refresh_access_token?grant_type=th_refresh_token&access_token=${currentAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`トークン更新失敗: ${res.status} ${body}`);
  }
  return (await res.json()) as RefreshedToken;
}

export async function main() {
  const current = process.env.THREADS_ACCESS_TOKEN;
  if (!current) throw new Error('THREADS_ACCESS_TOKEN が設定されていません');

  const refreshed = await refreshLongLivedToken(current);
  console.log('トークン更新成功');
  console.log(`有効期間: ${refreshed.expires_in}秒（約${Math.floor(refreshed.expires_in / 86400)}日）`);
  console.log('');
  console.log('⚠️ 新しいトークンを GitHub Secrets の THREADS_ACCESS_TOKEN に更新してください:');
  console.log('');
  console.log(refreshed.access_token);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('エラー:', err);
    process.exit(1);
  });
}
