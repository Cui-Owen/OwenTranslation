import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { pickableServices, type ServiceItem } from "@/lib/services";
import { cn } from "@/lib/utils";

const MANAGE = "__manage";
const NONE = "__none";

interface Props {
  config: Config;
  value: string;
  onChange: (id: string) => void;
  onManage?: () => void;
  /** Offer "same as the main service" (stored as "inherit"). */
  inherit?: boolean;
  /** Offer an "off" entry, stored as "". */
  noneLabel?: string;
  filter?: (s: ServiceItem) => boolean;
  className?: string;
  size?: "sm" | "default";
  "aria-label"?: string;
}

export function ServiceIcon({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" className={cn("size-4 shrink-0 rounded-[4px] object-contain", className)} />;
}

export function ServicePicker({ config, value, onChange, onManage, inherit, noneLabel, filter, className, size, ...rest }: Props) {
  const { t, lang } = useI18n();
  let services = pickableServices(config, value && value !== "inherit" ? [value] : [], lang);
  if (filter) services = services.filter((s) => filter(s) || s.id === value);
  const main = services.find((s) => s.id === config.translationService);
  const current = value === "" && noneLabel !== undefined ? NONE : value;

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v === MANAGE) onManage?.();
        else onChange(v === NONE ? "" : v);
      }}
    >
      <SelectTrigger className={cn("w-full", className)} size={size} aria-label={rest["aria-label"]}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {noneLabel !== undefined && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {inherit && (
          <SelectItem value="inherit">
            {main && <ServiceIcon src={main.icon} />}
            <span>{t("service.inherit", { name: main?.name || "" })}</span>
          </SelectItem>
        )}
        {services.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <ServiceIcon src={s.icon} />
            <span className="truncate">{s.name}</span>
            {!s.ready && <span className="text-xs text-ochre">{t("service.needsSetup")}</span>}
          </SelectItem>
        ))}
        {onManage && (
          <>
            <SelectSeparator />
            <SelectItem value={MANAGE} className="text-muted-foreground">
              {t("service.manage")}
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
