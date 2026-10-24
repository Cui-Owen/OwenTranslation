// Messaging with the existing extension runtime. The background service worker
// listens as "background:main" and every page frame's content script as
// "content:main"; both answer with {ok, data} or {ok:false, ...error}.

type Reply = { ok: boolean; data?: unknown; message?: string; errorDetails?: string };

const FROM = location.pathname.includes("popup") ? "popup:owen" : "options:owen";

function unwrap<T>(reply: Reply | undefined): T {
  if (!reply) throw new Error("No response");
  if (!reply.ok) throw new Error(reply.message || reply.errorDetails || "Request failed");
  return reply.data as T;
}

export async function background<T = unknown>(method: string, data?: unknown): Promise<T> {
  const reply = (await chrome.runtime.sendMessage({ to: "background:main", from: FROM, payload: { method, data } })) as Reply;
  return unwrap<T>(reply);
}

/**
 * Sends to the page's content scripts. "main" runs page commands in every
 * frame; "popup_res" (main frame only) answers page status and language.
 */
export async function content<T = unknown>(
  tabId: number,
  method: string,
  data?: unknown,
  { channel = "main", topFrame = channel === "popup_res" }: { channel?: "main" | "popup_res"; topFrame?: boolean } = {},
): Promise<T> {
  const message = { to: `content:${channel}:${tabId}`, from: FROM, payload: { method, data } };
  const reply = (await (topFrame
    ? chrome.tabs.sendMessage(tabId, message, { frameId: 0 })
    : chrome.tabs.sendMessage(tabId, message))) as Reply;
  return unwrap<T>(reply);
}

/** The page the popup acts on. `?tabId=` targets another tab (used by the browser tests). */
export async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const forced = Number(new URLSearchParams(location.search).get("tabId"));
  if (forced) return chrome.tabs.get(forced).catch(() => undefined);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function openOptions(route = "") {
  const url = chrome.runtime.getURL("options.html") + (route ? `#${route}` : "");
  return chrome.tabs.create({ url });
}

export function extensionVersion() {
  const m = chrome.runtime.getManifest();
  return (m as { version_name?: string }).version_name || m.version;
}
