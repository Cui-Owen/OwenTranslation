import { ServicePicker } from "@/components/service-picker";
import { ruleAdd, updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { navigate } from "../App";
import { Card, Page, PatternList, Row, SelectRow, SwitchRow, asList } from "../kit";

const MODES = ["mini", "icon", "direct", "Ctrl", "Alt", "Shift"] as const;

export function SelectionPage() {
  const config = useConfig();
  const { t } = useI18n();
  const s: Config = config.generalRule?.selectionTranslation || {};
  const on = !!s.enable;
  const set = (v: Config) => updateConfig(ruleAdd("selectionTranslation", v));
  const mode: string = MODES.includes(s.triggerMode) ? s.triggerMode : "mini";
  const modeLabel = (m: string) =>
    m === "mini" ? t("selection.mini") : m === "icon" ? t("selection.icon") : m === "direct" ? t("selection.direct") : t("selection.withKey", { key: m });

  return (
    <Page title={t("nav.selection")} description={t("selection.description")}>
      <Card>
        <SwitchRow label={t("selection.enable")} description={t("selection.enableHint")} checked={on} onChange={(v) => set({ enable: v })} />
        <Row label={t("selection.service")} description={t("selection.serviceHint")} disabled={!on}>
          <ServicePicker
            className="w-56"
            config={config}
            value={s.service || ""}
            noneLabel={t("scene.selectionAuto")}
            filter={(x) => !!x.template?.ai}
            onChange={(id) => set({ service: id || undefined })}
            onManage={() => navigate("services")}
            aria-label={t("selection.service")}
          />
        </Row>
        <SelectRow
          label={t("selection.trigger")}
          description={mode === "direct" ? t("selection.directHint") : mode === "mini" || mode === "icon" ? t("selection.iconHint") : t("selection.keyHint", { key: mode })}
          value={mode}
          options={MODES.map((m) => ({ value: m, label: modeLabel(m) }))}
          onChange={(v) => set({ triggerMode: v })}
          disabled={!on}
        />
        {(mode === "mini" || mode === "icon") && (
          <SelectRow
            label={t("selection.iconAction")}
            value={s.triggerModeForIcon === "click" ? "click" : "hover"}
            options={[
              { value: "hover", label: t("selection.onHover") },
              { value: "click", label: t("selection.onClick") },
            ]}
            onChange={(v) => set({ triggerModeForIcon: v })}
            disabled={!on}
          />
        )}
        <SwitchRow label={t("selection.sameLang")} description={t("selection.sameLangHint")} checked={s.enableWhenSameLanguage ?? true} onChange={(v) => set({ enableWhenSameLanguage: v })} disabled={!on} />
        <SwitchRow label={t("selection.autoRead")} description={t("selection.autoReadHint")} checked={!!s.enableAutoRead} onChange={(v) => set({ enableAutoRead: v })} disabled={!on} />
      </Card>
      <Card title={t("selection.blocked")} description={t("selection.blockedHint")}>
        <div className="py-4">
          <PatternList
            items={asList(s.urlPattern?.excludeMatches)}
            onChange={(items) =>
              updateConfig(
                ruleAdd("selectionTranslation", {
                  urlPattern: { matches: asList(config.rawUserConfig?.generalRule?.["selectionTranslation.add"]?.urlPattern?.matches), excludeMatches: items },
                }),
              )
            }
          />
        </div>
      </Card>
    </Page>
  );
}
