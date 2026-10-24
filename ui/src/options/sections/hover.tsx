import { ServicePicker } from "@/components/service-picker";
import { generalRule, updateConfig, useConfig } from "@/lib/config";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { selectServicePatch } from "@/lib/services";
import { navigate } from "../App";
import { Card, Page, Row, SelectRow } from "../kit";

const KEYS: { value: string; label: MessageKey }[] = [
  { value: "Off", label: "common.off" },
  { value: "Ctrl", label: "hover.ctrl" },
  { value: "Alt", label: "hover.alt" },
  { value: "Shift", label: "hover.shift" },
  { value: "MouseHoldKeyPressHold", label: "hover.longPress" },
  { value: "Auto", label: "hover.auto" },
];

export function HoverPage() {
  const config = useConfig();
  const { t } = useI18n();
  const key: string = config.generalRule?.mouseHoverHoldKey || "Off";
  const known = KEYS.some((k) => k.value === key);
  return (
    <Page title={t("nav.hover")} description={t("hover.description")}>
      <Card>
        <SelectRow
          label={t("hover.key")}
          description={t("hover.keyHint")}
          value={known ? key : "Ctrl"}
          options={KEYS.map((k) => ({ value: k.value, label: t(k.label) }))}
          onChange={(v) => updateConfig(generalRule(v === "Off" ? { mouseHoverHoldKey: "Off" } : { mouseHoverHoldKey: v, mouseHoverPreferenceKey: v }))}
        />
        <Row label={t("hover.service")} description={t("hover.serviceHint")} disabled={key === "Off"}>
          <ServicePicker
            className="w-56"
            config={config}
            value={config.mouseHoverTranslationService || "inherit"}
            inherit
            onChange={(id) => updateConfig(selectServicePatch(config, "mouseHoverTranslationService", id))}
            onManage={() => navigate("services")}
            aria-label={t("hover.service")}
          />
        </Row>
      </Card>
      <p className="px-1 text-[13px] text-muted-foreground">{t("hover.shortcutTip")}</p>
    </Page>
  );
}
