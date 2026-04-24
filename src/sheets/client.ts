import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface SheetsClientConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sheetId: string;
}

export class SheetsClient {
  private readonly sheets: sheets_v4.Sheets;
  public readonly sheetId: string;

  constructor(config: SheetsClientConfig) {
    this.sheetId = config.sheetId;
    const oauth2 = new OAuth2Client(config.clientId, config.clientSecret);
    oauth2.setCredentials({ refresh_token: config.refreshToken });
    this.sheets = google.sheets({ version: 'v4', auth: oauth2 });
  }

  async getValues(range: string): Promise<string[][]> {
    const res = await this.withRetry(() =>
      this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range,
      }),
    );
    return (res.data.values as string[][]) ?? [];
  }

  async updateRow(range: string, values: (string | number)[]): Promise<void> {
    await this.withRetry(() =>
      this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      }),
    );
  }

  async appendRow(sheetName: string, values: (string | number)[]): Promise<void> {
    await this.withRetry(() =>
      this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      }),
    );
  }

  async batchUpdate(
    updates: Array<{ range: string; values: (string | number)[][] }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.withRetry(() =>
      this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates.map((u) => ({
            range: u.range,
            values: u.values,
          })),
        },
      }),
    );
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const status = (err as { code?: number }).code ?? 0;
        if (status !== 429 && !(status >= 500 && status < 600)) throw err;
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw lastError;
  }
}
