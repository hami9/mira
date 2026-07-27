import type { AgentPermissionMap } from './permissions';

export interface AgentDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  permissions: AgentPermissionMap;
  twoFactorEnabled: boolean;
  createdAt: string;
}

// آمار عملکرد که در صفحه‌ی پروفایل اپراتور نمایش داده می‌شود
export interface AgentProfileDto extends AgentDto {
  totalConversations: number;
  resolvedConversations: number;
  avgCsatScore: number | null;
}

export interface CreateAgentDto {
  email: string;
  fullName: string;
  password: string;
  role: 'admin' | 'agent';
  phone?: string | null;
  permissions?: AgentPermissionMap;
}

export interface UpdateAgentDto {
  fullName?: string;
  role?: 'admin' | 'agent';
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  permissions?: AgentPermissionMap;
  // فقط ادمین می‌تواند برای دیگری ست کند؛ اپراتور برای خودش با رمز فعلی
  password?: string;
}

// ویرایش پروفایل خودِ اپراتور (بدون role/permissions که فقط دست ادمین است)
export interface UpdateMyProfileDto {
  fullName?: string;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
