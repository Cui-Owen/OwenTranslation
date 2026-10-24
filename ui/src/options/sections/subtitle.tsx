import { RotateCcwIcon } from "lucide-react";
import { ServicePicker } from "@/components/service-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ruleAdd, updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { selectServicePatch } from "@/lib/services";
import { navigate } from "../App";
import { Card, Page, Row, SelectRow, SwitchRow } from "../kit";

const SIZES = ["60", "70", "80", "90", "100", "110", "120", "130", "150", "175", "200"];
const STYLE_KEYS = [
  "translationPosition",
  "translationStyle",
  "sourceFontSize",
  "translationFontSize",
  "sourceTextColor",
  "translationTextColor",
  "backgroundColor",
  "backgroundOpacity",
  "textShadowType",
];

function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => unknown; label: string }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => void onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-md border bg-card p-0.5" />
      <Input value={value} readOnly className="h-8 w-24 font-mono text-xs" tabIndex={-1} />
    </label>
  );
}

function Preview({ rule }: { rule: Config }) {
  const { t } = useI18n();
  const bg = rule.backgroundColor || "#080808";
  const alpha = Math.round((Number(rule.backgroundOpacity ?? 75) / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  const shadow = rule.textShadowType === "none" ? "none" : "0 1px 2px rgba(0,0,0,.9)";
  const source = (
    <span style={{ color: rule.sourceTextColor, fontSize: `${(Number(rule.sourceFontSize) || 100) * 0.16}px`, textShadow: shadow }}>{t("subtitle.sampleSource")}</span>
  );
  const target = (
    <span
      style={{
        color: rule.translationTextColor,
        fontSize: `${(Number(rule.translationFontSize) || 100) * 0.16}px`,
        textShadow: shadow,
        filter: rule.translationStyle === "mask" ? "blur(4px)" : undefined,
      }}
    >
      {t("subtitle.sampleTarget")}
    </span>
  );
  const top = rule.translationPosition === "top";
  return (
    <div className="relative flex aspect-[16/6] items-end justify-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#2b3340,#11151b)] p-4">
      <div className="flex max-w-[90%] flex-col items-center gap-0.5 rounded px-3 py-1.5 text-center leading-snug" style={{ background: `${bg}${alpha}` }}>
        {top ? target : source}
        {top ? source : target}
      </div>
    </div>
  );
}

export function SubtitlePage() {
  const config = useConfig();
  const { t } = useI18n();
  const rule: Config = config.generalRule?.subtitleRule || {};
  const asr: Config = config.generalRule?.ytAsrConfig || {};
  const set = (v: Config) => updateConfig(ruleAdd("subtitleRule", v));
  const aiOnly = (s: { template?: { ai: boolean } }) => !!s.template?.ai;
  const disabled = !!rule.disabled;

  return (
    <Page title={t("nav.subtitle")} description={t("subtitle.description")}>
      <Card>
        <SwitchRow label={t("subtitle.auto")} description={t("subtitle.autoHint")} checked={!!rule.autoEnableSubtitle} onChange={(v) => set({ autoEnableSubtitle: v })} disabled={disabled} />
        <SwitchRow label={t("subtitle.quickButton")} description={t("subtitle.quickButtonHint")} checked={!!rule.showQuickButton} onChange={(v) => set({ showQuickButton: v })} disabled={disabled} />
        <Row label={t("subtitle.service")} description={t("subtitle.serviceHint")} disabled={disabled}>
          <ServicePicker
            className="w-56"
            config={config}
            value={config.subtitleTranslateService || "inherit"}
            inherit
            onChange={(id) => updateConfig(selectServicePatch(config, "subtitleTranslateService", id))}
            onManage={() => navigate("services")}
            aria-label={t("subtitle.service")}
          />
        </Row>
        <SelectRow
          label={t("subtitle.mode")}
          value={rule.translationMode || "inherit"}
          options={[
            { value: "inherit", label: t("subtitle.modeInherit") },
            { value: "dual", label: t("mode.dual") },
            { value: "translation", label: t("mode.translation") },
          ]}
          onChange={(v) => set({ translationMode: v })}
          disabled={disabled}
        />
        <SwitchRow label={t("subtitle.human")} description={t("subtitle.humanHint")} checked={!!rule.humanPreferred} onChange={(v) => set({ humanPreferred: v })} disabled={disabled} />
        <SwitchRow label={t("subtitle.ambient")} description={t("subtitle.ambientHint")} checked={!!rule.filterAmbientSounds} onChange={(v) => set({ filterAmbientSounds: v })} disabled={disabled} />
        <SwitchRow label={t("subtitle.meeting")} description={t("subtitle.meetingHint")} checked={!!rule.meetingAutoEnableSubtitle} onChange={(v) => set({ meetingAutoEnableSubtitle: v })} disabled={disabled} />
      </Card>

      <Card title="YouTube" description={t("subtitle.youtubeHint")}>
        <SwitchRow label={t("subtitle.ytAuto")} description={t("subtitle.ytAutoHint")} checked={!!rule.youtubeAutoEnableSubtitle} onChange={(v) => set({ youtubeAutoEnableSubtitle: v })} disabled={disabled} />
        <SwitchRow label={t("subtitle.preTranslate")} description={t("subtitle.preTranslateHint")} checked={!!rule.preTranslation} onChange={(v) => set({ preTranslation: v })} disabled={disabled} />
        <SwitchRow
          label={t("subtitle.basicSegment")}
          description={t("subtitle.basicSegmentHint")}
          checked={!!asr.enable}
          onChange={(v) => updateConfig(ruleAdd("ytAsrConfig", { enable: v, aiEnable: false }))}
          disabled={disabled || !rule.preTranslation}
        />
        <Row label={t("subtitle.aiSegment")} description={t("subtitle.aiSegmentHint")} disabled={disabled || !rule.preTranslation}>
          <ServicePicker
            className="w-56"
            config={config}
            value={rule.aiSegmentService || ""}
            noneLabel={t("common.off")}
            filter={aiOnly}
            onChange={(id) => set({ aiSegmentService: id })}
            onManage={() => navigate("services")}
            aria-label={t("subtitle.aiSegment")}
          />
        </Row>
      </Card>

      <Card
        title={t("subtitle.style")}
        description={t("subtitle.styleHint")}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateConfig((raw: Config) => {
                const add: Config = { ...raw.generalRule?.["subtitleRule.add"] };
                for (const k of STYLE_KEYS) delete add[k];
                return { ...raw, generalRule: { ...raw.generalRule, "subtitleRule.add": add } };
              })
            }
          >
            <RotateCcwIcon />
            {t("common.reset")}
          </Button>
        }
      >
        <div className="py-4">
          <Preview rule={rule} />
        </div>
        <SelectRow
          label={t("subtitle.position")}
          value={rule.translationPosition === "top" ? "top" : "bottom"}
          options={[
            { value: "bottom", label: t("subtitle.positionBottom") },
            { value: "top", label: t("subtitle.positionTop") },
          ]}
          onChange={(v) => set({ translationPosition: v })}
        />
        <SelectRow label={t("subtitle.sourceSize")} value={String(rule.sourceFontSize ?? "100")} options={SIZES.map((s) => ({ value: s, label: `${s}%` }))} onChange={(v) => set({ sourceFontSize: v })} width="w-28" />
        <SelectRow label={t("subtitle.targetSize")} value={String(rule.translationFontSize ?? "100")} options={SIZES.map((s) => ({ value: s, label: `${s}%` }))} onChange={(v) => set({ translationFontSize: v })} width="w-28" />
        <Row label={t("subtitle.sourceColor")}>
          <ColorField label={t("subtitle.sourceColor")} value={rule.sourceTextColor || "#FFFFFF"} onChange={(v) => set({ sourceTextColor: v.toUpperCase() })} />
        </Row>
        <Row label={t("subtitle.targetColor")}>
          <ColorField label={t("subtitle.targetColor")} value={rule.translationTextColor || "#FFFFFF"} onChange={(v) => set({ translationTextColor: v.toUpperCase() })} />
        </Row>
        <Row label={t("subtitle.background")}>
          <ColorField label={t("subtitle.background")} value={rule.backgroundColor || "#080808"} onChange={(v) => set({ backgroundColor: v.toUpperCase() })} />
        </Row>
        <SelectRow
          label={t("subtitle.opacity")}
          value={String(rule.backgroundOpacity ?? "75")}
          options={["0", "25", "50", "75", "90", "100"].map((s) => ({ value: s, label: `${s}%` }))}
          onChange={(v) => set({ backgroundOpacity: v })}
          width="w-28"
        />
        <SwitchRow label={t("subtitle.shadow")} checked={rule.textShadowType !== "none"} onChange={(v) => set({ textShadowType: v ? "shadow" : "none" })} />
        <SwitchRow label={t("subtitle.blur")} description={t("subtitle.blurHint")} checked={rule.translationStyle === "mask"} onChange={(v) => set({ translationStyle: v ? "mask" : "" })} />
      </Card>

      <Card>
        <SwitchRow label={t("subtitle.disable")} description={t("subtitle.disableHint")} checked={disabled} onChange={(v) => set({ disabled: v })} />
      </Card>
    </Page>
  );
}
