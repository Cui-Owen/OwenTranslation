import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* Building blocks every settings page is made of: one page header, cards of rows. */

export function Page({ title, description, actions, children }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end gap-x-4 gap-y-2 pt-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-black tracking-wide">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, description, action, children, className }: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {(title || action) && (
        <div className="flex items-start gap-3 px-5 pt-4 pb-1">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="divide-y px-5">{children}</div>
    </section>
  );
}

export function Row({
  label,
  description,
  children,
  htmlFor,
  stack,
  disabled,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  htmlFor?: string;
  stack?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex gap-x-6 gap-y-3 py-4", stack ? "flex-col" : "flex-wrap items-center", disabled && "opacity-50")}>
      <div className="min-w-48 flex-1">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children && <div className={cn("flex items-center gap-2", stack ? "w-full" : "shrink-0")}>{children}</div>}
    </div>
  );
}

export function SwitchRow({ label, description, checked, onChange, disabled }: { label: React.ReactNode; description?: React.ReactNode; checked: boolean; onChange: (v: boolean) => unknown; disabled?: boolean }) {
  const id = React.useId();
  return (
    <Row label={label} description={description} htmlFor={id} disabled={disabled}>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => void onChange(v)} />
    </Row>
  );
}

export function SelectRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
  width = "w-48",
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => unknown;
  disabled?: boolean;
  width?: string;
}) {
  return (
    <Row label={label} description={description} disabled={disabled}>
      <Select value={value} onValueChange={(v) => void onChange(v as T)} disabled={disabled}>
        <SelectTrigger className={width}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

/** Commits on blur or Enter so a half-typed number is never saved. */
export function NumberField({ value, onCommit, min, max, step, className, ...rest }: { value: number | undefined; onCommit: (v: number) => unknown; min?: number; max?: number; step?: number; className?: string; "aria-label"?: string }) {
  const [text, setText] = React.useState(value == null ? "" : String(value));
  React.useEffect(() => setText(value == null ? "" : String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (text.trim() === "" || Number.isNaN(n) || (min != null && n < min) || (max != null && n > max)) {
      setText(value == null ? "" : String(value));
      return;
    }
    if (n !== value) void onCommit(n);
  };
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className={cn("w-28 text-right tabular-nums", className)}
      aria-label={rest["aria-label"]}
    />
  );
}

export function NumberRow(props: { label: React.ReactNode; description?: React.ReactNode; value: number | undefined; onCommit: (v: number) => unknown; min?: number; max?: number; step?: number; suffix?: string; disabled?: boolean }) {
  return (
    <Row label={props.label} description={props.description} disabled={props.disabled}>
      <NumberField value={props.value} onCommit={props.onCommit} min={props.min} max={props.max} step={props.step} aria-label={typeof props.label === "string" ? props.label : undefined} />
      {props.suffix && <span className="text-sm text-muted-foreground">{props.suffix}</span>}
    </Row>
  );
}

/** Editable list of site patterns (hosts, origins or globs). */
export function PatternList({
  items,
  onChange,
  placeholder,
  empty,
  normalize = (s) => s.trim(),
}: {
  items: string[];
  onChange: (items: string[]) => unknown;
  placeholder?: string;
  empty?: string;
  normalize?: (s: string) => string | undefined;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const values = draft
      .split(/[\s,，]+/)
      .map((s) => normalize(s))
      .filter((s): s is string => !!s);
    if (!values.length) return;
    void onChange([...new Set([...items, ...values])]);
    setDraft("");
  };
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder || t("sites.placeholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="outline" onClick={add} disabled={!draft.trim()}>
          <PlusIcon />
          {t("common.add")}
        </Button>
      </div>
      {items.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 py-0.5 pr-1 pl-2 font-mono text-xs">
              <span className="truncate">{item}</span>
              <button
                type="button"
                aria-label={t("common.remove")}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => void onChange(items.filter((i) => i !== item))}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{empty || t("sites.empty")}</p>
      )}
    </div>
  );
}

export function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : typeof value === "string" && value ? [value] : [];
}
