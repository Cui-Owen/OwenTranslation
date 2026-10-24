import type { Config } from "./config";
import { templateOf } from "./services";

/*
 * A direct request to the service with one short sentence, made from the
 * settings page (extension pages may fetch any host the extension can reach).
 * It checks address, key and model; the engine's own request adds prompts and
 * batching on top of the same endpoint.
 */

const SAMPLE = "Hello, world.";
const OPENAI_LIKE = new Set(["openai", "deepseek", "openrouter", "ollama", "custom-ai", "magpie"]);

export interface TestResult {
  ok: boolean;
  text: string;
  ms: number;
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message || j?.message || j?.error || j?.detail;
    if (m) return `${res.status} · ${typeof m === "string" ? m : JSON.stringify(m)}`;
  } catch {
    /* plain text */
  }
  return `${res.status} · ${body.slice(0, 200) || res.statusText}`;
}

export async function testService(config: Config, id: string, targetLanguage: string): Promise<TestResult> {
  const s: Config = config.translationServices?.[id] || {};
  const type = templateOf(config, id)?.type || s.type || id;
  const started = performance.now();
  const done = (ok: boolean, text: string) => ({ ok, text, ms: Math.round(performance.now() - started) });
  const prompt = `Translate to ${targetLanguage}. Output the translation only.\n\n${SAMPLE}`;
  const signal = AbortSignal.timeout(20000);

  try {
    if (OPENAI_LIKE.has(type)) {
      const url = s.apiUrl || templateOf(config, id)?.defaultUrl;
      if (!url) return done(false, "API URL");
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", ...(s.APIKEY ? { Authorization: `Bearer ${s.APIKEY}` } : {}) },
        body: JSON.stringify({ model: s.model, messages: [{ role: "user", content: prompt }], temperature: 0, stream: false }),
      });
      if (!res.ok) return done(false, await readError(res));
      const j = await res.json();
      return done(true, String(j?.choices?.[0]?.message?.content ?? "").trim());
    }
    if (type === "claude") {
      const res = await fetch(s.apiUrl || "https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": s.APIKEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: s.model, max_tokens: 64, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) return done(false, await readError(res));
      const j = await res.json();
      return done(true, String(j?.content?.[0]?.text ?? "").trim());
    }
    if (type === "gemini") {
      const tpl: string = s.apiUrl || "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}";
      const url = tpl.replace("{model}", encodeURIComponent(s.model || "")).replace("{key}", encodeURIComponent(s.APIKEY || ""));
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      });
      if (!res.ok) return done(false, await readError(res));
      const j = await res.json();
      return done(true, String(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim());
    }
    if (type === "deepl") {
      const key: string = s.authKey || "";
      const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
      const res = await fetch(`${host}/v2/translate`, {
        method: "POST",
        signal,
        headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: [SAMPLE], target_lang: deeplLang(targetLanguage) }),
      });
      if (!res.ok) return done(false, await readError(res));
      const j = await res.json();
      return done(true, String(j?.translations?.[0]?.text ?? ""));
    }
    if (type === "deeplx") {
      const res = await fetch(s.url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: SAMPLE, source_lang: "EN", target_lang: deeplLang(targetLanguage) }),
      });
      if (!res.ok) return done(false, await readError(res));
      const j = await res.json();
      return done(true, String(j?.data ?? j?.alternatives?.[0] ?? ""));
    }
    return done(true, "");
  } catch (e) {
    const err = e as Error;
    return done(false, err.name === "TimeoutError" ? "Timeout (20 s)" : err.message);
  }
}

function deeplLang(code: string) {
  if (code === "zh-TW" || code === "zh-HK") return "ZH-HANT";
  if (code.startsWith("zh")) return "ZH";
  if (code === "pt-br") return "PT-BR";
  if (code === "en") return "EN-US";
  return code.toUpperCase();
}

/** Model ids from an OpenAI-compatible endpoint's /models list. */
export async function listModels(config: Config, id: string): Promise<string[]> {
  const s: Config = config.translationServices?.[id] || {};
  const url: string = s.apiUrl || templateOf(config, id)?.defaultUrl || "";
  const base = url.replace(/\/(chat\/completions|responses|messages)\/?$/, "");
  const res = await fetch(`${base}/models`, {
    signal: AbortSignal.timeout(15000),
    headers: s.APIKEY ? { Authorization: `Bearer ${s.APIKEY}`, "x-api-key": s.APIKEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } : {},
  });
  if (!res.ok) throw new Error(await readError(res));
  const j = await res.json();
  const list: Config[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : [];
  return [...new Set(list.map((m) => String(m.id ?? m.name ?? "").replace(/^models\//, "")).filter(Boolean))].sort();
}

export function canListModels(type: string) {
  return OPENAI_LIKE.has(type) || type === "claude";
}
