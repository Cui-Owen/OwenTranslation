import icons from "@/generated/service-icons.json";
import type { Config } from "./config";
import { translate, type Lang, type MessageKey } from "./i18n";

/*
 * The twelve service templates and the fields their settings form shows.
 * Field names are the engine's service keys; dotted names ("aiBatch.mode")
 * are nested objects. Anything not listed keeps the template default.
 */

export type ServiceType =
  | "bing" | "google" | "deepl" | "deeplx" | "magpie" | "openai" | "claude"
  | "gemini" | "deepseek" | "openrouter" | "ollama" | "custom-ai";

export type FieldKind = "text" | "password" | "number" | "textarea" | "switch" | "select" | "model";

export interface Field {
  name: string;
  label: MessageKey;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  hint?: MessageKey;
  options?: { value: string; label: MessageKey }[];
  advanced?: boolean;
  min?: number;
  step?: number;
}

export interface Template {
  type: ServiceType;
  /** Localized name instead of a brand name. */
  labelKey?: MessageKey;
  ai: boolean;
  builtin?: boolean; // always present, nothing to configure
  label: string;
  defaultUrl?: string;
  keyUrl?: string; // where the provider issues API keys
  fields: Field[];
}

const LIMIT: Field = { name: "limit", label: "field.limit", kind: "number", hint: "hint.limit", advanced: true, min: 0.1, step: 0.1 };
const MAX_LEN: Field = { name: "maxTextLengthPerRequest", label: "field.maxLength", kind: "number", hint: "hint.maxLength", advanced: true, min: 1 };
const MAX_GROUP: Field = { name: "maxTextGroupLengthPerRequest", label: "field.maxGroup", kind: "number", hint: "hint.maxGroup", advanced: true, min: 1 };
const RICH: Field = { name: "enableRichTranslate", label: "field.rich", kind: "switch", hint: "hint.rich", advanced: true };

function ai(type: ServiceType, label: string, opts: { url?: string; keyUrl?: string; keyOptional?: boolean; urlRequired?: boolean }): Template {
  return {
    type,
    ai: true,
    label,
    defaultUrl: opts.url,
    keyUrl: opts.keyUrl,
    fields: [
      { name: "APIKEY", label: "field.apiKey", kind: "password", required: !opts.keyOptional },
      { name: "model", label: "field.model", kind: "model", hint: "hint.model" },
      { name: "apiUrl", label: "field.apiUrl", kind: "text", required: opts.urlRequired, placeholder: opts.url, hint: "hint.apiUrl" },
      { name: "enableAIContext", label: "field.aiContext", kind: "switch", hint: "hint.aiContext" },
      {
        name: "aiBatch.mode", label: "field.batchMode", kind: "select", hint: "hint.batchMode", advanced: true,
        options: [
          { value: "recommended", label: "batch.recommended" },
          { value: "custom", label: "batch.custom" },
        ],
      },
      LIMIT,
      { name: "temperature", label: "field.temperature", kind: "number", advanced: true, min: 0, step: 0.1 },
      MAX_LEN,
      MAX_GROUP,
      { name: "systemPrompt", label: "field.systemPrompt", kind: "textarea", advanced: true },
      { name: "prompt", label: "field.prompt", kind: "textarea", hint: "hint.prompt", advanced: true },
      { name: "multiplePrompt", label: "field.multiplePrompt", kind: "textarea", advanced: true },
      { name: "subtitlePrompt", label: "field.subtitlePrompt", kind: "textarea", advanced: true },
    ],
  };
}

export const TEMPLATES: Template[] = [
  { type: "bing", ai: false, builtin: true, label: "Microsoft Translator", labelKey: "svc.bing", fields: [] },
  { type: "google", ai: false, builtin: true, label: "Google", labelKey: "svc.google", fields: [] },
  {
    type: "deepl", ai: false, label: "DeepL", keyUrl: "https://www.deepl.com/your-account/keys",
    fields: [{ name: "authKey", label: "field.authKey", kind: "password", required: true }, LIMIT, RICH],
  },
  {
    type: "deeplx", ai: false, label: "DeepLX",
    fields: [{ name: "url", label: "field.apiUrl", kind: "text", required: true, placeholder: "http://127.0.0.1:1188/translate" }, LIMIT, MAX_LEN, MAX_GROUP, RICH],
  },
  ai("magpie", "Magpie", { url: "http://127.0.0.1:3425/v1/chat/completions", keyOptional: true }),
  ai("openai", "OpenAI", { url: "https://api.openai.com/v1/chat/completions", keyUrl: "https://platform.openai.com/api-keys" }),
  ai("claude", "Claude", { url: "https://api.anthropic.com/v1/messages", keyUrl: "https://console.anthropic.com/settings/keys" }),
  ai("gemini", "Gemini", { url: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}", keyUrl: "https://aistudio.google.com/apikey" }),
  ai("deepseek", "DeepSeek", { url: "https://api.deepseek.com/chat/completions", keyUrl: "https://platform.deepseek.com/api_keys" }),
  ai("openrouter", "OpenRouter", { url: "https://openrouter.ai/api/v1/chat/completions", keyUrl: "https://openrouter.ai/keys" }),
  ai("ollama", "Ollama", { url: "http://localhost:11434/v1/chat/completions", keyOptional: true }),
  { ...ai("custom-ai", "OpenAI Compatible", { url: "https://api.openai.com/v1/chat/completions", urlRequired: true }), labelKey: "services.compatible" },
];

export function templateLabel(t: Template, lang: Lang): string {
  return t.labelKey ? translate(lang, t.labelKey) : t.label;
}

const BY_TYPE = new Map(TEMPLATES.map((t) => [t.type, t]));
const ICONS = icons as Record<string, string>;

export interface ServiceItem {
  id: string;
  type: string;
  template?: Template;
  config: Config;
  name: string;
  icon: string;
  ready: boolean;
  custom: boolean; // user-added (group "custom"), can be deleted
  listed: boolean; // offered in pickers
}

export function templateOf(config: Config, id: string): Template | undefined {
  const s = config.translationServices?.[id] || {};
  return BY_TYPE.get((s.type || id) as ServiceType) || BY_TYPE.get(s.extends);
}

export function getPath(obj: Config | undefined, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Config)[k] : undefined), obj);
}

