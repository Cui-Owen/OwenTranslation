import { useSyncExternalStore } from "react";
import { background } from "./runtime";

/*
 * Two views of the same settings:
 *   config — the merged configuration the engine actually runs with
 *            (defaults + site rules + user overrides), read-only here;
 *   raw    — the user's own overrides ("fullLocalUserConfig"), the only thing
 *            the UI writes. Nested defaults are extended with "<key>.add"
 *            entries, e.g. generalRule["subtitleRule.add"].
 * Both come from the background worker so the engine's merge stays the single
 * source of truth.
 */

// The engine's config is a large schemaless object; fields are read where used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Config = Record<string, any>;
export type Patch = Config | ((raw: Config) => Config);

type State = { config: Config | null; raw: Config; error: string | null };

let state: State = { config: null, raw: {}, error: null };
let url = "https://example.com/";
const listeners = new Set<() => void>();

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export async function loadConfig(pageUrl?: string) {
  if (pageUrl) url = pageUrl;
  try {
    const [config, raw] = await Promise.all([
      background<Config>("getConfig", { url }),
      background<Config>("getUserConfig"),
    ]);
    emit({ config, raw: raw || {}, error: null });
  } catch (e) {
    emit({ error: (e as Error).message });
  }
}

/** Deep merge with the engine's semantics: objects merge, scalars and arrays replace. */
export function merge(base: Config, patch: Config): Config {
  const out: Config = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)
        ? merge(cur, v)
        : v;
  }
  return out;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Object patches merge into the stored overrides; a function receives a copy of
 * them and returns the complete replacement (used for removals).
 */
export function updateConfig(patch: Patch): Promise<void> {
  const run = async () => {
    const raw = (await background<Config>("getUserConfig")) || {};
    const next = typeof patch === "function" ? patch(structuredClone(raw)) : merge(raw, patch);
    await background("setUserConfig", next);
    await loadConfig();
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

/** Shorthand for generalRule["<key>.add"] overrides. */
export function ruleAdd(key: string, value: Config): Patch {
  return (raw) => ({
    ...raw,
    generalRule: {
      ...raw.generalRule,
      [`${key}.add`]: { ...raw.generalRule?.[`${key}.add`], ...value },
    },
  });
}

export function generalRule(value: Config): Patch {
  return (raw) => ({ ...raw, generalRule: { ...raw.generalRule, ...value } });
}

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.fullLocalUserConfig) void loadConfig();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useConfigState() {
  return useSyncExternalStore(subscribe, () => state);
}

/** For components rendered after the first load. */
export function useConfig(): Config {
  const s = useConfigState();
  if (!s.config) throw new Error("config not loaded");
  return s.config;
}

export function useRawConfig(): Config {
  return useConfigState().raw;
}
