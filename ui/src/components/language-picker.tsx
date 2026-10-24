import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LANGUAGE_CODES, languageName, nativeName } from "@/lib/languages";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Common {
  /** Adds "auto" (detect) at the top; `autoLabel` can name the detected language. */
  allowAuto?: boolean;
  autoLabel?: string;
  pinned?: string[];
  /** Restricts the list (e.g. languages every selected service supports). */
  options?: string[];
  /** Trigger text when no language is chosen (an "add" button). */
  placeholder?: React.ReactNode;
  className?: string;
  size?: "sm" | "default";
  align?: "start" | "center" | "end";
  "aria-label"?: string;
}

type Single = Common & { multiple?: false; value: string; onChange: (code: string) => void };
type Multiple = Common & { multiple: true; values: string[]; onValuesChange: (codes: string[]) => void };

export function LanguagePicker(props: Single | Multiple) {
  const { allowAuto, autoLabel, pinned = [], options, placeholder, className, size = "default", align = "start" } = props;
  const { t, lang } = useI18n();
  const [open, setOpen] = React.useState(false);
  const selected = props.multiple ? props.values : [props.value];
  const codes = (options ?? LANGUAGE_CODES).filter((c) => c !== "auto" && c !== "placeholder");
  const top = [...new Set(pinned.filter((c) => codes.includes(c)))];
  const rest = codes.filter((c) => !top.includes(c));
  const name = (code: string) => (code === "auto" ? autoLabel || t("lang.auto") : languageName(code, lang));
  const shown = selected.filter((c) => c && c !== "placeholder");
  const label = !shown.length ? placeholder : props.multiple ? shown.map(name).join("、") : name(shown[0]);

  const pick = (code: string) => {
    if (!props.multiple) {
      props.onChange(code);
      setOpen(false);
      return;
    }
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected.filter((c) => c !== "placeholder"), code];
    if (next.length) props.onValuesChange(next);
  };

  const item = (code: string) => {
    const label = code === "auto" ? t("lang.auto") : languageName(code, lang);
    const native = nativeName(code);
    return (
      <CommandItem key={code} value={`${code} ${label} ${native}`} onSelect={() => pick(code)}>
        <span className="truncate">{label}</span>
        {native && native !== label && <span className="truncate text-xs text-muted-foreground">{native}</span>}
        <CheckIcon className={cn("ml-auto size-4 text-vermilion", selected.includes(code) ? "opacity-100" : "opacity-0")} />
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={props["aria-label"]}
          size={size === "sm" ? "sm" : "default"}
          className={cn("min-w-0 justify-between gap-1 px-3 font-normal", className)}
        >
          <span className="inline-flex min-w-0 items-center gap-1 truncate">{label}</span>
          {shown.length > 0 && <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align={align}>
        <Command>
          <CommandInput placeholder={t("lang.search")} />
          <CommandList>
            <CommandEmpty>{t("common.noResults")}</CommandEmpty>
            {(allowAuto || top.length > 0) && (
              <CommandGroup>
                {allowAuto && item("auto")}
                {top.map(item)}
              </CommandGroup>
            )}
            <CommandGroup heading={top.length || allowAuto ? t("lang.all") : undefined}>{rest.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
