import { useConfigState } from "./config";
import { M } from "./messages";

export type Lang = "zh-CN" | "zh-TW" | "en";
export type MessageKey = keyof typeof M;
type Vars = Record<string, string | number>;

export function langOf(interfaceLanguage?: string): Lang {
  if (!interfaceLanguage) return "zh-CN";
  if (interfaceLanguage.startsWith("en")) return "en";
  if (interfaceLanguage === "zh-TW" || interfaceLanguage === "zh-HK") return "zh-TW";
  return "zh-CN";
}

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const [zh, en, tw] = M[key] as readonly string[];
  let s = lang === "en" ? en : lang === "zh-TW" ? tw || zh : zh;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function useI18n() {
  const lang = langOf(useConfigState().config?.interfaceLanguage);
  return { lang, t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars) };
}
