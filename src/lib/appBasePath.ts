export function normalizeAppBaseUrl(baseUrl: string) {
  const trimmed = String(baseUrl || "/").trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/gu, "")}/`;
}

export function appUrl(path: string, baseUrl = import.meta.env.BASE_URL) {
  const rawPath = String(path || "");
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(rawPath)) return rawPath;

  const normalizedBase = normalizeAppBaseUrl(baseUrl);
  return `${normalizedBase}${rawPath.replace(/^\/+/, "")}`;
}

export const APP_BASE_URL = normalizeAppBaseUrl(import.meta.env.BASE_URL);
// Keep root links canonical so Home can be refreshed under a hosted base path.
export const APP_ROUTER_BASENAME = APP_BASE_URL;
