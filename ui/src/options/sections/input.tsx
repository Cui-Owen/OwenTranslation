import { LanguagePicker } from "@/components/language-picker";
import { ServicePicker } from "@/components/service-picker";
import { ruleAdd, updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { selectServicePatch } from "@/lib/services";
import { navigate } from "../App";
import { Card, NumberRow, Page, PatternList, Row, SelectRow, SwitchRow, asList } from "../kit";

const KEYS = ["space", "/", "=", ";", ",", ".", ":"];

export function InputPage() {
  const config = useConfig();
  const { t } = useI18n();
  const on = !!config.enableInputTranslation;
  const input: Config = { ...config.generalRule?.inputConfig, ...config.generalRule?.["inputConfig.add"] };
  const keyLabel = (k: string) => (k === "space" ? t("input.space") : k === "none" ? t("input.noKey") : k);
  const trailing: string = config.inputTrailingTriggerKey || "space";
  const times: number = config.inputTrailingTriggerKeyRepeatTimes ?? 3;

  return (
    <Page title={t("nav.input")} description={t("input.description", { key: keyLabel(trailing), n: times })}>
      <Card>
        <SwitchRow
          label={t("input.enable")}
          description={t("input.enableHint", { key: keyLabel(trailing), n: times })}
          checked={on}
          onChange={(v) => updateConfig({ enableInputTranslation: v, enableInputTranslationWithoutTriggerKey: v })}
        />
        <Row label={t("input.target")} description={t("input.targetHint")} disabled={!on}>
          <LanguagePicker className="w-48" value={config.inputTargetLanguage || "en"} onChange={(code) => updateConfig({ inputTargetLanguage: code })} pinned={["en", config.targetLanguage]} aria-label={t("input.target")} />
        </Row>
        <SwitchRow label={t("input.autoChat")} description={t("input.autoChatHint")} checked={!!input.autoLanguageEnable} onChange={(v) => updateConfig(ruleAdd("inputConfig", { autoLanguageEnable: v }))} disabled={!on} />
        <SwitchRow label={t("input.autoPage")} description={t("input.autoPageHint")} checked={!!input.autoLanguagePageEnable} onChange={(v) => updateConfig(ruleAdd("inputConfig", { autoLanguagePageEnable: v }))} disabled={!on} />
        <Row label={t("input.service")} disabled={!on}>
          <ServicePicker
            className="w-56"
            config={config}
            value={config.inputTranslationService || "inherit"}
            inherit
            onChange={(id) => updateConfig(selectServicePatch(config, "inputTranslationService", id))}
            onManage={() => navigate("services")}
            aria-label={t("input.service")}
          />
        </Row>
      </Card>

      <Card title={t("input.trigger")}>
        <SelectRow
          label={t("input.trailingKey")}
          value={trailing}
          options={KEYS.filter((k) => k !== config.inputStartingTriggerKey).map((k) => ({ value: k, label: keyLabel(k) }))}
          onChange={(v) => updateConfig({ inputTrailingTriggerKey: v })}
          disabled={!on}
          width="w-36"
        />
        <SelectRow
          label={t("input.repeat")}
          value={String(times)}
          options={[2, 3, 4].map((n) => ({ value: String(n), label: t("input.times", { n }) }))}
          onChange={(v) => updateConfig({ inputTrailingTriggerKeyRepeatTimes: Number(v) })}
          disabled={!on}
          width="w-36"
        />
        <NumberRow label={t("input.interval")} description={t("input.intervalHint")} value={config.inputTrailingTriggerKeyTimeout} min={100} max={1000} suffix="ms" onCommit={(n) => updateConfig({ inputTrailingTriggerKeyTimeout: n })} disabled={!on} />
        <SwitchRow label={t("input.keepSource")} description={t("input.keepSourceHint")} checked={config.inputTranslationMode === "dual"} onChange={(v) => updateConfig({ inputTranslationMode: v ? "dual" : "translation" })} disabled={!on} />
      </Card>

      <Card title={t("input.blocked")} description={t("input.blockedHint")}>
        <div className="py-4">
          <PatternList
            items={asList(config.inputTranslationUrlPattern?.excludeMatches)}
            onChange={(items) =>
              updateConfig((raw: Config) => ({ ...raw, inputTranslationUrlPattern: { matches: [], ...raw.inputTranslationUrlPattern, excludeMatches: items } }))
            }
          />
        </div>
      </Card>
    </Page>
  );
}
