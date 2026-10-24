import * as React from "react";
import { EraserIcon } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { updateConfig, useConfig } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { extensionVersion } from "@/lib/runtime";
import { cacheSize, clearCaches, formatBytes } from "@/lib/storage";
import { Card, Page, Row, SwitchRow } from "../kit";

export function AboutPage() {
  const config = useConfig();
  const { t } = useI18n();
  const [size, setSize] = React.useState<number | null>(null);
  const [clearing, setClearing] = React.useState(false);
  React.useEffect(() => void cacheSize().then(setSize), []);

  return (
    <Page title={t("nav.about")}>
      <Card>
        <div className="flex items-center gap-4 py-5">
          <BrandMark className="size-12" />
          <div>
            <div className="font-serif text-xl font-black tracking-wider">{t("app.name")}</div>
            <div className="font-mono text-xs text-muted-foreground">{extensionVersion()}</div>
          </div>
        </div>
        <p className="py-4 text-[13px] leading-relaxed text-muted-foreground">{t("about.summary")}</p>
      </Card>
      <Card>
        <SwitchRow label={t("about.enabled")} description={t("about.enabledHint")} checked={config.enabled !== false} onChange={(v) => updateConfig({ enabled: v })} />
        <SwitchRow label={t("about.cache")} description={t("about.cacheHint")} checked={!!config.cache} onChange={(v) => updateConfig({ cache: v })} />
        <Row label={t("about.clear")} description={size != null ? t("about.clearSize", { size: formatBytes(size) }) : t("about.clearHint")}>
          <Button
            variant="outline"
            disabled={clearing}
            onClick={async () => {
              setClearing(true);
              await clearCaches();
              setClearing(false);
              setSize(await cacheSize());
              toast.success(t("about.cleared"));
            }}
          >
            <EraserIcon />
            {t("about.clearAction")}
          </Button>
        </Row>
      </Card>
    </Page>
  );
}
