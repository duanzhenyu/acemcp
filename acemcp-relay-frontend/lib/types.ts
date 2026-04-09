export type UserStatus = "active" | "disabled";
export type StatsRangePreset = "today" | "7d" | "month" | "custom";

export interface CurrentUser {
  id: string;
  name: string;
  note: string | null;
  status: UserStatus;
  isAdmin: boolean;
  email: string | null;
  image: string | null;
  username: string | null;
  trustLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedUserListItem extends CurrentUser {
  maskedApiKey: string | null;
  hasApiKey: boolean;
  apiKeyCreatedAt: string | null;
  apiKeyUpdatedAt: string | null;
  contextEngineCount: number;
}

export interface ContextUsagePoint {
  date: string;
  count: number;
}

export interface ContextUsageStats {
  totalCount: number;
  startAt: string;
  endAt: string;
  series: ContextUsagePoint[];
}
