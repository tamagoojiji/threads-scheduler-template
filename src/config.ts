export interface AppConfig {
  threads: {
    appId: string;
    appSecret: string;
    accessToken: string;
    userId: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    sheetId: string;
  };
  discord: {
    webhookUrl: string;
  };
  timezone: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
}

export function loadConfig(): AppConfig {
  return {
    threads: {
      appId: required('THREADS_APP_ID'),
      appSecret: required('THREADS_APP_SECRET'),
      accessToken: required('THREADS_ACCESS_TOKEN'),
      userId: required('THREADS_USER_ID'),
    },
    google: {
      clientId: required('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
      refreshToken: required('GOOGLE_OAUTH_REFRESH_TOKEN'),
      sheetId: required('SHEET_ID'),
    },
    discord: {
      webhookUrl: required('DISCORD_WEBHOOK_URL'),
    },
    timezone: process.env.TZ || 'Asia/Tokyo',
  };
}
