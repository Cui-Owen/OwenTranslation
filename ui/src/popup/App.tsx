import * as React from "react";
import {
  ArrowRightIcon,
  BookOpenTextIcon,
  CaptionsIcon,
  ColumnsIcon,
  GlobeIcon,
  KeyboardIcon,
  Loader2Icon,
  MousePointer2Icon,
  PanelRightIcon,
  RotateCcwIcon,
  Settings2Icon,
  TextCursorInputIcon,
  TextSelectIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LanguagePicker } from "@/components/language-picker";
import { ServicePicker } from "@/components/service-picker";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { generalRule, ruleAdd, updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { languageName } from "@/lib/languages";
import { activeTab, background, content, extensionVersion, openOptions } from "@/lib/runtime";
import { selectServicePatch } from "@/lib/services";
import { commandShortcuts, formatShortcut } from "@/lib/shortcuts";
import { anyMatch, browserRestricted, translatable, withoutMatches } from "@/lib/url-match";
import { cn } from "@/lib/utils";

type PageStatus = "Original" | "Translating" | "Translated" | "Error";
type Reach = "checking" | "ready" | "unsupported" | "restricted" | "unreachable";

const HOVER_KEYS = ["Ctrl", "Alt", "Shift", "MouseHoldKeyPressHold", "Auto"] as const;
const HOVER_LABEL: Record<string, MessageKey> = {
  Ctrl: "hover.ctrl",
  Alt: "hover.alt",
  Shift: "hover.shift",
  MouseHoldKeyPressHold: "hover.longPress",
  Auto: "hover.auto",
};

function usePage(tab: chrome.tabs.Tab | undefined) {
  const [reach, setReach] = React.useState<Reach>("checking");
  const [status, setStatus] = React.useState<PageStatus>("Original");
  const [pageLang, setPageLang] = React.useState<string>("");

  React.useEffect(() => {
    if (!tab?.id) return;
    if (browserRestricted(tab.url)) {
      setReach("restricted");
      return;
    }
    if (!translatable(tab.url)) {
      setReach("unsupported");
      return;
    }
    const id = tab.id;
    let alive = true;
    const poll = async () => {
      try {
        const s = await content<PageStatus>(id, "getPageStatus", undefined, { channel: "popup_res" });
        if (!alive) return;
        setStatus(s || "Original");
        setReach("ready");
      } catch {
        if (alive) setReach((r) => (r === "ready" ? r : "unreachable"));
      }
    };
    void poll();
    content<string>(id, "getCurrentPageLanguage", undefined, { channel: "popup_res" })
      .then((l) => alive && setPageLang(l || ""))
      .catch(() => {});
    const timer = setInterval(poll, 700);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tab?.id, tab?.url]);

  return { reach, status, setStatus, pageLang, setPageLang };
}

export function App() {
  const config = useConfig();
  const { t, lang } = useI18n();
  const [tab, setTab] = React.useState<chrome.tabs.Tab>();
  const [keys, setKeys] = React.useState<Record<string, string>>({});
  const page = usePage(tab);

  React.useEffect(() => {
    void activeTab().then(setTab);
    void commandShortcuts().then(setKeys);
  }, []);

  const url = tab?.url || "";
  const host = React.useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }, [url]);
  const ready = page.reach === "ready";
  const translated = page.status === "Translated";
  const busy = page.status === "Translating";

  const send = (method: string, data?: unknown) => (tab?.id ? content(tab.id, method, data).catch(() => {}) : Promise.resolve());

  const togglePage = async () => {
    if (!tab?.id) return;
    page.setStatus(translated || busy ? "Original" : "Translating");
    await send("toggleTranslatePage", { trigger: "popup", startedAt: Date.now(), currentPageStatus: page.status });
    setTimeout(() => window.close(), 150);
  };

  const setTarget = async (code: string) => {
    await updateConfig({ targetLanguage: code });
    await send("updateTargetLanguage", { targetLanguage: code, trigger: "popup", hasPageTranslationStarted: page.status !== "Original" });
    if (translated) await send("translatePage", { trigger: "popup" });
  };

  const sourceLang = React.useMemo(() => {
    const rules: Config = config.sourceLanguageUrlPattern || {};
    return Object.keys(rules).find((code) => anyMatch(url, rules[code]?.matches)) || "auto";
  }, [config.sourceLanguageUrlPattern, url]);

  const setSource = async (code: string) => {
    if (!tab?.id || !url) return;
    await updateConfig((raw) => {
      const rules: Config = structuredClone(raw.sourceLanguageUrlPattern || {});
      for (const k of Object.keys(rules)) rules[k] = { ...rules[k], matches: withoutMatches(url, rules[k]?.matches) };
      if (code !== "auto") rules[code] = { excludeMatches: [], ...rules[code], matches: [...(rules[code]?.matches || []), host] };
      return { ...raw, sourceLanguageUrlPattern: rules };
    });
    await content(tab.id, "setCurrentPageLanguageByClient", code, { channel: "popup_res" }).catch(() => {});
    page.setPageLang(code === "auto" ? page.pageLang : code);
  };

  const setService = async (id: string) => {
    await updateConfig(selectServicePatch(config, "translationService", id));
    await send("updateTranslationService", { translationService: id });
    if (translated) await send(config.generalRule?.isTranslateWhenServiceChanged === false ? "restorePage" : "translatePage", { trigger: "popup" });
  };

  const mode: string = config.translationMode || "dual";
  const setMode = async (m: string) => {
    if (!m || m === mode) return;
    await updateConfig({ translationMode: m });
    if (page.status !== "Original") await send("switchTranslationMode", { mode: m, trigger: "popup" });
  };

  // Site rule: always / never translate this host, or follow the defaults.
  const pattern: Config = config.translationUrlPattern || {};
  const siteRule = anyMatch(url, pattern.matches) ? "always" : anyMatch(url, pattern.excludeMatches) ? "never" : "default";
  const setSiteRule = async (rule: string) => {
    if (!host) return;
    await updateConfig((raw) => {
      const p: Config = { ...raw.translationUrlPattern };
      const matches = withoutMatches(url, p.matches);
      const excludes = withoutMatches(url, p.excludeMatches);
      return {
        ...raw,
        isChangedAlwaysTranslatedUrls: true,
        translationUrlPattern: {
          ...p,
          matches: rule === "always" ? [...new Set([...matches, host])] : matches,
          excludeMatches: rule === "never" ? [...new Set([...excludes, host])] : excludes,
        },
      };
    });
    if (rule === "default") {
      const local = await background<Config>("getLocalConfig").catch(() => null);
      const temp: Config[] = local?.tempTranslationUrlMatches || [];
      if (local && temp.some((m) => m.match === host))
        await background("setLocalConfig", { ...local, tempTranslationUrlMatches: temp.filter((m) => m.match !== host) });
    }
    if (rule === "always" && page.status === "Original") await send("translatePage", { trigger: "popup" });
    if (rule === "never" && translated) await send("restorePage");
  };

  const openSidePanel = async () => {
    try {
      if (tab?.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch {
      await background("toggleSidePanel", { open: true, source: "popup", windowId: tab?.windowId }).catch(() => {});
    }
    window.close();
  };

  const rule = config.generalRule || {};
  const hoverKey: string = rule.mouseHoverHoldKey || "Off";
  const hoverPref: string = HOVER_KEYS.includes(rule.mouseHoverPreferenceKey) ? rule.mouseHoverPreferenceKey : "Ctrl";
  const toggleShortcut = formatShortcut(keys.toggleTranslatePage ?? "");
  const panelShortcut = formatShortcut(keys.toggleSidePanel ?? "");

  const autoLabel = page.pageLang && page.pageLang !== "auto" ? t("lang.autoDetected", { name: languageName(page.pageLang, lang) }) : undefined;

  return (
    <div className="flex flex-col">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <BrandMark active={translated} className="size-[22px]" />
        <span className="font-serif text-[15px] font-black tracking-wider">{t("app.name")}</span>
        <span className="flex-1" />
        <IconButton label={`${t("popup.sidePanel")} ${panelShortcut}`.trim()} onClick={openSidePanel}>
          <PanelRightIcon />
        </IconButton>
        <IconButton label={t("popup.settings")} onClick={() => void openOptions().then(() => window.close())}>
          <Settings2Icon />
        </IconButton>
      </header>

      <section className="flex flex-col gap-3 p-4">
        <PageLine host={host} reach={page.reach} status={page.status} />

        <Button size="lg" className="w-full" disabled={!ready} onClick={togglePage}>
          {busy ? <Loader2Icon className="animate-spin" /> : translated ? <RotateCcwIcon /> : <BookOpenTextIcon />}
          {translated || busy ? t("popup.restore") : t("popup.translate")}
          {toggleShortcut && <Kbd className="ml-1 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/70">{toggleShortcut}</Kbd>}
        </Button>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <LanguagePicker
            aria-label={t("popup.sourceLanguage")}
            value={sourceLang}
            onChange={setSource}
            allowAuto
            autoLabel={autoLabel}
            size="sm"
          />
          <ArrowRightIcon className="size-3.5 text-muted-foreground" />
          <LanguagePicker
            aria-label={t("popup.targetLanguage")}
            value={config.targetLanguage}
            onChange={setTarget}
            pinned={[config.targetLanguage, config.interfaceLanguage, "en"]}
            size="sm"
          />
        </div>

        <ServicePicker
          aria-label={t("popup.service")}
          config={config}
          value={config.translationService}
          onChange={setService}
          onManage={() => void openOptions("services").then(() => window.close())}
          size="sm"
        />

        <ToggleGroup type="single" value={mode} onValueChange={setMode} className="w-full" aria-label={t("popup.displayMode")}>
          <ToggleGroupItem value="dual">
            <ColumnsIcon />
            {t("mode.dual")}
          </ToggleGroupItem>
          <ToggleGroupItem value="translation">
            <TextSelectIcon />
            {t("mode.translation")}
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      {host && page.reach !== "unsupported" && (
        <section className="border-t px-4 py-3">
          <div className="flex items-center gap-3">
            <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[13px]" title={host}>
              {t("popup.thisSite")}
            </span>
            <Select value={siteRule} onValueChange={setSiteRule}>
              <SelectTrigger size="sm" className="min-w-0 text-[13px]" aria-label={t("popup.thisSite")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="default">{t("site.default")}</SelectItem>
                <SelectItem value="always">{t("site.always")}</SelectItem>
                <SelectItem value="never">{t("site.never")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

      <section className="flex flex-col border-t px-4 py-2">
        <FeatureRow
          icon={<CaptionsIcon />}
          title={t("feature.subtitles")}
          hint={t("feature.subtitlesHint")}
          checked={!!rule.subtitleRule?.autoEnableSubtitle}
          onChange={async (v) => {
            await updateConfig(ruleAdd("subtitleRule", { autoEnableSubtitle: v }));
            await send("autoEnableSubtitleChanged", {});
          }}
        />
        <FeatureRow
          icon={<MousePointer2Icon />}
          title={t("feature.hover")}
          hint={hoverKey === "Off" ? t("feature.hoverHint") : t(HOVER_LABEL[hoverKey] || "hover.ctrl")}
          checked={hoverKey !== "Off"}
          onChange={(v) => updateConfig(generalRule({ mouseHoverHoldKey: v ? hoverPref : "Off", mouseHoverPreferenceKey: hoverPref }))}
          extra={
            hoverKey !== "Off" && (
              <Select value={HOVER_KEYS.includes(hoverKey as never) ? hoverKey : hoverPref} onValueChange={(k) => updateConfig(generalRule({ mouseHoverHoldKey: k, mouseHoverPreferenceKey: k }))}>
                <SelectTrigger size="sm" className="h-7 min-w-0 px-2 text-xs" aria-label={t("feature.hoverKey")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {HOVER_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(HOVER_LABEL[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
        />
        <FeatureRow
          icon={<TextCursorInputIcon />}
          title={t("feature.selection")}
          hint={t("feature.selectionHint")}
          checked={!!rule.selectionTranslation?.enable}
          onChange={(v) => updateConfig(ruleAdd("selectionTranslation", { enable: v }))}
        />
        <FeatureRow
          icon={<KeyboardIcon />}
          title={t("feature.input")}
          hint={t("feature.inputHint", { n: config.inputTrailingTriggerKeyRepeatTimes ?? 3 })}
          checked={!!config.enableInputTranslation}
          onChange={(v) => updateConfig({ enableInputTranslation: v, enableInputTranslationWithoutTriggerKey: v })}
        />
      </section>

      <footer className="flex h-9 items-center justify-between border-t bg-muted/50 px-4 text-[11px] text-muted-foreground">
        <button type="button" className="hover:text-foreground" onClick={() => void openOptions("shortcuts").then(() => window.close())}>
          {t("popup.shortcuts")}
        </button>
        <span className="font-mono">{extensionVersion()}</span>
      </footer>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="text-muted-foreground hover:text-foreground">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function PageLine({ host, reach, status }: { host: string; reach: Reach; status: PageStatus }) {
  const { t } = useI18n();
  const state =
    reach === "restricted"
      ? { text: t("page.restricted"), tone: "muted" }
      : reach === "unsupported"
      ? { text: t("page.unsupported"), tone: "muted" }
      : reach === "unreachable"
        ? { text: t("page.reload"), tone: "warn" }
        : reach === "checking"
          ? { text: "…", tone: "muted" }
          : status === "Translated"
            ? { text: t("page.translated"), tone: "on" }
            : status === "Translating"
              ? { text: t("page.translating"), tone: "on" }
              : status === "Error"
                ? { text: t("page.error"), tone: "warn" }
                : { text: t("page.original"), tone: "muted" };
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="min-w-0 flex-1 truncate font-medium" title={host}>
        {host || t("page.noPage")}
      </span>
      <span
        role="status"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 text-xs",
          state.tone === "on" ? "text-vermilion" : state.tone === "warn" ? "text-ochre" : "text-muted-foreground",
        )}
      >
        <span className={cn("size-1.5 rounded-full", state.tone === "on" ? "bg-vermilion" : state.tone === "warn" ? "bg-ochre" : "bg-muted-foreground/50")} />
        {state.text}
      </span>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  hint,
  checked,
  onChange,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => unknown;
  extra?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="flex min-h-12 items-center gap-3 py-1.5">
      <span className={cn("shrink-0 [&_svg]:size-[18px]", checked ? "text-foreground" : "text-muted-foreground")}>{icon}</span>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[13px] font-medium leading-tight">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </label>
      {extra}
      <Switch id={id} checked={checked} onCheckedChange={(v) => void onChange(v)} />
    </div>
  );
}
