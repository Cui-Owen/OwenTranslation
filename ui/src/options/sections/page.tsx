import { PlusIcon, XIcon } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { generalRule, updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { languageName } from "@/lib/languages";
import { Card, NumberRow, Page, PatternList, Row, SelectRow, SwitchRow, asList } from "../kit";

function urlPattern(key: "matches" | "excludeMatches", items: string[]) {
  return (raw: Config): Config => {
    const other = key === "matches" ? "excludeMatches" : "matches";
    const p: Config = { matches: [], excludeMatches: [], ...raw.translationUrlPattern };
    return {
      ...raw,
      isChangedAlwaysTranslatedUrls: true,
      translationUrlPattern: { ...p, [key]: items, [other]: asList(p[other]).filter((x) => !items.includes(x)) },
    };
  };
}

function LanguageTags({ items, onChange, exclude = [] }: { items: string[]; onChange: (items: string[]) => unknown; exclude?: string[] }) {
  const { t, lang } = useI18n();
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      {items.map((code) => (
        <span key={code} className="inline-flex items-center gap-1 rounded-md border bg-muted/60 py-0.5 pr-1 pl-2 text-xs">
          {languageName(code, lang)}
          <button type="button" aria-label={t("common.remove")} className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground" onClick={() => void onChange(items.filter((c) => c !== code))}>
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <LanguagePicker
        size="sm"
        className="h-7 w-auto text-xs text-muted-foreground"
        value=""
        placeholder={
          <>
            <PlusIcon className="size-3.5" />
            {t("common.add")}
          </>
        }
        onChange={(code) => !items.includes(code) && !exclude.includes(code) && void onChange([...items, code])}
        aria-label={t("common.add")}
      />
    </div>
  );
}

export function PagePage() {
  const config = useConfig();
  const { t } = useI18n();
  const rule: Config = config.generalRule || {};
  const pattern: Config = config.translationUrlPattern || {};
  const langPattern: Config = config.translationLanguagePattern || {};
  // In bilingual mode the lists name pages shown as translation only, and vice versa.
  const modeKey = (config.translationMode || "dual") === "dual" ? "translationMatches" : "dualMatches";
  const otherModeKey = modeKey === "translationMatches" ? "dualMatches" : "translationMatches";

  const setLangPattern = (key: "matches" | "excludeMatches", items: string[]) =>
    updateConfig((raw: Config) => {
      const p: Config = { matches: [], excludeMatches: [], ...raw.translationLanguagePattern };
      const other = key === "matches" ? "excludeMatches" : "matches";
      return { ...raw, translationLanguagePattern: { ...p, [key]: items, [other]: asList(p[other]).filter((x) => !items.includes(x)) } };
    });

  return (
    <Page title={t("nav.page")} description={t("page.description")}>
      <Card title={t("page.sites")} description={t("page.sitesHint")}>
        <Row label={t("page.alwaysSites")} description={t("page.alwaysSitesHint")} stack>
          <PatternList items={asList(pattern.matches)} onChange={(items) => updateConfig(urlPattern("matches", items))} />
        </Row>
        <Row label={t("page.neverSites")} description={t("page.neverSitesHint")} stack>
          <PatternList items={asList(pattern.excludeMatches)} onChange={(items) => updateConfig(urlPattern("excludeMatches", items))} />
        </Row>
        <Row label={t("page.alwaysLangs")} description={t("page.alwaysLangsHint")} stack>
          <LanguageTags items={asList(langPattern.matches)} onChange={(items) => setLangPattern("matches", items)} />
        </Row>
        <Row label={t("page.neverLangs")} description={t("page.neverLangsHint")} stack>
          <LanguageTags items={asList(langPattern.excludeMatches)} onChange={(items) => setLangPattern("excludeMatches", items)} />
        </Row>
        <SelectRow
          label={t("page.tempSite")}
          description={t("page.tempSiteHint")}
          value={String(config.tempTranslateDomainMinutes ?? 0)}
          options={[0, 5, 10, 15, 30, 60].map((m) => ({ value: String(m), label: m ? t("common.minutes", { n: m }) : t("common.off") }))}
          onChange={(v) => updateConfig({ tempTranslateDomainMinutes: Number(v) })}
        />
        <SwitchRow label={t("page.siteAuto")} description={t("page.siteAutoHint")} checked={!!rule.enableSiteAutoTranslate} onChange={(v) => updateConfig(generalRule({ enableSiteAutoTranslate: v }))} />
      </Card>

      <Card title={t("page.scope")}>
        <SwitchRow label={t("page.wholePage")} description={t("page.wholePageHint")} checked={config.translationArea === "body"} onChange={(v) => updateConfig({ translationArea: v ? "body" : "main" })} />
        {config.translationArea !== "body" && (
          <SwitchRow
            label={t("page.sideNav")}
            description={t("page.sideNavHint")}
            checked={!!rule.preTranslateLimiter?.["side.enableTranslate"]}
            onChange={(v) => updateConfig((raw: Config) => ({ ...raw, generalRule: { ...raw.generalRule, "preTranslateLimiter.add": { ...raw.generalRule?.["preTranslateLimiter.add"], "side.enableTranslate": v } } }))}
          />
        )}
        <SwitchRow label={t("page.title")} description={t("page.titleHint")} checked={!!rule.isTranslateTitle} onChange={(v) => updateConfig(generalRule({ isTranslateTitle: v }))} />
        <SwitchRow label={t("page.toEnd")} description={t("page.toEndHint")} checked={config.translationStartMode === "immediate"} onChange={(v) => updateConfig({ translationStartMode: v ? "immediate" : "dynamic" })} />
        <NumberRow label={t("page.firstChars")} description={t("page.firstCharsHint")} value={config.immediateTranslationTextCount} min={0} onCommit={(n) => updateConfig({ immediateTranslationTextCount: n })} />
        <NumberRow
          label={t("page.minChars")}
          description={t("page.minCharsHint")}
          value={rule.paragraphMinTextCount}
          min={0}
          onCommit={(n) =>
            updateConfig(generalRule(n === 0 ? { paragraphMinTextCount: 1, paragraphMinWordCount: 1 } : { paragraphMinTextCount: n, paragraphMinWordCount: Math.max(2, Math.floor(n / 2)) }))
          }
        />
      </Card>

      <Card title={t("page.display")}>
        <SwitchRow label={t("page.before")} description={t("page.beforeHint")} checked={config.translationPosition === "before"} onChange={(v) => updateConfig({ translationPosition: v ? "before" : "after" })} />
        <Row label={modeKey === "translationMatches" ? t("page.onlyTranslationSites") : t("page.dualSites")} description={t("page.modeSitesHint")} stack>
          <PatternList
            items={asList(config.translationModeUrlPattern?.[modeKey])}
            onChange={(items) =>
              updateConfig((raw: Config) => {
                const p: Config = { ...raw.translationModeUrlPattern };
                return { ...raw, isChangedAlwaysTranslatedUrls: true, translationModeUrlPattern: { ...p, [modeKey]: items, [otherModeKey]: asList(p[otherModeKey]).filter((x) => !items.includes(x)) } };
              })
            }
          />
        </Row>
        <Row label={modeKey === "translationMatches" ? t("page.onlyTranslationLangs") : t("page.dualLangs")} description={t("page.modeLangsHint")} stack>
          <LanguageTags
            items={asList(config.translationModeLanguagePattern?.[modeKey])}
            onChange={(items) =>
              updateConfig((raw: Config) => {
                const p: Config = { ...raw.translationModeLanguagePattern };
                return { ...raw, isChangedAlwaysTranslatedUrls: true, translationModeLanguagePattern: { ...p, [modeKey]: items, [otherModeKey]: asList(p[otherModeKey]).filter((x) => !items.includes(x)) } };
              })
            }
          />
        </Row>
        <SelectRow
          label={t("page.lineBreak")}
          description={t("page.lineBreakHint")}
          value={(rule.blockMinTextCount ?? 1) > 0 ? "smart" : "always"}
          options={[
            { value: "smart", label: t("page.lineBreakSmart") },
            { value: "always", label: t("page.lineBreakAlways") },
          ]}
          onChange={(v) =>
            updateConfig((raw: Config) => {
              const g: Config = { ...raw.generalRule };
              if (v === "always") Object.assign(g, { blockMinTextCount: 0, blockMinWordCount: 0 });
              else {
                delete g.blockMinTextCount;
                delete g.blockMinWordCount;
              }
              return { ...raw, generalRule: g };
            })
          }
        />
        <SwitchRow label={t("page.splitLong")} description={t("page.splitLongHint")} checked={(rule.lineBreakMaxTextCount ?? 0) > 0} onChange={(v) => updateConfig(generalRule({ lineBreakMaxTextCount: v ? 280 : 0 }))} />
        {(rule.lineBreakMaxTextCount ?? 0) > 0 && <NumberRow label={t("page.splitLongCount")} value={rule.lineBreakMaxTextCount} min={20} onCommit={(n) => updateConfig(generalRule({ lineBreakMaxTextCount: n }))} />}
        <SelectRow
          label={t("page.loading")}
          description={t("page.loadingHint")}
          value={config.loadingTheme || "spinner"}
          options={[
            { value: "spinner", label: t("page.loadingSpinner") },
            { value: "text", label: t("page.loadingText") },
            { value: "none", label: t("page.loadingNone") },
          ]}
          onChange={(v) => updateConfig({ loadingTheme: v })}
        />
      </Card>

      <Card title={t("page.other")}>
        <SwitchRow label={t("page.sameLang")} description={t("page.sameLangHint")} checked={!!config.sameLangCheck} onChange={(v) => updateConfig({ sameLangCheck: v })} />
        <SwitchRow
          label={t("page.contextMenu")}
          description={t("page.contextMenuHint")}
          checked={config.isShowContextMenu === true}
          onChange={async (v) => {
            await updateConfig({ isShowContextMenu: v });
            await chrome.contextMenus.update("toggleTranslatePage", { visible: v }).catch(() => {});
          }}
        />
      </Card>
    </Page>
  );
}
