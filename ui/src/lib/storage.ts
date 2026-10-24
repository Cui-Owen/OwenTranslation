import type { Config } from "./config";
import { background } from "./runtime";

/* Local data the settings page manages directly: config history and caches. */

const HISTORY = "userConfigHistory";
const PREFIX = "immersive-translate";

export async function configHistory(): Promise<Config[]> {
  const { [HISTORY]: list } = await chrome.storage.local.get(HISTORY);
  return Array.isArray(list) ? [...list].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)) : [];
}

/** Keeps the current overrides before an import or reset (newest ten). */
export async function backupConfig(raw: Config) {
  if (Object.keys(raw || {}).length <= 4) return;
  const snapshot = { ...structuredClone(raw), updatedAt: raw.updatedAt || new Date().toISOString() };
  const list = await configHistory();
  if (list.some((x) => x.updatedAt === snapshot.updatedAt)) return;
  await chrome.storage.local.set({ [HISTORY]: [snapshot, ...list].slice(0, 10) });
}

export async function deleteHistory(updatedAt: string) {
  const list = (await configHistory()).filter((x) => x.updatedAt !== updatedAt);
  await chrome.storage.local.set({ [HISTORY]: list });
}

function deleteDb(name: string) {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = () => resolve();
    setTimeout(resolve, 3000); // a connection held open elsewhere only delays it
  });
}

/** Translation caches: per-service tokens and every cache database. Glossaries are kept. */
export async function clearCaches() {
  await chrome.storage.local.remove(["bingGlobalConfig", "baiduGlobalConfig", "immersiveTranslateDeeplGlobalState", "immersiveTranslateGoogleAccessToken"]);
  const names = (await indexedDB.databases?.().catch(() => [])) || [];
  for (const { name } of names) if (name?.startsWith(`${PREFIX}-`) && name !== `${PREFIX}-cacheList`) await deleteDb(name);
  await deleteDb(`${PREFIX}-cacheList`);
}

export async function cacheSize(): Promise<number | null> {
  try {
    const n = await background<number | { size?: number }>("calculateSize");
    return typeof n === "number" ? n : (n?.size ?? null);
  } catch {
    return null;
  }
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function download(name: string, text: string, type = "application/json;charset=utf-8") {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
