import type {
  WidgetSessionRequestDto,
  WidgetSessionResponseDto,
  StartConversationResponseDto,
  MessagePayload,
  SubmitCsatDto,
  ReportPageViewDto,
} from '@mira/shared-types';

export class WidgetApi {
  constructor(private readonly baseUrl: string) {}

  async createSession(payload: WidgetSessionRequestDto): Promise<WidgetSessionResponseDto> {
    return this.post<WidgetSessionResponseDto>('/v1/widget/sessions', payload);
  }

  async startConversation(visitorToken: string): Promise<StartConversationResponseDto> {
    return this.post<StartConversationResponseDto>(
      '/v1/widget/conversations',
      undefined,
      visitorToken,
    );
  }

  async getMessages(visitorToken: string, conversationId: string): Promise<MessagePayload[]> {
    return this.get<MessagePayload[]>(
      `/v1/widget/conversations/${conversationId}/messages`,
      visitorToken,
    );
  }

  async submitCsat(
    visitorToken: string,
    conversationId: string,
    dto: SubmitCsatDto,
  ): Promise<void> {
    await this.postNoContent(`/v1/widget/conversations/${conversationId}/csat`, dto, visitorToken);
  }

  async reportPageView(visitorToken: string, dto: ReportPageViewDto): Promise<void> {
    await this.postNoContent('/v1/widget/page-views', dto, visitorToken);
  }

  private async post<T>(path: string, body?: unknown, token?: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`درخواست به ${path} با خطا مواجه شد (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private async postNoContent(path: string, body?: unknown, token?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`درخواست به ${path} با خطا مواجه شد (${response.status})`);
    }
  }

  private async get<T>(path: string, token: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`درخواست به ${path} با خطا مواجه شد (${response.status})`);
    }
    return response.json() as Promise<T>;
  }
}
