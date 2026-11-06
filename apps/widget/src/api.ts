import type {
  WidgetSessionRequestDto,
  WidgetSessionResponseDto,
  StartConversationResponseDto,
  MessagePayload,
  SubmitCsatDto,
  ReportPageViewDto,
} from '@mira/shared-types';

export class WidgetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function requestError(response: Response): Promise<WidgetApiError> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  const message =
    typeof body?.message === 'string' && body.message.length <= 300
      ? body.message
      : `درخواست انجام نشد (${response.status}). دوباره تلاش کنید.`;
  return new WidgetApiError(message, response.status);
}

export class WidgetApi {
  constructor(private readonly baseUrl: string) {}

  async submitForm(
    token: string,
    conversationId: string,
    messageId: string,
    answers: Record<string, string | boolean>,
    clientMessageId: string,
  ): Promise<MessagePayload> {
    return this.post<MessagePayload>(
      `/v1/widget/conversations/${conversationId}/forms/${messageId}/submit`,
      { answers, clientMessageId },
      token,
    );
  }

  async createSession(payload: WidgetSessionRequestDto): Promise<WidgetSessionResponseDto> {
    return this.post<WidgetSessionResponseDto>('/v1/widget/sessions', payload);
  }

  async startConversation(visitorToken: string): Promise<StartConversationResponseDto> {
    return this.post<StartConversationResponseDto>(
      '/v1/widget/conversations',
      { pageUrl: window.location.href.slice(0, 1024), pageTitle: document.title.slice(0, 255) },
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
      throw await requestError(response);
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
      throw await requestError(response);
    }
  }

  private async get<T>(path: string, token: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw await requestError(response);
    }
    return response.json() as Promise<T>;
  }
}
