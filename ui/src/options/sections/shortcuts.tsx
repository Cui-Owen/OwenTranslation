import * as React from "react";
import { ExternalLinkIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { commandShortcuts, formatShortcut, openShortcutSettings } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { Card, Page, Row } from "../kit";

const BROWSER: { id: string; label: MessageKey }[] = [
  { id: "toggleTranslatePage", label: "shortcut.toggleTranslatePage" },
  { id: "toggleSidePanel", label: "shortcut.toggleSidePanel" },
];

// Listened for by the page itself; stored in config.shortcuts.
const PAGE: { id: string; label: MessageKey }[] = [
  { id: "toggleOnlyTransation", label: "shortcut.toggleOnlyTranslation" },
  { id: "toggleTranslateTheWholePage", label: "shortcut.wholePage" },
  { id: "toggleTranslateTheMainPage", label: "shortcut.mainPage" },
  { id: "toggleTranslateToThePageEndImmediately", label: "shortcut.toEnd" },
  { id: "toggleTranslationMask", label: "shortcut.mask" },
  { id: "translateInputBox", label: "shortcut.input" },
  { id: "toggleMouseHoverTranslateDirectly", label: "shortcut.hover" },
  { id: "toggleVideoSubtitlePreTranslation", label: "shortcut.subtitle" },
];

const MODIFIERS = ["Ctrl", "Command", "Alt", "Shift"];

function comboFrom(e: React.KeyboardEvent): string | null {
  const mods = [e.ctrlKey && "Ctrl", e.metaKey && "Command", e.altKey && "Alt", e.shiftKey && "Shift"].filter(Boolean) as string[];
  const code = e.code;
  let key = "";
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^F\d{1,2}$/.test(code)) key = code;
  else if (["Comma", "Period", "Slash", "Semicolon", "Quote", "BracketLeft", "BracketRight", "Backslash", "Minus", "Equal", "Backquote"].includes(code)) key = e.key.length === 1 ? e.key : code;
  else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Home", "End", "PageUp", "PageDown", "Insert"].includes(code)) key = code.replace("Arrow", "");
  if (!key || !mods.length) return null;
  return [...MODIFIERS.filter((m) => mods.includes(m)), key].join("+");
}

function Recorder({ value, onChange }: { value: string; onChange: (v: string) => unknown }) {
  const { t } = useI18n();
  const [recording, setRecording] = React.useState(false);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording) return;
          e.preventDefault();
          if (e.key === "Escape") return setRecording(false);
          if (e.key === "Backspace" || e.key === "Delete") {
            setRecording(false);
            return void onChange("");
          }
          if (MODIFIERS.some((m) => e.key === m || (m === "Command" && e.key === "Meta") || (m === "Ctrl" && e.key === "Control"))) return;
          const combo = comboFrom(e);
          if (!combo) return void toast.error(t("shortcut.invalid"));
          setRecording(false);
          void onChange(combo);
        }}
        className={cn(
          "inline-flex h-8 min-w-36 items-center justify-center gap-1 rounded-md border px-3 font-mono text-xs transition-colors outline-none",
          recording ? "border-ring bg-accent text-accent-foreground ring-2 ring-ring/20" : "bg-card hover:bg-muted",
        )}
      >
        {recording ? t("shortcut.recording") : value ? formatShortcut(value) : <span className="font-sans text-muted-foreground">{t("shortcut.none")}</span>}
      </button>
      {value && !recording && (
        <Button variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => void onChange("")}>
          <XIcon />
        </Button>
      )}
    </div>
  );
}

export function ShortcutsPage() {
  const config = useConfig();
  const { t } = useI18n();
  const [browserKeys, setBrowserKeys] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const load = () => void commandShortcuts().then(setBrowserKeys);
    load();
    addEventListener("focus", load);
    return () => removeEventListener("focus", load);
  }, []);
  const shortcuts: Config = config.shortcuts || {};

  const set = async (id: string, combo: string) => {
    if (combo) {
      const taken = [...PAGE.filter((p) => p.id !== id).map((p) => shortcuts[p.id]), ...Object.values(browserKeys)].some((s) => s && s.replace(/\s/g, "") === combo);
      if (taken) return void toast.error(t("shortcut.conflict"));
    }
    await updateConfig((raw: Config) => ({ ...raw, shortcuts: { ...raw.shortcuts, [id]: combo } }));
    toast.success(t("common.saved"));
  };

  return (
    <Page title={t("nav.shortcuts")} description={t("shortcut.description")}>
      <Card
        title={t("shortcut.browser")}
        description={t("shortcut.browserHint")}
        action={
          <Button variant="outline" size="sm" onClick={() => void openShortcutSettings()}>
            {t("shortcut.edit")}
            <ExternalLinkIcon />
          </Button>
        }
      >
        {BROWSER.map((c) => (
          <Row key={c.id} label={t(c.label)}>
            {browserKeys[c.id] ? <Kbd className="h-7 px-2 text-xs">{formatShortcut(browserKeys[c.id])}</Kbd> : <span className="text-[13px] text-muted-foreground">{t("shortcut.none")}</span>}
          </Row>
        ))}
      </Card>
      <Card title={t("shortcut.page")} description={t("shortcut.pageHint")}>
        {PAGE.map((c) => (
          <Row key={c.id} label={t(c.label)}>
            <Recorder value={String(shortcuts[c.id] || "")} onChange={(v) => set(c.id, v)} />
          </Row>
        ))}
      </Card>
    </Page>
  );
}