export function setPath(obj: Config, path: string, value: unknown): Config {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj[head] || {}, rest.join("."), value) };
}

function isReady(template: Template | undefined, s: Config): boolean {
  if (!template) return !!s.type || !!s.extends;
  return template.fields.every((f) => !f.required || !!getPath(s, f.name));
}

export function describe(config: Config, id: string, lang: Lang = "zh-CN"): ServiceItem {
  const s: Config = config.translationServices?.[id] || {};
  const template = templateOf(config, id);
  const custom = s.group === "custom";
  const ready = isReady(template, s);
  // Stock templates count only once the user has configured them (older
  // versions stored keys on the template itself); new ones are user services.
  const touched = custom || !!template?.builtin || !!config.rawUserConfig?.translationServices?.[id];
  const visible = s.visible != null ? !!s.visible : !s.hidden;
  const type = s.type || id;
  return {
    id,
    type,
    template,
    config: s,
    name: (custom && s.name) || (template && templateLabel(template, lang)) || s.name || id,
    icon: ICONS[type] || ICONS[s.extends] || ICONS["custom-ai"],
    ready,
    custom,
    listed: touched && visible && !s.owenCatalogHidden && (!!template || custom),
  };
}

/** Services shown in pickers: ready and visible, plus whatever is selected now. */
export function pickableServices(config: Config, selected?: string[], lang?: Lang): ServiceItem[] {
  const ids = Object.keys(config.translationServices || {});
  return ids
    .map((id) => describe(config, id, lang))
    .filter((s) => (s.listed && s.ready) || selected?.includes(s.id))
    .sort((a, b) => rank(a) - rank(b));
}

/** Everything that belongs on the services page. */
export function managedServices(config: Config, lang?: Lang): ServiceItem[] {
  const inUse = new Set(SERVICE_KEYS.map((k) => config[k]));
  return Object.keys(config.translationServices || {})
    .map((id) => describe(config, id, lang))
    .filter((s) => !s.config.owenCatalogHidden)
    .filter((s) => s.custom || s.template?.builtin || !!config.rawUserConfig?.translationServices?.[s.id] || inUse.has(s.id))
    .sort((a, b) => rank(a) - rank(b));
}

function rank(s: ServiceItem) {
  if (s.template?.builtin) return s.type === "bing" ? 0 : 1;
  return s.custom ? 3 : 2;
}

export const SERVICE_KEYS = ["translationService", "inputTranslationService", "mouseHoverTranslationService", "subtitleTranslateService"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

/** The engine's own way of recording a choice: the type for templates, the id for custom AI. */
export function selectServicePatch(config: Config, key: ServiceKey, id: string) {
  return (raw: Config): Config => {
    const next: Config = { ...raw, translationServiceChangedbyUserAt: new Date().toISOString() };
    const s = config.translationServices?.[id];
    if (s?.type === "custom-ai") next[key] = id;
    else if (s?.type) next[key] = s.type;
    const prev = raw.userTranslationServices && !Array.isArray(raw.userTranslationServices) ? raw.userTranslationServices : {};
    next.userTranslationServices = { ...prev, [key]: id };
    return next;
  };
}

function randomId(n = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => chars[b % chars.length]).join("");
}

/** A new user service of a template type, named like the engine names them ("OpenAI 2"). */
export function newServicePatch(config: Config, type: ServiceType): { id: string; patch: (raw: Config) => Config } {
  const id = `${type}-${randomId()}`;
  const template = BY_TYPE.get(type)!;
  return {
    id,
    patch: (raw) => {
      const services: Config = raw.translationServices || {};
      const count = (Object.values(config.translationServices || {}) as Config[]).filter((s) => s?.type === type && s?.group === "custom").length;
      const entry: Config = { type, extends: type, group: "custom", name: `${template.label} ${count + 1}` };
      if (type === "magpie") Object.assign(entry, { apiUrl: template.defaultUrl, APIKEY: "magpie", model: "auto/gemini-3.8-flash", models: "auto/gemini-3.8-flash" });
      return { ...raw, translationServices: { ...services, [id]: entry } };
    },
  };
}

export function modelChoices(config: Config, item: ServiceItem): string[] {
  const fromTemplate = config.translationServices?.[item.type]?.models ?? item.config.models;
  const list = Array.isArray(fromTemplate) ? fromTemplate : typeof fromTemplate === "string" ? fromTemplate.split("|") : [];
  return [...new Set(list.map((m: string) => m.trim()).filter(Boolean))];
}

export function serviceIcon(type: string): string {
  return ICONS[type] || ICONS["custom-ai"];
}
