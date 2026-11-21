import type {
  LoginRequestDto,
  LoginResponseDto,
  RefreshResponseDto,
  AuthSessionsResponseDto,
  MessagePayload,
  CannedResponseDto,
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
  VisitorInfoDto,
  SiteSettingsDto,
  UpdateSiteSettingsDto,
  CustomerContextDto,
  KnowledgeDocumentDto,
  CreateKnowledgeDocumentDto,
  UpdateKnowledgeDocumentDto,
  ReportsOverviewDto,
  AgentPerformanceDto,
  AutomationRuleDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  InternalNoteDto,
  WebhookDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  PublicApiKeyStatusDto,
  GeneratedApiKeyDto,
  TwoFactorSetupResponseDto,
  TwoFactorStatusDto,
  AgentDto,
  AgentProfileDto,
  CreateAgentDto,
  UpdateAgentDto,
  UpdateMyProfileDto,
  VisitorStatsDto,
  VisitorListItemDto,
  VisitorProfileDto,
  AiBillingDto,
  AiUsageReport,
  SystemStatusDto,
  ConversationUnreadDto,
  VisitorFlag,
  VisitorModeration,
  VisitorUpdatedPayload,
  UpdateVisitorDetailsDto,
  ModerateVisitorDto,
  ChatFormDto,
  SaveChatFormDto,
} from '@mira/shared-types';
import { API_URL } from './config';
import { decodeJwtPayload } from './jwt';

const SESSION_HEADERS = { 'Content-Type': 'application/json', 'X-Mira-Session': '1' };

