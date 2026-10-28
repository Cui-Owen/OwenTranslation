// The engine's URL pattern rules: a bare host, an origin, or a glob with "*".
// Used only to show whether the current site is in a list; the engine applies them.

function glob(pattern: string): RegExp {
  return new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

export function matchesUrl(url: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === "*" || pattern === "<all_urls>") return true;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (pattern === u.hostname) return true;
  if (!pattern.includes("*") && pattern.includes("://")) {
    try {
      const p = new URL(pattern);
      if (p.pathname === "/" && !pattern.endsWith("/")) return p.hostname === u.hostname && (!p.port || p.port === u.port);
      return (u.origin + u.pathname).startsWith(p.origin + p.pathname);
    } catch {
      return false;
    }
  }
  const [scheme, rest] = pattern.includes("://") ? pattern.split("://", 2) : ["*", pattern];
  const slash = rest.indexOf("/");
  const host = slash < 0 ? rest : rest.slice(0, slash);
  const path = slash < 0 ? "/*" : rest.slice(slash);
  if (scheme !== "*" && scheme + ":" !== u.protocol) return false;
  const hostOk = host.startsWith("*.") ? u.hostname === host.slice(2) || u.hostname.endsWith(host.slice(1)) : glob(host).test(u.host);
  return hostOk && glob(path).test(u.pathname);
}

export function anyMatch(url: string, patterns: unknown): boolean {
  const list = Array.isArray(patterns) ? patterns : typeof patterns === "string" ? [patterns] : [];
  return list.some((p) => typeof p === "string" && matchesUrl(url, p));
}

export function withoutMatches(url: string, patterns: unknown): string[] {
  const list = Array.isArray(patterns) ? patterns : typeof patterns === "string" ? [patterns] : [];
  return list.filter((p) => !(typeof p === "string" && matchesUrl(url, p)));
}

/** Browser-owned sites reject content scripts even with <all_urls> access. */
export function browserRestricted(url?: string, userAgent = navigator.userAgent): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname;
    if (host === "chromewebstore.google.com" || (host === "chrome.google.com" && /^\/webstore(?:\/|$)/.test(u.pathname))) return true;
    if (host === "microsoftedge.microsoft.com" && /^\/addons(?:\/|$)/.test(u.pathname)) return true;
    if (!/Edg\//.test(userAgent)) return false;
    return ["copilot.microsoft.com", "edgeservices.bing.com", "explore.microsoft.com", "www.microsoft365.com", "rewards.bing.com"].includes(host)
      || host.endsWith(".cloud.microsoft");
  } catch {
    return false;
  }
}

export function translatable(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!["http:", "https:", "file:"].includes(u.protocol)) return false;
    return !browserRestricted(url);
  } catch {
    return false;
  }
}
