import type {
  LoginRequestDto,
  LoginResponseDto,
  RefreshResponseDto,
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
} from '@mira/shared-types';
import { API_URL } from './config';

export interface ConversationDto {
  id: string;
  siteId: string;
  visitorId: string;
  assignedAgentId: string | null;
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
  status?: string;
  department?: string;
  search?: string;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  getAccessToken(): string | null {
    return this.accessToken;
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

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) return;
    const response = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
    if (!response.ok) {
      this.clearTokens();
      return;
    }
    const data = (await response.json()) as RefreshResponseDto;
    this.accessToken = data.accessToken;
  }

  async listConversations(params: ListConversationsParams = {}): Promise<ConversationDto[]> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.department) query.set('department', params.department);
    if (params.search) query.set('search', params.search);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.authedGet<ConversationDto[]>(`/v1/conversations${suffix}`);
  }

  async getMessages(conversationId: string): Promise<MessagePayload[]> {
    return this.authedGet<MessagePayload[]>(`/v1/conversations/${conversationId}/messages`);
  }

  async assignConversation(conversationId: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/conversations/${conversationId}/assign`);
  }

  async resolveConversation(conversationId: string): Promise<ConversationDto> {
    return this.authedPost<ConversationDto>(`/v1/conversations/${conversationId}/resolve`);
  }

  async markConversationRead(conversationId: string): Promise<void> {
    await this.authedPostNoContent(`/v1/conversations/${conversationId}/read`);
  }

  async updateConversation(
    conversationId: string,
    dto: { department?: string | null; tags?: string[] },
  ): Promise<ConversationDto> {
    return this.authedPatch<ConversationDto>(`/v1/conversations/${conversationId}`, dto);
  }

  async getVisitorInfo(conversationId: string): Promise<VisitorInfoDto> {
    return this.authedGet<VisitorInfoDto>(`/v1/conversations/${conversationId}/visitor-info`);
  }

  async getCustomerContext(conversationId: string): Promise<CustomerContextDto> {
    return this.authedGet<CustomerContextDto>(`/v1/conversations/${conversationId}/customer-context`);
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
    const response = await fetch(`${API_URL}/v1/reports/export?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
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
    return this.authedPost<InternalNoteDto>(`/v1/conversations/${conversationId}/notes`, { content });
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

  async listVisitors(params: { online?: boolean; search?: string } = {}): Promise<VisitorListItemDto[]> {
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
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private async authedPost<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private async authedPatch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private async authedPostNoContent(path: string): Promise<void> {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
  }

  private async authedDelete(path: string): Promise<void> {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`درخواست ${path} با خطا مواجه شد (${response.status})`);
    }
  }
}

export const apiClient = new ApiClient();
