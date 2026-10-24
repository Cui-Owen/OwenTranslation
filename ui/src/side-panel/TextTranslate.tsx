import * as React from "react";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  CopyIcon,
  CornerDownLeftIcon,
  EraserIcon,
  RotateCwIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { ServiceIcon } from "@/components/service-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { languageName } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { engine, type Ctx, type EngineService, type Glossary, type RequestOptions, type Result, type Sentence } from "./engine";

const NEWLINE_KEY = "isRemoveNewLine"; // shared with the previous panel

interface Prefs {
  services: string[];
  targets: string[];
  source: string; // "auto" or a language
  detected: string; // detected source while source is "auto"
  professional: boolean;
  glossaryIds: string[];
}

function useDebounced<T extends unknown[]>(fn: (...a: T) => void, ms: number) {
  const ref = React.useRef(fn);
  ref.current = fn;
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  return React.useCallback((...a: T) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => ref.current(...a), ms);
  }, [ms]);
}

export function TextTranslate({ ctx }: { ctx: Ctx }) {
  const { t, lang } = useI18n();
  const config = ctx.config;
  const [ready, setReady] = React.useState(false);
  const [items, setItems] = React.useState<EngineService[]>([]);
  const [glossaries, setGlossaries] = React.useState<Glossary[]>([]);
  const [text, setText] = React.useState("");
  const [removeNewLine, setRemoveNewLine] = React.useState(() => !!localStorage.getItem(NEWLINE_KEY));
  const prefs = React.useRef<Prefs>({ services: [], targets: [], source: "auto", detected: "auto", professional: true, glossaryIds: [] });
  const [, rerender] = React.useReducer((x: number) => x + 1, 0);
  const textRef = React.useRef(text);
  textRef.current = text;

  // Results of the last run: which services and languages it showed.
  const [results, setResults] = React.useState<Result[]>([]);
  const resultsRef = React.useRef<Result[]>([]);
  const [run, setRun] = React.useState<{ services: string[]; langs: string[]; source: string }>({ services: [], langs: [], source: "auto" });
  const tracker = React.useRef(engine.resultTracker());
  const composing = React.useRef(false);

  const glossaryById = React.useMemo(() => new Map(glossaries.map((g) => [g.id, g])), [glossaries]);
  const metaResolvers = React.useMemo(
    () => ({
      getAppliedGlossaries: (ids?: string[]) => {
        const list = (ids || []).map((id) => glossaryById.get(id)).filter((g): g is Glossary => !!g);
        return list.length ? list : undefined;
      },
      getAppliedAssistant: () => undefined,
    }),
    [glossaryById],
  );

  const persist = React.useCallback(() => {
    const p = prefs.current;
    p.targets = engine.normalizeTargets(p.services, p.targets, config);
    void engine.saveLastTranslate({
      services: p.services,
      langs: p.targets,
      sourceLang: p.source,
      autoDetectLang: p.detected,
      professionalModeEnabled: p.professional,
      aiAssistantId: undefined,
      glossaryIds: p.glossaryIds,
      text: "",
    });
    rerender();
  }, [config]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const last = await engine.lastTranslate();
      const p = prefs.current;
      if (last) {
        p.services = engine.knownServices(ctx, last.services);
        p.targets = engine.normalizeTargets(p.services, last.langs || [], config);
        p.source = last.sourceLang || "auto";
        p.detected = last.autoDetectLang || "auto";
        p.professional = last.professionalModeEnabled ?? true;
        p.glossaryIds = last.glossaryIds || [];
      } else {
        p.targets = [ctx.targetLanguage];
        p.services = [engine.defaultService(ctx)];
        for (const id of engine.extraFreeServices(ctx))
          void engine.verifyService([id], ctx).then((ok) => {
            if (ok && alive && !prefs.current.services.includes(id)) {
              prefs.current.services.push(id);
              persist();
            }
          });
      }
      const [list, terms] = await Promise.all([engine.serviceItems(ctx), engine.glossaryItems(config, lang)]);
      if (!alive) return;
      setItems(list);
      setGlossaries(terms);
      persist();
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [ctx, config, lang, persist]);

  const setResultList = (list: Result[]) => {
    resultsRef.current = list;
    setResults(list);
  };
  const merge = (r: Result) => setResultList(engine.mergeResult(resultsRef.current, r));

  const request = (service: string, targetLang: string, sourceLang: string, value: string, options: RequestOptions, generation: number) => {
    const handle = tracker.current.startRequest({ generation, service, targetLang, sourceLang, text: value, requestOptions: options });
    void engine.translate({
      ctx,
      sourceLang,
      text: value,
      services: [service],
      targetLangs: [targetLang],
      requestOptions: options,
      replaySnapshot: options,
      metaResolvers,
      callback: (r) => {
        if (!tracker.current.isCurrent(handle)) return;
        merge({ ...r, sourceLang, replaySnapshot: { aiAssistantId: options.aiAssistantId, glossaryIds: options.glossaryIds } });
      },
    });
  };

  const translate = () => {
    const p = prefs.current;
    p.targets = engine.normalizeTargets(p.services, p.targets, config);
    const source = p.source === "auto" ? p.detected : p.source;
    if (!engine.canTranslate(source, p.targets) || !textRef.current.trim()) {
      persist();
      return;
    }
    const value = removeNewLine ? engine.removeNewLines(textRef.current) : textRef.current;
    const options: RequestOptions = { aiAssistantId: undefined, glossaryIds: p.professional ? p.glossaryIds : undefined };
    const generation = tracker.current.beginGeneration();
    const { reusableResults, pendingTargets } = engine.reusableResults({
      currentResults: resultsRef.current,
      services: p.services,
      sourceLang: source,
      targetLangs: p.targets,
      text: value,
      requestOptions: options,
    });
    setRun({ services: [...p.services], langs: [...p.targets], source });
    setResultList(reusableResults);
    for (const { service, targetLang } of pendingTargets) request(service, targetLang, source, value, options, generation);
    persist();
  };

  const retry = (service: string, targetLang: string) => {
    const r = resultsRef.current.find((x) => x.service === service && x.targetLang === targetLang);
    if (!r) return;
    const options = { aiAssistantId: r.replaySnapshot?.aiAssistantId, glossaryIds: r.replaySnapshot?.glossaryIds || [] };
    request(service, targetLang, r.sourceLang || run.source, r.text, options, tracker.current.currentGeneration());
  };

  // Language detection follows the text, and keeps the target different from it.
  const detect = async (andTranslate = false) => {
    const p = prefs.current;
    if (p.source !== "auto" && !andTranslate) return;
    let current = p.source === "auto" ? p.detected : p.source;
    current = current === "auto" ? config.targetLanguage : current;
    const value = textRef.current;
    if (!value.trim()) {
      p.source = "auto";
      p.detected = "auto";
      persist();
      return;
    }
    let found = await engine.detect(value);
    p.detected = found;
    if (andTranslate) p.source = "auto";
    if (p.targets.includes(found) && (!p.targets.includes(current) || found === current)) {
      p.targets.splice(p.targets.indexOf(found), 1);
      if (found !== current) p.targets.unshift(current);
    }
    if (!p.targets.length) {
      if (found !== config.interfaceLanguage) found = config.interfaceLanguage;
      else found = found === "en" ? "zh-CN" : "en";
      p.targets = [found];
    }
    persist();
    if (andTranslate) translate();
  };
  const detectSoon = useDebounced(detect, 200);

  const swap = () => {
    const p = prefs.current;
    const source = p.source === "auto" ? p.detected : p.source;
    const first = p.targets[0];
    if (source === "placeholder" || !first || first === "placeholder") return;
    p.source = first;
    p.detected = "auto";
    p.targets = [source === "auto" ? config.interfaceLanguage : source];
    const prev = resultsRef.current.find((r) => r.targetLang === p.source && r.service === p.services[0]);
    if (prev?.translateText) setText(prev.translateText);
    persist();
  };

  const clear = () => {
    setText("");
    tracker.current.invalidate();
    setResultList([]);
    textRef.current = "";
    void detect();
  };

  const p = prefs.current;
  const sourceForCheck = p.source === "auto" ? p.detected : p.source;
  const canRun = engine.canTranslate(sourceForCheck, p.targets) && !!text.trim();
  const targetOptions = engine.supportedTargets(p.services, p.targets[0] || ctx.targetLanguage, config);
  const autoLabel = p.source === "auto" && p.detected !== "auto" ? t("lang.autoDetected", { name: languageName(p.detected, lang) }) : undefined;
  const shownServices = items.filter((s) => run.services.includes(s.id));

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs focus-within:border-foreground/25">
        <div className="flex items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
          <LanguagePicker
            size="sm"
            className="h-8 min-w-0 flex-1 border-transparent bg-transparent shadow-none hover:bg-card"
            value={p.source}
            allowAuto
            autoLabel={autoLabel}
            aria-label={t("panel.source")}
            onChange={(code) => {
              p.source = code;
              if (code !== "auto") p.detected = "auto";
              else void detect();
              persist();
              void engine.addRecentLanguage(code, "source");
            }}
          />
          <Button variant="ghost" size="icon-sm" onClick={swap} aria-label={t("panel.swap")} title={t("panel.swap")} className="shrink-0 text-muted-foreground">
            <ArrowLeftRightIcon className="size-3.5" />
          </Button>
          <LanguagePicker
            multiple
            size="sm"
            align="end"
            className="h-8 min-w-0 flex-1 justify-end border-transparent bg-transparent shadow-none hover:bg-card"
            values={p.targets}
            options={targetOptions}
            pinned={[ctx.targetLanguage, config.interfaceLanguage, "en"]}
            placeholder={<span className="text-ochre">{t("panel.pickTarget")}</span>}
            aria-label={t("panel.targets")}
            onValuesChange={(codes) => {
              p.targets = engine.normalizeTargets(p.services, codes, config);
              persist();
              void engine.addRecentLanguage(codes[codes.length - 1], "target");
            }}
          />
        </div>
        <Textarea
          value={text}
          placeholder={t("panel.placeholder")}
          rows={6}
          className="min-h-36 resize-y rounded-none border-0 bg-transparent px-4 py-3 font-sans text-[15px] leading-relaxed focus-visible:ring-0"
          onChange={(e) => {
            setText(e.target.value);
            textRef.current = e.target.value;
            if (!composing.current) detectSoon();
          }}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={() => {
            composing.current = false;
            detectSoon();
          }}
          onPaste={() => setTimeout(() => void detect(true), 0)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              translate();
            }
          }}
          aria-label={t("panel.placeholder")}
        />
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <ServiceMenu items={items} selected={p.services} onChange={(ids) => ((p.services = ids), persist())} disabled={!ready} />
          <OptionsMenu
            professional={p.professional}
            glossaryId={p.glossaryIds[0] || ""}
            glossaries={glossaries}
            removeNewLine={removeNewLine}
            onProfessional={(v) => ((p.professional = v), persist())}
            onGlossary={(id) => ((p.glossaryIds = id ? [id] : []), persist())}
            onRemoveNewLine={(v) => {
              setRemoveNewLine(v);
              localStorage.setItem(NEWLINE_KEY, v ? "true" : "");
            }}
          />
          <span className="flex-1" />
          {text && (
            <Button variant="ghost" size="icon-sm" onClick={clear} aria-label={t("panel.clear")} title={t("panel.clear")} className="text-muted-foreground">
              <EraserIcon />
            </Button>
          )}
          <Button size="sm" onClick={translate} disabled={!canRun}>
            {t("panel.translate")}
            <CornerDownLeftIcon className="size-3.5 opacity-70" />
          </Button>
        </div>
      </section>

      {results.length > 0 && (
        <div className="flex flex-col gap-3">
          {shownServices.map((s) => (
            <ServiceResults
              key={s.id}
              ctx={ctx}
              service={s}
              langs={run.langs}
              results={results}
              resolve={metaResolvers.getAppliedGlossaries}
              onRetry={(l) => retry(s.id, l)}
              onRemove={() => setRun((r) => ({ ...r, services: r.services.filter((x) => x !== s.id) }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceMenu({ items, selected, onChange, disabled }: { items: EngineService[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const chosen = items.filter((s) => selected.includes(s.id));
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    if (next.length) onChange(items.filter((s) => next.includes(s.id)).map((s) => s.id));
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-8 max-w-48 gap-1.5 px-2" aria-label={t("panel.services")}>
          <span className="flex -space-x-1">
            {chosen.slice(0, 3).map((s) => (
              <ServiceIcon key={s.id} src={s.icon} className="size-4 rounded-full bg-card ring-2 ring-card" />
            ))}
          </span>
          <span className="truncate text-xs">{chosen.length === 1 ? chosen[0].name : t("panel.servicesCount", { n: chosen.length })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("panel.servicesHint")}</div>
        <div className="max-h-72 overflow-y-auto">
          {items.map((s) => {
            const id = `svc-${s.id}`;
            return (
              <label key={s.id} htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox id={id} checked={selected.includes(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} />
                <ServiceIcon src={s.icon} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {!s.ok && <span className="text-xs text-ochre">{t("service.needsSetup")}</span>}
              </label>
            );
          })}
        </div>
        <div className="mt-1 border-t pt-1">
          <button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => engine.openOptions("#services")}>
            {t("service.manage")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const NONE = "__none";
const ADD = "__add";

function OptionsMenu(props: {
  professional: boolean;
  glossaryId: string;
  glossaries: Glossary[];
  removeNewLine: boolean;
  onProfessional(v: boolean): void;
  onGlossary(id: string): void;
  onRemoveNewLine(v: boolean): void;
}) {
  const { t } = useI18n();
  const active = (props.professional && !!props.glossaryId) || props.removeNewLine;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("panel.options")} title={t("panel.options")} className={cn("relative text-muted-foreground", active && "text-foreground")}>
          <SlidersHorizontalIcon />
          {active && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-vermilion" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex flex-col divide-y">
          <div className="flex flex-col gap-3 p-4">
            <label className="flex items-start gap-3">
              <span className="flex-1">
                <span className="block text-sm font-medium">{t("panel.professional")}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{t("panel.professionalHint")}</span>
              </span>
              <Switch checked={props.professional} onCheckedChange={props.onProfessional} aria-label={t("panel.professional")} />
            </label>
            <div className={cn("flex flex-col gap-1.5", !props.professional && "opacity-50")}>
              <span className="text-xs text-muted-foreground">{t("panel.glossary")}</span>
              <Select
                value={props.glossaryId || NONE}
                disabled={!props.professional}
                onValueChange={(v) => (v === ADD ? engine.openOptions("#terms") : props.onGlossary(v === NONE ? "" : v))}
              >
                <SelectTrigger size="sm" className="w-full" aria-label={t("panel.glossary")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("panel.noGlossary")}</SelectItem>
                  {props.glossaries.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={ADD} className="text-muted-foreground">
                    {t("terms.new")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-start gap-3 p-4">
            <span className="flex-1">
              <span className="block text-sm font-medium">{t("panel.smartWrap")}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">{t("panel.smartWrapHint")}</span>
            </span>
            <Switch checked={props.removeNewLine} onCheckedChange={props.onRemoveNewLine} aria-label={t("panel.smartWrap")} />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ServiceResults({
  ctx,
  service,
  langs,
  results,
  resolve,
  onRetry,
  onRemove,
}: {
  ctx: Ctx;
  service: EngineService;
  langs: string[];
  results: Result[];
  resolve: (ids?: string[]) => Glossary[] | undefined;
  onRetry: (lang: string) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const done = results.find((r) => r.service === service.id && !r.loading && !r.error && !!r.translateText);
  const applied = service.ai && done ? done.appliedGlossaries || resolve(done.replaySnapshot?.glossaryIds) : undefined;
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center gap-2 px-4 pt-3">
        <ServiceIcon src={service.icon} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted-foreground">{service.name}</span>
        {applied?.map((g) => (
          <Badge key={g.id} variant="accent" className="max-w-32 truncate">
            {g.name}
          </Badge>
        ))}
        <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" onClick={onRemove} aria-label={t("common.remove")}>
          <XIcon className="size-3.5" />
        </Button>
      </header>
      <div className="divide-y">
        {langs.map((l) => (
          <ResultBlock key={l} ctx={ctx} lang={l} result={results.find((r) => r.service === service.id && r.targetLang === l)} onRetry={() => onRetry(l)} showLang={langs.length > 1} />
        ))}
      </div>
    </section>
  );
}

function ResultBlock({ ctx, lang, result, onRetry, showLang }: { ctx: Ctx; lang: string; result?: Result; onRetry: () => void; showLang: boolean }) {
  const { t, lang: ui } = useI18n();
  const [copied, setCopied] = React.useState(false);
  const text = result?.translateText;
  const loading = !result || result.loading || (!text && !result.error);
  const rtl = (ctx.config?.rtlLanguages || []).includes(lang);
  const error = result?.error ? engine.errorInfo(result.error, ctx) : null;
  return (
    <div className="px-4 py-3">
      {loading && !error && (
        <div className="flex flex-col gap-2 py-1" aria-busy="true">
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      )}
      {text && !error && (
        <p dir={rtl ? "rtl" : "ltr"} className="text-[15px] leading-relaxed whitespace-pre-wrap select-text">
          <Highlighted sentences={result?.translatedSentences} fallback={text} />
        </p>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-[13px] text-destructive">
          <span className="min-w-0 flex-1 break-words">{error.message.replace(/<[^>]+>/g, "") || t("services.testFailed")}</span>
          {error.kind === "retry" ? (
            <Button variant="ghost" size="icon-sm" className="size-6 shrink-0 text-destructive" onClick={onRetry} aria-label={t("panel.retry")} title={t("panel.retry")}>
              <RotateCwIcon className="size-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon-sm" className="size-6 shrink-0 text-destructive" onClick={() => engine.openOptions("#services")} aria-label={t("service.manage")}>
              <Settings2Icon className="size-3.5" />
            </Button>
          )}
        </div>
      )}
      {text && !error && (
        <div className="mt-2 flex items-center gap-0.5 text-muted-foreground">
          <Button variant="ghost" size="icon-sm" className="size-7" onClick={() => void engine.speak(text, lang)} aria-label={t("panel.speak")} title={t("panel.speak")}>
            <Volume2Icon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={async () => {
              await engine.copy(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            aria-label={copied ? t("panel.copied") : t("panel.copy")}
            title={copied ? t("panel.copied") : t("panel.copy")}
          >
            {copied ? <CheckIcon className="size-3.5 text-jade" /> : <CopyIcon className="size-3.5" />}
          </Button>
          <span className="flex-1" />
          {showLang && <span className="text-xs">{languageName(lang, ui)}</span>}
        </div>
      )}
    </div>
  );
}

// Terms the translation used, marked where their translation appears.
function segments(s: Sentence) {
  const terms = (s.glossaries || [])
    .map((g) => ({ ...g, target: g.v || g.k }))
    .filter((g) => g.target)
    .sort((a, b) => b.target.length - a.target.length);
  if (!terms.length) return [{ text: s.text }];
  const out: { text: string; glossary?: { k: string; v?: string } }[] = [];
  const lower = s.text.toLowerCase();
  let at = 0;
  while (at < s.text.length) {
    let best: { index: number; term: (typeof terms)[number] } | null = null;
    for (const term of terms) {
      const i = lower.indexOf(term.target.toLowerCase(), at);
      if (i >= 0 && (!best || i < best.index || (i === best.index && term.target.length > best.term.target.length))) best = { index: i, term };
    }
    if (!best) {
      out.push({ text: s.text.slice(at) });
      break;
    }
    if (best.index > at) out.push({ text: s.text.slice(at, best.index) });
    out.push({ text: s.text.slice(best.index, best.index + best.term.target.length), glossary: best.term });
    at = best.index + best.term.target.length;
  }
  return out;
}

function Highlighted({ sentences, fallback }: { sentences?: Sentence[]; fallback: string }) {
  const { t } = useI18n();
  if (!sentences?.length) return <>{fallback.trim()}</>;
  return (
    <>
      {sentences.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && "\n"}
          {segments(s).map((seg, j) =>
            seg.glossary ? (
              <Tooltip key={j}>
                <TooltipTrigger asChild>
                  <mark className="rounded-sm bg-accent px-0.5 text-accent-foreground">{seg.text}</mark>
                </TooltipTrigger>
                <TooltipContent>{t("panel.termHint", { source: seg.glossary.k, target: seg.glossary.v || seg.glossary.k })}</TooltipContent>
              </Tooltip>
            ) : (
              <React.Fragment key={j}>{seg.text}</React.Fragment>
            ),
          )}
        </React.Fragment>
      ))}
    </>
  );
}