// کوکی نشست فقط وقتی API و داشبورد هم‌مبدأ باشند کار می‌کند؛ نصب جدا همان نشست حافظه‌ای می‌ماند.
function sessionCookiesAvailable(): boolean {
  try {
    return new URL(API_URL, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export interface ConversationDto {
  visitorName?: string | null;
  visitorExternalId?: string | null;
  visitorDisplayName?: string | null;
  visitorFlags?: VisitorFlag[];
  visitorModeration?: VisitorModeration;
  deletedAt?: string | null;
  id: string;
  siteId: string;
  visitorId: string;
  assignedAgentId: string | null;
  aiPaused: boolean;
  status: string;
  department: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  priority: 'normal' | 'high';
  summary: string | null;
}

export interface ListConversationsParams {
  deleted?: 'only';
  status?: string;
  department?: string;
  search?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class ApiClient {
  listChatForms(): Promise<ChatFormDto[]> {
    return this.authedGet('/v1/chat-forms');
  }
  saveChatForm(dto: SaveChatFormDto, id?: string): Promise<ChatFormDto> {
    return id
      ? this.authedPatch(`/v1/chat-forms/${id}`, dto)
      : this.authedPost('/v1/chat-forms', dto);
  }
  archiveChatForm(id: string): Promise<void> {
    return this.authedDelete(`/v1/chat-forms/${id}`);
  }
  sendChatForm(
    conversationId: string,
    templateId: string,
    clientMessageId: string,
  ): Promise<MessagePayload> {
    return this.authedPost(`/v1/conversations/${conversationId}/forms`, {
      templateId,
      clientMessageId,
    });
  }
  sendChatLink(
    conversationId: string,
    dto: { url: string; title?: string; description?: string; clientMessageId: string },
  ): Promise<MessagePayload> {
    return this.authedPost(`/v1/conversations/${conversationId}/links`, dto);
  }
  private readonly visitorListeners = new Set<(visitor: VisitorUpdatedPayload) => void>();
  onVisitorUpdated(listener: (visitor: VisitorUpdatedPayload) => void): () => void {
    this.visitorListeners.add(listener);
    return () => {
      this.visitorListeners.delete(listener);
    };
  }
  notifyVisitorUpdated(visitor: VisitorUpdatedPayload): void {
    for (const listener of this.visitorListeners) listener(visitor);
  }
  async updateVisitorDetails(
    id: string,
    dto: UpdateVisitorDetailsDto,
  ): Promise<VisitorUpdatedPayload> {
    const visitor = await this.authedPatch<VisitorUpdatedPayload>(
      `/v1/visitors/${id}/details`,
      dto,
    );
    const updated = { ...visitor, visitorId: id };
    this.notifyVisitorUpdated(updated);
    return updated;
  }
  async moderateVisitor(id: string, dto: ModerateVisitorDto): Promise<VisitorUpdatedPayload> {
    const visitor = await this.authedPost<VisitorUpdatedPayload>(
      `/v1/visitors/${id}/moderation`,
      dto,
    );
    const updated = { ...visitor, visitorId: id };
    this.notifyVisitorUpdated(updated);
    return updated;
  }
  trashConversation(id: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/conversations/${id}/trash`);
  }
  restoreConversation(id: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/conversations/${id}/restore`);
  }
  async uploadAvatar(target: 'assistant' | 'me', image: Blob): Promise<{ url: string }> {
    const body = new FormData();
    body.append('image', image, 'avatar.png');
    const response = await this.authedFetch(`/v1/avatars/${target}`, { method: 'POST', body });
    if (!response.ok) throw new Error('ذخیره تصویر انجام نشد');
    return response.json() as Promise<{ url: string }>;
  }
  getKnowledgeDocument(id: string): Promise<KnowledgeDocumentDto> {
    return this.authedGet<KnowledgeDocumentDto>(`/v1/knowledge-base/${id}`);
  }
  updateKnowledgeDocument(
    id: string,
    dto: UpdateKnowledgeDocumentDto,
  ): Promise<KnowledgeDocumentDto> {
    return this.authedPatch<KnowledgeDocumentDto>(`/v1/knowledge-base/${id}`, dto);
  }
  reindexKnowledgeDocument(id: string): Promise<KnowledgeDocumentDto> {
    return this.authedPost<KnowledgeDocumentDto>(`/v1/knowledge-base/${id}/reindex`);
  }
  openVisitorConversation(visitorId: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/visitors/${visitorId}/conversation`);
  }
  getUnreadCount(): Promise<ConversationUnreadDto> {
    return this.authedGet<ConversationUnreadDto>('/v1/conversations/unread');
  }
  getSystemStatus(): Promise<SystemStatusDto> {
    return this.authedGet<SystemStatusDto>('/v1/system');
  }
  getAiBilling(): Promise<AiBillingDto> {
    return this.authedGet<AiBillingDto>('/v1/ai/billing');
  }
  getAiUsage(days: number): Promise<AiUsageReport> {
    return this.authedGet<AiUsageReport>(`/v1/ai/billing/usage?days=${days}`);
  }
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private agentId: string | null = null;
  private tokenGeneration = 0;
  private refreshInFlight: Promise<void> | null = null;
  onSessionExpired: (() => void) | null = null;

  static async restoreSessions(): Promise<ApiClient[]> {
    if (!sessionCookiesAvailable()) return [];
    const response = await fetch(`${API_URL}/v1/auth/session`, {
      method: 'POST',
      headers: SESSION_HEADERS,
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const { sessions } = (await response.json()) as AuthSessionsResponseDto;
    return sessions.map((session) => {
      const client = new ApiClient();
      client.agentId = session.agentId;
      client.accessToken = session.accessToken;
      return client;
    });
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.tokenGeneration += 1;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.agentId = decodeJwtPayload<{ sub?: string }>(accessToken)?.sub ?? null;
  }

  clearTokens(): void {
    this.tokenGeneration += 1;
    this.accessToken = null;
    this.refreshToken = null;
    this.agentId = null;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getAgentId(): string | null {
    return this.agentId;
  }

  // سوکت بعد از خواب سیستم نباید با توکن منقضی رد شود.
  async getFreshAccessToken(): Promise<string | null> {
    const expiresAt = this.accessToken
      ? decodeJwtPayload<{ exp?: number }>(this.accessToken)?.exp
      : undefined;
    if (expiresAt && expiresAt * 1000 - Date.now() < 60_000) {
      await this.refreshAccessToken().catch(() => undefined);
    }
    return this.accessToken;
  }

  // خروج باید کوکی را هم پاک کند؛ در صورت خطا نشست محلی نگه داشته می‌شود تا کاربر دوباره تلاش کند.
  async endSession(): Promise<void> {
    if (this.agentId && sessionCookiesAvailable()) {
      const response = await fetch(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: SESSION_HEADERS,
        body: JSON.stringify({ agentId: this.agentId }),
      });
      if (!response.ok) throw new Error('خروج از حساب کامل نشد');
    }
    this.clearTokens();
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const body: LoginRequestDto = { email, password };
    const response = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error('ایمیل یا رمز عبور نادرست است');
    }
    return response.json() as Promise<LoginResponseDto>;
  }

  // درخواست‌های هم‌زمان یک تمدید مشترک دارند تا با یک توکن منقضی چند بار به سرور نزنند.
  refreshAccessToken(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private expireSession(): void {
    this.clearTokens();
    this.onSessionExpired?.();
  }

  private async performRefresh(): Promise<void> {
    const generation = this.tokenGeneration;
    if (this.refreshToken) {
      const response = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (generation !== this.tokenGeneration) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) this.expireSession();
        return;
      }
      const data = (await response.json()) as RefreshResponseDto;
      if (generation === this.tokenGeneration) this.accessToken = data.accessToken;
      return;
    }
    if (!this.agentId) return;
    const response = await fetch(`${API_URL}/v1/auth/session`, {
      method: 'POST',
      headers: SESSION_HEADERS,
      body: JSON.stringify({ agentId: this.agentId }),
    });
    if (generation !== this.tokenGeneration || !response.ok) return;
    const { sessions } = (await response.json()) as AuthSessionsResponseDto;
    if (generation !== this.tokenGeneration) return;
    const session = sessions.find((item) => item.agentId === this.agentId);
    if (session) this.accessToken = session.accessToken;
    else this.expireSession();
  }

  private async authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const send = () =>
      fetch(`${API_URL}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}` },
      });
    const usedToken = this.accessToken;
    const response = await send();
    if (response.status !== 401) return response;
    if (this.accessToken === usedToken) await this.refreshAccessToken().catch(() => undefined);
    if (!this.accessToken || this.accessToken === usedToken) return response;
    return send();
  }

  async listConversations(params: ListConversationsParams = {}): Promise<ConversationDto[]> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.department) query.set('department', params.department);
    if (params.search) query.set('search', params.search);
    if (params.deleted) query.set('deleted', params.deleted);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.authedGet<ConversationDto[]>(`/v1/conversations${suffix}`);
  }

  async getMessages(conversationId: string): Promise<MessagePayload[]> {
    return this.authedGet<MessagePayload[]>(`/v1/conversations/${conversationId}/messages`);
  }

  async getConversation(conversationId: string): Promise<ConversationDto> {
    return this.authedGet<ConversationDto>(`/v1/conversations/${conversationId}`);
  }

  async assignConversation(conversationId: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/conversations/${conversationId}/assign`);
  }

  async resumeConversationAi(conversationId: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/conversations/${conversationId}/resume-ai`);
  }

  async resolveConversation(conversationId: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/conversations/${conversationId}/resolve`);
  }

  async markConversationRead(conversationId: string): Promise<void> {
    await this.authedPostNoContent(`/v1/conversations/${conversationId}/read`);
  }

  async updateConversation(
    conversationId: string,
    dto: { department?: string | null; tags?: string[]; priority?: 'normal' | 'high' },
  ): Promise<ConversationDto> {
    return this.authedPatch<ConversationDto>(`/v1/conversations/${conversationId}`, dto);
  }

  async getVisitorInfo(conversationId: string): Promise<VisitorInfoDto> {
    return this.authedGet<VisitorInfoDto>(`/v1/conversations/${conversationId}/visitor-info`);
  }

  async getCustomerContext(conversationId: string): Promise<CustomerContextDto> {
    return this.authedGet<CustomerContextDto>(
      `/v1/conversations/${conversationId}/customer-context`,
    );
  }

  async listCannedResponses(): Promise<CannedResponseDto[]> {
    return this.authedGet<CannedResponseDto[]>('/v1/canned-responses');
  }

  async createCannedResponse(dto: CreateCannedResponseDto): Promise<CannedResponseDto> {
    return this.authedPost<CannedResponseDto>('/v1/canned-responses', dto);
  }

  async updateCannedResponse(id: string, dto: UpdateCannedResponseDto): Promise<CannedResponseDto> {
    return this.authedPatch<CannedResponseDto>(`/v1/canned-responses/${id}`, dto);
  }

  async deleteCannedResponse(id: string): Promise<void> {
    await this.authedDelete(`/v1/canned-responses/${id}`);
  }

  async getSiteSettings(): Promise<SiteSettingsDto> {
    return this.authedGet<SiteSettingsDto>('/v1/sites/me');
  }

  async getWooConnectionStatus(): Promise<import('@mira/shared-types').WooConnectionStatusDto> {
    return this.authedGet('/v1/wordpress/status');
  }

  async updateSiteSettings(dto: UpdateSiteSettingsDto): Promise<SiteSettingsDto> {
    return this.authedPatch<SiteSettingsDto>('/v1/sites/me', dto);
  }

  async listKnowledgeDocuments(): Promise<KnowledgeDocumentDto[]> {
    return this.authedGet<KnowledgeDocumentDto[]>('/v1/knowledge-base');
  }

  async createKnowledgeDocument(dto: CreateKnowledgeDocumentDto): Promise<KnowledgeDocumentDto> {
    return this.authedPost<KnowledgeDocumentDto>('/v1/knowledge-base', dto);
  }

  async deleteKnowledgeDocument(id: string): Promise<void> {
    await this.authedDelete(`/v1/knowledge-base/${id}`);
  }

  async suggestReply(conversationId: string): Promise<void> {
    await this.authedPostNoContent(`/v1/conversations/${conversationId}/suggest-reply`);
  }

  async getReportsOverview(from: string, to: string): Promise<ReportsOverviewDto> {
    return this.authedGet<ReportsOverviewDto>(`/v1/reports/overview?from=${from}&to=${to}`);
  }

  async getAgentPerformance(from: string, to: string): Promise<AgentPerformanceDto[]> {
    return this.authedGet<AgentPerformanceDto[]>(`/v1/reports/agents?from=${from}&to=${to}`);
  }

  async downloadReportsCsv(from: string, to: string): Promise<void> {
    const response = await this.authedFetch(`/v1/reports/export?from=${from}&to=${to}`);
    if (!response.ok) {
      throw new Error('دریافت خروجی CSV با خطا مواجه شد');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gozaresh-amalkard.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  // ---- قوانین اتوماسیون (فاز ۶) ----

  async listAutomationRules(): Promise<AutomationRuleDto[]> {
    return this.authedGet<AutomationRuleDto[]>('/v1/automation-rules');
  }

  async createAutomationRule(dto: CreateAutomationRuleDto): Promise<AutomationRuleDto> {
    return this.authedPost<AutomationRuleDto>('/v1/automation-rules', dto);
  }

  async updateAutomationRule(id: string, dto: UpdateAutomationRuleDto): Promise<AutomationRuleDto> {
    return this.authedPatch<AutomationRuleDto>(`/v1/automation-rules/${id}`, dto);
  }

  async deleteAutomationRule(id: string): Promise<void> {
    await this.authedDelete(`/v1/automation-rules/${id}`);
  }

  // ---- یادداشت داخلی (فاز ۶) ----

  async listInternalNotes(conversationId: string): Promise<InternalNoteDto[]> {
    return this.authedGet<InternalNoteDto[]>(`/v1/conversations/${conversationId}/notes`);
  }

  async createInternalNote(conversationId: string, content: string): Promise<InternalNoteDto> {
    return this.authedPost<InternalNoteDto>(`/v1/conversations/${conversationId}/notes`, {
      content,
    });
  }

  // ---- وب‌هوک (فاز ۶) ----

  async listWebhooks(): Promise<WebhookDto[]> {
    return this.authedGet<WebhookDto[]>('/v1/webhooks');
  }

  async createWebhook(dto: CreateWebhookDto): Promise<WebhookDto> {
    return this.authedPost<WebhookDto>('/v1/webhooks', dto);
  }

  async updateWebhook(id: string, dto: UpdateWebhookDto): Promise<WebhookDto> {
    return this.authedPatch<WebhookDto>(`/v1/webhooks/${id}`, dto);
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.authedDelete(`/v1/webhooks/${id}`);
  }

  // ---- کلید API عمومی (فاز ۶) ----

  async getApiKeyStatus(): Promise<PublicApiKeyStatusDto> {
    return this.authedGet<PublicApiKeyStatusDto>('/v1/sites/me/api-key');
  }

  async generateApiKey(): Promise<GeneratedApiKeyDto> {
    return this.authedPost<GeneratedApiKeyDto>('/v1/sites/me/api-key');
  }

  async revokeApiKey(): Promise<void> {
    await this.authedDelete('/v1/sites/me/api-key');
  }

  // ---- احراز هویت دومرحله‌ای (فاز ۶) ----

  async verifyTwoFactorLogin(twoFactorToken: string, code: string): Promise<LoginResponseDto> {
    const response = await fetch(`${API_URL}/v1/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twoFactorToken, code }),
    });
    if (!response.ok) {
      throw new Error('کد تأیید نادرست است');
    }
    return response.json() as Promise<LoginResponseDto>;
  }

  async getTwoFactorStatus(): Promise<TwoFactorStatusDto> {
    return this.authedGet<TwoFactorStatusDto>('/v1/auth/2fa/status');
  }

  async startTwoFactorSetup(): Promise<TwoFactorSetupResponseDto> {
    return this.authedPost<TwoFactorSetupResponseDto>('/v1/auth/2fa/setup');
  }

  async confirmTwoFactorSetup(code: string): Promise<TwoFactorStatusDto> {
    return this.authedPost<TwoFactorStatusDto>('/v1/auth/2fa/confirm', { code });
  }

  async disableTwoFactor(code: string): Promise<TwoFactorStatusDto> {
    return this.authedPost<TwoFactorStatusDto>('/v1/auth/2fa/disable', { code });
  }

  // ---- مدیریت اپراتورها و پروفایل ----

  async listAgents(): Promise<AgentDto[]> {
    return this.authedGet<AgentDto[]>('/v1/agents');
  }

  async getMyProfile(): Promise<AgentProfileDto> {
    return this.authedGet<AgentProfileDto>('/v1/agents/me');
  }

  async getAgentProfile(id: string): Promise<AgentProfileDto> {
    return this.authedGet<AgentProfileDto>(`/v1/agents/${id}`);
  }

  async updateMyProfile(dto: UpdateMyProfileDto): Promise<AgentDto> {
    return this.authedPatch<AgentDto>('/v1/agents/me', dto);
  }

  async changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.authedPost('/v1/agents/me/password', { currentPassword, newPassword });
  }

  async createAgent(dto: CreateAgentDto): Promise<AgentDto> {
    return this.authedPost<AgentDto>('/v1/agents', dto);
  }

  async updateAgent(id: string, dto: UpdateAgentDto): Promise<AgentDto> {
    return this.authedPatch<AgentDto>(`/v1/agents/${id}`, dto);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.authedDelete(`/v1/agents/${id}`);
  }

  // ---- بازدیدکنندگان ----

  async getVisitorStats(): Promise<VisitorStatsDto> {
    return this.authedGet<VisitorStatsDto>('/v1/visitors/stats');
  }

  async listVisitors(
    params: { online?: boolean; search?: string } = {},
  ): Promise<VisitorListItemDto[]> {
    const query = new URLSearchParams();
    if (params.online) query.set('online', 'true');
    if (params.search) query.set('search', params.search);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.authedGet<VisitorListItemDto[]>(`/v1/visitors${suffix}`);
  }

  async getVisitorProfile(id: string): Promise<VisitorProfileDto> {
    return this.authedGet<VisitorProfileDto>(`/v1/visitors/${id}`);
  }

  async deleteVisitorData(id: string): Promise<void> {
    await this.authedDelete(`/v1/visitors/${id}`);
  }

  private async authedGet<T>(path: string): Promise<T> {
    const response = await this.authedFetch(path);
    if (!response.ok) {
      throw new ApiRequestError(
        `درخواست ${path} با خطا مواجه شد (${response.status})`,
        response.status,
      );
    }
    return response.json() as Promise<T>;
  }

  private async authedPost<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.authedFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private async authedPatch<T>(path: string, body: unknown): Promise<T> {
    const response = await this.authedFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private async authedPostNoContent(path: string): Promise<void> {
    const response = await this.authedFetch(path, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
  }

  private async authedDelete(path: string): Promise<void> {
    const response = await this.authedFetch(path, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
  }
}

export const apiClient = new ApiClient();
