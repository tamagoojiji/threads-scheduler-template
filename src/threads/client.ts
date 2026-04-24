const GRAPH_BASE = 'https://graph.threads.net/v1.0';

export type ContainerStatus = 'PUBLISHED' | 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED';

export interface ContainerStatusResponse {
  id: string;
  status: ContainerStatus;
  error_message?: string;
}

export interface PublishResult {
  id: string;
}

export class ThreadsClient {
  constructor(
    private readonly userId: string,
    private readonly accessToken: string,
  ) {}

  async createContainer(text: string, imageUrl?: string): Promise<{ id: string }> {
    const mediaType = imageUrl ? 'IMAGE' : 'TEXT';
    const params = new URLSearchParams({
      media_type: mediaType,
      text,
      access_token: this.accessToken,
    });
    if (imageUrl) params.set('image_url', imageUrl);

    const res = await fetch(`${GRAPH_BASE}/${this.userId}/threads`, {
      method: 'POST',
      body: params,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`container作成失敗: ${res.status} ${body}`);
    }
    return (await res.json()) as { id: string };
  }

  async getContainerStatus(containerId: string): Promise<ContainerStatusResponse> {
    const url = `${GRAPH_BASE}/${containerId}?fields=id,status,error_message&access_token=${this.accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`container status取得失敗: ${res.status} ${body}`);
    }
    return (await res.json()) as ContainerStatusResponse;
  }

  async publishContainer(containerId: string): Promise<PublishResult> {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: this.accessToken,
    });
    const res = await fetch(`${GRAPH_BASE}/${this.userId}/threads_publish`, {
      method: 'POST',
      body: params,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`publish失敗: ${res.status} ${body}`);
    }
    return (await res.json()) as PublishResult;
  }
}
