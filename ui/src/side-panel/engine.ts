import { useSyncExternalStore } from "react";
import type { Config } from "@/lib/config";

/*
 * The engine is the original side-panel.js bundle (see scripts/patch-sidepanel.cjs):
 * it translates, keeps the article terminology binding with the page and
 * answers the side panel's message channels. Its controller publishes state
 * here; the functions below are the ones its old UI called.
 */

export type Ctx = Config;

export interface EngineService {
  id: string;
  name: string;
  icon: string;
  ok: boolean;
  ai?: boolean;
  type?: string;
  config: Config;
}

export interface Glossary {
  id: string;
  name: string;
}

export interface Sentence {
  text: string;
  glossaries?: { k: string; v?: string }[];
}

export interface EngineError {
  message?: string;
  uiConfig?: (ctx: Ctx) => unknown;
}

export interface Result {
  text: string;
  translateText: string;
  service: string;
  targetLang: string;
  sourceLang?: string;
  loading: boolean;
  error?: EngineError;
  appliedGlossaries?: Glossary[];
  translatedSentences?: Sentence[];
  replaySnapshot?: { aiAssistantId?: string; glossaryIds?: string[] };
}

export interface RequestOptions {
  aiAssistantId?: string;
  glossaryIds?: string[];
}

export interface Tracker {
  beginGeneration(): number;
  invalidate(): void;
  startRequest(r: { generation: number; service: string; targetLang: string; sourceLang: string; text: string; requestOptions: RequestOptions }): unknown;
  isCurrent(r: unknown): boolean;
  currentGeneration(): number;
}

export interface LastTranslate {
  services?: string[];
  langs?: string[];
  sourceLang?: string;
  autoDetectLang?: string;
  professionalModeEnabled?: boolean;
  aiAssistantId?: string;
  glossaryIds?: string[];
  text?: string;
}

export interface Engine {
  translate(o: {
    ctx: Ctx;
    sourceLang: string;
    text: string;
    services: string[];
    targetLangs: string[];
    requestOptions: RequestOptions;
    replaySnapshot?: RequestOptions;
    metaResolvers: { getAppliedGlossaries(ids?: string[]): Glossary[] | undefined; getAppliedAssistant(id?: string): undefined };
    callback(r: Result): void;
  }): Promise<void>;
  lastTranslate(): Promise<LastTranslate | undefined>;
  saveLastTranslate(v: LastTranslate): Promise<void>;
  serviceItems(ctx: Ctx): Promise<EngineService[]>;
  knownServices(ctx: Ctx, ids?: string[]): string[];
  defaultService(ctx: Ctx): string;
  extraFreeServices(ctx: Ctx): string[];
  verifyService(ids: string[], ctx: Ctx): Promise<string | null>;
  normalizeTargets(services: string[], langs: string[], config: Config): string[];
  supportedTargets(services: string[], first: string, config: Config): string[];
  canTranslate(source: string, targets: string[]): boolean;
  detect(text: string): Promise<string>;
  removeNewLines(text: string): string;
  recentLanguages(scope: "source" | "target"): Promise<string[]>;
  addRecentLanguage(code: string, scope: "source" | "target"): Promise<string[]>;
  resultTracker(): Tracker;
  reusableResults(o: { currentResults: Result[]; services: string[]; sourceLang: string; targetLangs: string[]; text: string; requestOptions: RequestOptions }): {
    reusableResults: Result[];
    pendingTargets: { service: string; targetLang: string }[];
  };
  mergeResult(list: Result[], r: Result): Result[];
  glossaryItems(config: Config, lang: string): Promise<Glossary[]>;
  speak(text: string, lang: string, signal?: AbortSignal): unknown;
  copy(text: string): Promise<void>;
  errorInfo(error: EngineError, ctx: Ctx): { message: string; kind: string };
  openOptions(route: string): void;
}

export type Route = { name: "overview" } | { name: "termDetail"; termId: string } | { name: "saveTerms"; selectedTermIds?: string[] };

export interface Occurrence {
  id: string;
  paragraphId?: string;
  sourceText?: string;
  translatedText?: string;
}

export interface Term {
  id: string;
  source: string;
  target: string;
  origin: "ai_extracted" | "configured_glossary" | string;
  saveState: "unsaved" | "saving" | "saved" | "mixed" | "local_saved_sync_failed" | string;
  termName?: string;
  persistedIdentities?: { glossaryName?: string }[];
  occurrences: Occurrence[];
}

export interface Identity {
  translateId: string;
  url: string;
  translationService: string;
  targetLanguage: string;
  sourceLanguage?: string;
  interfaceLanguage?: string;
}

export interface Snapshot {
  identity: Identity;
  version: unknown;
  terms: Term[];
  coverage?: { termLimitReached?: boolean };
  capabilities?: { interactions?: string; canSave?: boolean; canEditCandidate?: boolean; canLocate?: boolean; canViewOccurrences?: boolean };
}

export interface Surface {
  status: "loading" | "ready" | "unavailable" | string;
  snapshot: Snapshot | null;
  binding: { route: Route; sourceTabId?: number };
  extractionEligibility?: { available?: boolean; highlightsEnabled?: boolean; currentUrlMatched?: boolean } | null;
  enablePending?: boolean;
}

export interface TermActions {
  changeRoute(route: Route): void;
  locateOccurrence(termId: string, occurrenceId: string, paragraphId?: string): Promise<void>;
  saveTerms(termIds: string[], glossaryId: string | undefined, version: unknown): Promise<void>;
  updateTermTarget(termId: string, target: string): Promise<Snapshot>;
  createGlossary(name: string): Promise<Glossary | undefined>;
}

export interface PanelState {
  theme?: string;
  ctx?: Ctx;
  config?: Config;
  tab: string;
  surface: Surface | null;
  glossaries: Glossary[];
  rtl: boolean;
  contentPanel: boolean;
  refresh?: () => void;
  leaveSurface(): void;
  actions: TermActions | null;
  toggleArticleTerminology(): Promise<boolean>;
}

declare global {
  interface Window {
    OwenSidePanel?: {
      bridge: { get(): PanelState | null; subscribe(f: () => void): () => void };
      engine: Engine;
    };
  }
}

const runtime = window.OwenSidePanel;

export const engine = runtime?.engine as Engine;

const noop = () => () => {};
export function usePanelState(): PanelState | null {
  return useSyncExternalStore(runtime?.bridge.subscribe ?? noop, () => runtime?.bridge.get() ?? null);
}
