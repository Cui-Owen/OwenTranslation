import data from "@/generated/languages.json";
import type { Lang } from "./i18n";

export const LANGUAGE_CODES: string[] = data.codes;

const NAMES = data.names as Record<"zh-CN" | "zh-TW" | "en", Record<string, string>>;

export function languageName(code: string, lang: Lang): string {
  const table = lang === "en" ? NAMES.en : lang === "zh-TW" ? NAMES["zh-TW"] : NAMES["zh-CN"];
  return table[code] || NAMES.en[code] || code;
}

/** Native name, shown next to the localized one so either reader finds it. */
export function nativeName(code: string): string {
  if (code === "auto") return "";
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name && name !== code ? name : "";
  } catch {
    return "";
  }
}

export const INTERFACE_LANGUAGES = ["zh-CN", "zh-TW", "en"] as const;
