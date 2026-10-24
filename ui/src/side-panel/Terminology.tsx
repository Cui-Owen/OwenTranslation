import * as React from "react";
import { ArrowLeftIcon, CheckCircle2Icon, ChevronRightIcon, CircleAlertIcon, CrosshairIcon, InfoIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { languageName } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { Glossary, Identity, PanelState, Route, Snapshot, Surface, Term, TermActions } from "./engine";

/*
 * Article terminology: terms the AI translation applied or extracted on the
 * page the panel is bound to. State and actions come from the engine's
 * controller; the rules below mirror the previous panel's view logic.
 */

const PAGE = 30;

function capabilities(s: Snapshot) {
  const c = s.capabilities;
  if (c?.interactions === "read_only_frame_aggregate") return { canSave: false, canEditCandidate: false, canLocate: false, canViewOccurrences: false };
  if (c?.interactions === "document_collection")
    return { canSave: c.canSave === true, canEditCandidate: c.canEditCandidate === true, canLocate: c.canLocate === true, canViewOccurrences: c.canViewOccurrences === true };
  return { canSave: true, canEditCandidate: true, canLocate: true, canViewOccurrences: true };
}
const isNew = (t: Term) => t.origin === "ai_extracted" && t.saveState === "unsaved";
const sameIdentity = (a: Identity, b: Identity) => a.translateId === b.translateId && a.url === b.url && a.translationService === b.translationService && a.targetLanguage === b.targetLanguage;

/** The route the snapshot can still show; detail of a vanished term falls back to the overview. */
function resolveRoute(s: Snapshot | null, r: Route): Route {
  if (!s) return r;
  if (!capabilities(s).canSave && r.name === "saveTerms") return { name: "overview" };
  if (r.name === "termDetail" && (s.capabilities?.interactions === "document_collection" || !s.terms.some((t) => t.id === r.termId))) return { name: "overview" };
  if (r.name === "saveTerms" && r.selectedTermIds) {
    const ids = new Set(s.terms.map((t) => t.id));
    const kept = r.selectedTermIds.filter((id) => ids.has(id));
    return kept.length === r.selectedTermIds.length ? r : { name: "saveTerms", selectedTermIds: kept };
  }
  return r;
}

function usePaging(identity: Identity, count: number) {
  const [state, setState] = React.useState({ identity, page: 0 });
  const raw = sameIdentity(state.identity, identity) ? state.page : 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE));
  const page = Math.min(Math.max(0, raw), pageCount - 1);
  return { page, pageCount, start: page * PAGE, setPage: (p: number) => setState({ identity, page: p }) };
}

