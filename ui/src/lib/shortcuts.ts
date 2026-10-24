// Browser-managed command shortcuts, as the user configured them in edge://extensions/shortcuts.
export async function commandShortcuts(): Promise<Record<string, string>> {
  try {
    const list = await chrome.commands.getAll();
    return Object.fromEntries(list.filter((c) => c.name).map((c) => [c.name!, c.shortcut || ""]));
  } catch {
    return {};
  }
}

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

export function formatShortcut(s: string): string {
  if (!s) return "";
  if (!MAC) return s;
  return s
    .replace(/Alt\+?/g, "⌥")
    .replace(/Ctrl\+?|MacCtrl\+?/g, "⌃")
    .replace(/Command\+?|Cmd\+?|Meta\+?/g, "⌘")
    .replace(/Shift\+?/g, "⇧");
}

export function openShortcutSettings() {
  const edge = navigator.userAgent.includes("Edg/");
  return chrome.tabs.create({ url: edge ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts" });
}
