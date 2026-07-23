export interface PageViewDto {
  url: string;
  title: string | null;
  visitedAt: string;
}

export interface VisitorInfoDto {
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
