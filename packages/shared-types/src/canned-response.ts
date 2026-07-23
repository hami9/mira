export interface CannedResponseDto {
  id: string;
  siteId: string;
  shortcut: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCannedResponseDto {
  shortcut: string;
  title: string;
  content: string;
}

export interface UpdateCannedResponseDto {
  shortcut?: string;
  title?: string;
  content?: string;
}
