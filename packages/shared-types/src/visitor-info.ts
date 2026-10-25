export interface PageViewDto {
  url: string;
  title: string | null;
  visitedAt: string;
}

export interface VisitorInfoDto {
  isOnline: boolean;
  currentPage: PageViewDto | null;
  entryPage: { url: string; title: string | null } | null;
  id: string;
  name: string | null;
  email: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  pages: PageViewDto[];
}

export interface ReportPageViewDto {
  url: string;
  title?: string;
}
