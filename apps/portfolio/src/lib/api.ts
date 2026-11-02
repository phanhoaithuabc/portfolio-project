import type {
  PortfolioContent,
  PortfolioContactRecord,
  PortfolioProfile,
  PortfolioProject,
  PortfolioPage,
  PortfolioVersion,
} from "@portfolio/contracts";
export interface PublicPortfolio {
  profile: PortfolioProfile;
  projects: PortfolioProject[];
  pages: PortfolioPage[];
  projectLayout: "editorial" | "grid";
}
export interface AdminSession {
  authenticated: boolean;
  csrf: string;
  configured?: boolean;
  role?: "owner" | "editor" | null;
}
export interface PortfolioMediaFile {
  id: string;
  url: string;
  type: string;
  size: number;
  updatedAt: string;
}
export interface PortfolioAnalyticsRow {
  day: string;
  page: string;
  event: "view" | "outbound" | "contact";
  referrerHost: string;
  count: number;
}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request<Value>(
  path: string,
  options: RequestInit = {},
): Promise<Value> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(15000),
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new ApiError(
      body.message ?? "The request could not be completed.",
      response.status,
    );
  return body as Value;
}
export const api = {
  portfolio: (locale: "en" | "vi" = "en") =>
    request<PublicPortfolio>(`/api/portfolio?lang=${locale}`),
  session: () => request<AdminSession>("/api/admin/session"),
  login: (username: string, password: string, csrf: string) =>
    request<AdminSession>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: { "X-CSRF-Token": csrf },
    }),
  logout: (csrf: string) =>
    request("/api/admin/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
    }),
  content: () => request<PortfolioContent>("/api/admin/content"),
  save: (content: PortfolioContent, csrf: string) =>
    request<PortfolioContent>("/api/admin/content", {
      method: "PUT",
      headers: { "X-CSRF-Token": csrf },
      body: JSON.stringify(content),
    }),
  contact: (body: {
    name: string;
    email: string;
    subject: string;
    message: string;
    website: string;
  }) =>
    request<{ submitted: true }>("/api/contact", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  history: () => request<PortfolioVersion[]>("/api/admin/history"),
  restore: (targetRevision: number, expectedRevision: number, csrf: string) =>
    request<PortfolioContent>("/api/admin/restore", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
      body: JSON.stringify({ targetRevision, expectedRevision }),
    }),
  importContent: (content: PortfolioContent, csrf: string) =>
    request<PortfolioContent>("/api/admin/import", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
      body: JSON.stringify(content),
    }),
  exportContent: () => request<PortfolioContent>("/api/admin/export"),
  contacts: () =>
    request<PortfolioContactRecord[]>("/api/admin/contact-messages"),
  updateContact: (
    id: string,
    status: PortfolioContactRecord["status"],
    csrf: string,
  ) =>
    request<PortfolioContactRecord>(
      `/api/admin/contact-messages/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "X-CSRF-Token": csrf },
        body: JSON.stringify({ status }),
      },
    ),
  media: () => request<PortfolioMediaFile[]>("/api/admin/media"),
  uploadMedia: (file: File) => {
    const body = new FormData();
    body.set("image", file);
    return request<PortfolioMediaFile>("/api/admin/media", {
      method: "POST",
      body,
    });
  },
  deleteMedia: (id: string, csrf: string) =>
    request<void>(`/api/admin/media/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrf },
    }),
  analytics: () => request<PortfolioAnalyticsRow[]>("/api/admin/analytics"),
  projectPasswordStatus: (id: string) =>
    request<{ configured: boolean }>(
      `/api/admin/projects/${encodeURIComponent(id)}/password`,
    ),
  setProjectPassword: (id: string, password: string, csrf: string) =>
    request<void>(`/api/admin/projects/${encodeURIComponent(id)}/password`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrf },
      body: JSON.stringify({ password }),
    }),
  deleteProjectPassword: (id: string, csrf: string) =>
    request<void>(`/api/admin/projects/${encodeURIComponent(id)}/password`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrf },
    }),
  track: (event: {
    page: string;
    event: "view" | "outbound" | "contact";
    referrerHost: string;
  }) =>
    !analyticsOptedOut() &&
    fetch("/api/analytics", {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined),
};
export function analyticsOptedOut() {
  try {
    const privacyNavigator = navigator as Navigator & {
      globalPrivacyControl?: boolean;
    };
    return (
      localStorage.getItem("portfolio.analytics-opt-out") === "true" ||
      navigator.doNotTrack === "1" ||
      privacyNavigator.globalPrivacyControl === true
    );
  } catch {
    return true;
  }
}