function Pager({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (p: number) => void }) {
  const { t } = useI18n();
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3 pt-2 text-xs text-muted-foreground" aria-label={t("terms.pages")}>
      <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
        {t("terms.prev")}
      </Button>
      <span aria-live="polite" className="tabular-nums">
        {page + 1} / {pageCount}
      </span>
      <Button variant="ghost" size="sm" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)}>
        {t("terms.next")}
      </Button>
    </nav>
  );
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Mark({ text, term }: { text?: string; term: string }) {
  const needle = term.trim();
  if (!text || !needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escape(needle)})`, "giu"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-accent px-0.5 text-accent-foreground">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export function Terminology({ state, surface, actions }: { state: PanelState; surface: Surface; actions: TermActions }) {
  const { t } = useI18n();
  const { snapshot, binding, status } = surface;
  const route = resolveRoute(snapshot, binding.route);
  const [notice, setNotice] = React.useState<string | null>(null);

  // A detail whose term disappeared after a refresh goes back with a notice.
  React.useEffect(() => {
    if (route !== binding.route) {
      if (binding.route.name === "termDetail" && route.name === "overview") setNotice(t("tv.routeChanged"));
      actions.changeRoute(route);
    }
  }, [route, binding.route, actions, t]);
  React.useEffect(() => {
    if (route.name !== "overview") setNotice(null);
  }, [route.name]);

  const title = route.name === "termDetail" ? t("tv.detailTitle") : route.name === "saveTerms" ? t("tv.saveTitle") : t("tv.title");
  const elig = surface.extractionEligibility;
  const offerToggle = route.name === "overview" && elig?.available === true && elig?.highlightsEnabled === true && elig.currentUrlMatched === false;
  const unavailable = status === "unavailable" || (status === "ready" && !snapshot);

  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <header className="flex items-center gap-1">
        {route.name !== "overview" && (
          <Button variant="ghost" size="icon-sm" className="-ml-2" aria-label={t("tv.back")} onClick={() => actions.changeRoute({ name: "overview" })}>
            <ArrowLeftIcon />
          </Button>
        )}
        <h2 className="font-serif text-lg font-black tracking-wide">{title}</h2>
        {route.name === "overview" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="rounded-sm p-1 text-muted-foreground hover:text-foreground" aria-label={t("tv.extractedDescription")}>
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("tv.extractedDescription")}</TooltipContent>
          </Tooltip>
        )}
      </header>

      {offerToggle && (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t("terms.smart")}</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">{t("terms.smartHint")}</span>
          </span>
          <Switch checked={false} disabled={surface.enablePending} aria-busy={surface.enablePending} onCheckedChange={() => void state.toggleArticleTerminology()} aria-label={t("terms.smart")} />
        </div>
      )}

      {status === "loading" && <StateBlock icon={<Loader2Icon className="size-5 animate-spin" />} title={t("tv.loading")} />}
      {unavailable && <StateBlock icon={<CircleAlertIcon className="size-5" />} title={t("tv.unavailableTitle")} description={t("tv.unavailableDescription")} />}
      {notice && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          {notice}
        </p>
      )}

      {status === "ready" && snapshot && (
        route.name === "termDetail" ? (
          <TermDetail snapshot={snapshot} term={snapshot.terms.find((x) => x.id === route.termId)!} actions={actions} />
        ) : route.name === "saveTerms" ? (
          <SaveTerms snapshot={snapshot} selected={route.selectedTermIds} glossaries={state.glossaries} actions={actions} />
        ) : (
          <Overview snapshot={snapshot} actions={actions} />
        )
      )}
    </section>
  );
}

function StateBlock({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
    </div>
  );
}

function stateNote(term: Term, t: ReturnType<typeof useI18n>["t"]) {
  if (term.saveState === "saving") return t("tv.saving");
  if (term.saveState === "mixed") return term.persistedIdentities?.map((x) => x.glossaryName).filter(Boolean).join(" · ") || "—";
  return null;
}

function Overview({ snapshot, actions }: { snapshot: Snapshot; actions: TermActions }) {
  const { t } = useI18n();
  const caps = capabilities(snapshot);
  const collection = snapshot.capabilities?.interactions === "document_collection";
  const fresh = snapshot.terms.filter(isNew);
  const paging = usePaging(snapshot.identity, snapshot.terms.length);
  const terms = snapshot.terms.slice(paging.start, paging.start + PAGE);
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl bg-accent/60 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm">
          {t("tv.summaryPrefix")} <span className="font-semibold text-accent-foreground">{t("tv.summaryCount", { count: fresh.length })}</span>
        </p>
        {caps.canSave && fresh.length > 0 && (
          <Button size="sm" onClick={() => actions.changeRoute({ name: "saveTerms" })}>
            {t("tv.saveTerms")}
          </Button>
        )}
      </div>
      <section className="rounded-xl border bg-card">
        <header className="flex items-center gap-2 px-4 pt-3 pb-1">
          <h3 className="text-[13px] font-medium text-muted-foreground">{collection ? t("tv.extractedTitle") : t("tv.appliedTitle")}</h3>
          <Badge variant="outline">
            {snapshot.terms.length}
            {snapshot.coverage?.termLimitReached ? "+" : ""}
          </Badge>
        </header>
        {snapshot.terms.length ? (
          <ul className="divide-y">
            {terms.map((term) => {
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {isNew(term) && <Badge variant="accent">NEW</Badge>}
                      <span className="truncate text-sm">{term.source}</span>
                    </span>
                    <span className="block truncate text-sm font-medium">{term.target}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {stateNote(term, t) && <span>{stateNote(term, t)}</span>}
                    {!collection && term.occurrences.length > 0 && <span>{t("tv.usedCount", { count: term.occurrences.length })}</span>}
                    {!collection && <ChevronRightIcon className="size-4" />}
                  </span>
                </>
              );
              return (
                <li key={term.id}>
                  {collection ? (
                    <div className="flex items-center gap-3 px-4 py-2.5">{body}</div>
                  ) : (
                    <button type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50" onClick={() => actions.changeRoute({ name: "termDetail", termId: term.id })}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">{t("tv.appliedDescription")}</p>
        )}
        <Pager {...paging} />
      </section>
    </>
  );
}

function TermDetail({ snapshot, term, actions }: { snapshot: Snapshot; term: Term; actions: TermActions }) {
  const { t, lang } = useI18n();
  const caps = capabilities(snapshot);
  const [target, setTarget] = React.useState(term.target);
  const last = React.useRef(term.target);
  React.useEffect(() => {
    setTarget(term.target);
    last.current = term.target;
  }, [term.id, term.target]);
  const commit = () => {
    if (!target.trim() || target === term.target || target === last.current) return;
    last.current = target;
    actions.updateTermTarget(term.id, target).catch(() => (last.current = term.target));
  };
  const label = (base: string, code?: string) => {
    const c = code?.trim();
    return c && !["auto", "placeholder", "unknown"].includes(c) ? `${base}（${languageName(c, lang)}）` : base;
  };
  const needle = term.target.trim();
  const occurrences = term.occurrences.filter((o) => !!o.translatedText && !!needle && new RegExp(escape(needle), "iu").test(o.translatedText));
  return (
    <>
      <section className="rounded-xl border bg-card">
        <div className="px-4 py-3">
          <div className="text-xs text-muted-foreground">{label(t("tv.source"), snapshot.identity.sourceLanguage)}</div>
          <p className="mt-1 text-[15px]">{term.source}</p>
        </div>
        <div className="border-t px-4 py-3">
          <label className="text-xs text-muted-foreground" htmlFor="term-target">
            {label(t("tv.translation"), snapshot.identity.targetLanguage)}
          </label>
          {caps.canEditCandidate ? (
            <Input
              id="term-target"
              className="mt-1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.currentTarget as HTMLInputElement).blur())}
            />
          ) : (
            <p className="mt-1 text-[15px] font-medium">{term.target}</p>
          )}
        </div>
      </section>
      {caps.canViewOccurrences && (
        <section className="flex flex-col gap-2">
          <header className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium text-muted-foreground">{t("tv.matchPositions")}</h3>
            <Badge variant="outline">{t("tv.occurrenceTotal", { count: occurrences.length })}</Badge>
          </header>
          {occurrences.length ? (
            occurrences.map((o) => (
              <article key={o.id} className="relative rounded-xl border bg-card">
                <div className="px-4 py-3 pr-12 text-[13px] leading-relaxed">
                  <Mark text={o.sourceText} term={term.source} />
                </div>
                <div className="border-t px-4 py-3 pr-12 text-[13px] leading-relaxed">
                  <Mark text={o.translatedText} term={term.target} />
                </div>
                {caps.canLocate && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-2 right-2 text-muted-foreground"
                    aria-label={t("tv.locate")}
                    title={t("tv.locate")}
                    onClick={() => void actions.locateOccurrence(term.id, o.id, o.paragraphId)}
                  >
                    <CrosshairIcon />
                  </Button>
                )}
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-[13px] text-muted-foreground">{t("tv.noOccurrences")}</p>
          )}
        </section>
      )}
    </>
  );
}

const NEW_GLOSSARY = "__new";

function SaveTerms({ snapshot, selected, glossaries, actions }: { snapshot: Snapshot; selected?: string[]; glossaries: Glossary[]; actions: TermActions }) {
  const { t } = useI18n();
  const caps = capabilities(snapshot);
  const extracted = React.useMemo(() => snapshot.terms.filter((x) => x.origin === "ai_extracted"), [snapshot]);
  const savable = React.useMemo(() => snapshot.terms.filter(isNew), [snapshot]);
  const savableIds = React.useMemo(() => new Set(savable.map((x) => x.id)), [savable]);
  const paging = usePaging(snapshot.identity, extracted.length);
  const [chosen, setChosen] = React.useState<string[]>(() => selected?.filter((id) => savableIds.has(id)) || savable.map((x) => x.id));
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [created, setCreated] = React.useState<Glossary[]>([]);
  const [glossaryId, setGlossaryId] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const pending = React.useRef(new Map<string, { target: string; promise: Promise<Snapshot | undefined> }>());

  React.useEffect(() => setChosen((ids) => ids.filter((id) => savableIds.has(id))), [savableIds]);
  const all = [...glossaries, ...created.filter((g) => !glossaries.some((x) => x.id === g.id))];
  const state = chosen.length >= savable.length && savable.length > 0 ? true : chosen.length ? "indeterminate" : false;

  // Edited translations are stored before the save; the save uses the newest version.
  const pushTarget = (term: Term): Promise<Snapshot | undefined> => {
    const next = (edits[term.id] ?? term.target).trim();
    if (!next || next === term.target) return Promise.resolve(undefined);
    const inflight = pending.current.get(term.id);
    if (inflight?.target === next) return inflight.promise;
    const promise = actions.updateTermTarget(term.id, next).finally(() => {
      if (pending.current.get(term.id)?.promise === promise) pending.current.delete(term.id);
    });
    pending.current.set(term.id, { target: next, promise });
    return promise;
  };

  const save = async () => {
    if (!chosen.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      let version = snapshot.version;
      if (caps.canEditCandidate) for (const term of savable) if (chosen.includes(term.id)) version = (await pushTarget(term))?.version ?? version;
      await actions.saveTerms(chosen, glossaryId || undefined, version);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      setError(t("tv.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const createGlossary = async () => {
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const g = await actions.createGlossary(value);
      if (!g) throw new Error();
      setCreated((list) => (list.some((x) => x.id === g.id) ? list : [...list, g]));
      setGlossaryId(g.id);
      setName("");
      setCreating(false);
    } catch {
      setError(t("tv.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!extracted.length)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="text-[13px] text-muted-foreground">{t("tv.noSaveableTerms")}</p>
        <Button variant="outline" size="sm" onClick={() => actions.changeRoute({ name: "overview" })}>
          {t("tv.back")}
        </Button>
      </div>
    );

  const terms = extracted.slice(paging.start, paging.start + PAGE);
  return (
    <>
      <div className="flex items-center gap-2.5 px-1">
        <Checkbox
          checked={state}
          disabled={!savable.length}
          onCheckedChange={() => setChosen(state === true ? [] : savable.map((x) => x.id))}
          aria-label={state === true ? t("tv.deselectAll") : t("tv.selectAll")}
        />
        <p role="status" className="text-[13px] text-muted-foreground">
          {t("tv.selectedNewTerms", { count: chosen.length })}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {terms.map((term) => {
          const can = savableIds.has(term.id);
          const on = can ? chosen.includes(term.id) : term.saveState !== "unsaved" || term.origin === "configured_glossary";
          const note = term.saveState === "saving" ? t("tv.saving") : term.saveState === "local_saved_sync_failed" ? t("tv.savedSyncPending") : term.saveState === "saved" ? (term.termName ? t("tv.savedWithGlossary", { glossaryName: term.termName }) : t("tv.saved")) : "";
          return (
            <article key={term.id} className={cn("flex items-start gap-3 rounded-xl border bg-card px-4 py-3", on && can && "border-foreground/25", !can && "opacity-60")}>
              <Checkbox className="mt-0.5" checked={on} disabled={!can} onCheckedChange={() => setChosen((ids) => (ids.includes(term.id) ? ids.filter((x) => x !== term.id) : [...ids, term.id]))} aria-label={`${t("tv.source")}: ${term.source}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-muted-foreground">{term.source}</div>
                {caps.canEditCandidate ? (
                  <Input
                    className="mt-1 h-8 font-medium"
                    aria-label={t("tv.translation")}
                    value={edits[term.id] ?? term.target}
                    disabled={!can}
                    onChange={(e) => setEdits((x) => ({ ...x, [term.id]: e.target.value }))}
                    onBlur={() => void pushTarget(term).catch(() => setError(t("tv.saveFailed")))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.currentTarget as HTMLInputElement).blur())}
                  />
                ) : (
                  <div className="mt-1 text-sm font-medium">{term.target}</div>
                )}
              </div>
              {note && <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{note}</span>}
            </article>
          );
        })}
      </div>
      <Pager {...paging} />

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        {done && (
          <p role="status" className="flex items-center gap-1.5 text-[13px] text-jade">
            <CheckCircle2Icon className="size-4" />
            {t("common.saved")}
          </p>
        )}
        {creating ? (
          <div className="flex gap-2">
            <Input autoFocus value={name} placeholder={t("tv.glossaryNamePlaceholder")} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => (e.key === "Enter" ? void createGlossary() : e.key === "Escape" && setCreating(false))} />
            <Button variant="outline" onClick={() => void createGlossary()} disabled={!name.trim() || busy}>
              {t("common.add")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select value={glossaryId || "__default"} onValueChange={(v) => (v === NEW_GLOSSARY ? setCreating(true) : setGlossaryId(v === "__default" ? "" : v))}>
              <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={t("tv.chooseGlossary")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default">{t("tv.defaultGlossary")}</SelectItem>
                {all.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={NEW_GLOSSARY}>
                  <PlusIcon />
                  {t("tv.createGlossary")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => void save()} disabled={!chosen.length || busy} aria-busy={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              {t("common.add")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
