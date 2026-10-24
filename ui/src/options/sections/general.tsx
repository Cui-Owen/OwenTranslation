import * as React from "react";
import { ColumnsIcon, TextSelectIcon } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { ServicePicker } from "@/components/service-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { selectServicePatch } from "@/lib/services";
import { navigate } from "../App";
import { Card, Page, PatternList, Row, SwitchRow, asList } from "../kit";

export const THEMES: { id: string; label: MessageKey }[] = [
  { id: "none", label: "theme.none" },
  { id: "underline", label: "theme.underline" },
  { id: "dashed", label: "theme.dashed" },
  { id: "dotted", label: "theme.dotted" },
  { id: "thinDashed", label: "theme.thinDashed" },
  { id: "wavy", label: "theme.wavy" },
  { id: "highlight", label: "theme.highlight" },
  { id: "marker", label: "theme.marker" },
  { id: "marker2", label: "theme.marker2" },
  { id: "background", label: "theme.background" },
  { id: "weakening", label: "theme.weakening" },
  { id: "grey", label: "theme.grey" },
  { id: "italic", label: "theme.italic" },
  { id: "bold", label: "theme.bold" },
  { id: "opacity", label: "theme.opacity" },
  { id: "mask", label: "theme.mask" },
  { id: "paper", label: "theme.paper" },
  { id: "blockquote", label: "theme.blockquote" },
  { id: "dividingLine", label: "theme.dividingLine" },
  { id: "solidBorder", label: "theme.solidBorder" },
  { id: "dashedBorder", label: "theme.dashedBorder" },
];

const PREFIX = "immersive-translate";
// The page wraps translations in <Font>; the preview uses the same element so the same CSS applies.
const Font = "font" as unknown as "span";

// The page's own stylesheet, so the preview shows exactly what pages show.
function useInjectedStyles() {
  React.useEffect(() => {
    if (document.getElementById("owen-inject-css")) return;
    const link = document.createElement("link");
    link.id = "owen-inject-css";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("styles/inject.css");
    document.head.append(link);
  }, []);
}

function ThemePreview({ theme, mode }: { theme: string; mode: string }) {
  const { t } = useI18n();
  useInjectedStyles();
  const themed = theme && theme !== "none";
  return (
    <div className="rounded-lg border bg-background/60 px-4 py-3 text-[15px] leading-relaxed" {...{ "imt-state": "dual", "imt-trans-position": "after" }}>
      {mode !== "translation" && <p>{t("theme.sampleSource")}</p>}
      <Font
        className={[
          "notranslate",
          themed && `${PREFIX}-target-translation-theme-${theme}`,
          themed && `${PREFIX}-target-translation-block-wrapper-theme-${theme}`,
          `${PREFIX}-target-translation-block-wrapper`,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ display: "block", marginTop: mode === "translation" ? 0 : 8 }}
      >
        <Font className={["notranslate", `${PREFIX}-target-inner`, themed && `${PREFIX}-target-translation-theme-${theme}-inner`].filter(Boolean).join(" ")}>
          {t("theme.sampleTarget")}
        </Font>
      </Font>
    </div>
  );
}

export function GeneralPage() {
  const config = useConfig();
  const { t } = useI18n();
  const theme: string = config.translationTheme || "none";
  const mode: string = config.translationMode || "dual";
  const themeSites = asList(config.translationThemePatterns?.[theme]?.matches);

  return (
    <Page title={t("nav.general")} description={t("general.description")}>
      <Card title={t("general.translation")}>
        <Row label={t("general.target")} description={t("general.targetHint")}>
          <LanguagePicker className="w-48" value={config.targetLanguage} onChange={(code) => updateConfig({ targetLanguage: code })} pinned={[config.interfaceLanguage, "en"]} aria-label={t("general.target")} />
        </Row>
        <Row label={t("general.service")} description={t("general.serviceHint")}>
          <ServicePicker
            className="w-56"
            config={config}
            value={config.translationService}
            onChange={(id) => updateConfig(selectServicePatch(config, "translationService", id))}
            onManage={() => navigate("services")}
            aria-label={t("general.service")}
          />
        </Row>
        <Row label={t("general.mode")} description={t("general.modeHint")}>
          <ToggleGroup type="single" value={mode} onValueChange={(m) => m && updateConfig({ translationMode: m })} aria-label={t("general.mode")}>
            <ToggleGroupItem value="dual">
              <ColumnsIcon />
              {t("mode.dual")}
            </ToggleGroupItem>
            <ToggleGroupItem value="translation">
              <TextSelectIcon />
              {t("mode.translation")}
            </ToggleGroupItem>
          </ToggleGroup>
        </Row>
        <Row label={t("general.interface")} description={t("general.interfaceHint")}>
          <Select value={["zh-CN", "zh-TW", "en"].includes(config.interfaceLanguage) ? config.interfaceLanguage : config.interfaceLanguage === "zh-HK" ? "zh-TW" : "zh-CN"} onValueChange={(v) => updateConfig({ interfaceLanguage: v })}>
            <SelectTrigger className="w-48" aria-label={t("general.interface")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="zh-CN">简体中文</SelectItem>
              <SelectItem value="zh-TW">繁體中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Card>

      <Card title={t("general.style")} description={t("general.styleHint")}>
        <Row label={t("general.theme")}>
          <Select value={theme} onValueChange={(v) => updateConfig({ translationTheme: v })}>
            <SelectTrigger className="w-48" aria-label={t("general.theme")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="max-h-80">
              {THEMES.map((th) => (
                <SelectItem key={th.id} value={th.id}>
                  {t(th.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <div className="py-4">
          <ThemePreview theme={theme} mode={mode} />
        </div>
        {theme === "none" && (
          <SwitchRow
            label={t("general.sameLangBg")}
            description={t("general.sameLangBgHint")}
            checked={config.sameLangTranslationTheme !== "none"}
            onChange={(v) => updateConfig({ sameLangTranslationTheme: v ? "background" : "none" })}
          />
        )}
        <Row label={t("general.themeSites", { theme: t(THEMES.find((x) => x.id === theme)?.label || "theme.none") })} description={t("general.themeSitesHint")} stack>
          <PatternList
            items={themeSites}
            onChange={(items) =>
              updateConfig((raw: Config) => ({
                ...raw,
                translationThemePatterns: {
                  ...raw.translationThemePatterns,
                  [theme]: { ...raw.translationThemePatterns?.[theme], matches: items },
                },
              }))
            }
          />
        </Row>
      </Card>
    </Page>
  );
}
