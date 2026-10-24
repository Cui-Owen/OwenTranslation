import * as React from "react";
import { DownloadIcon, PlusIcon, SearchIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { background } from "@/lib/runtime";
import { navigate } from "../App";
import { Card, Page, PatternList, Row, SwitchRow } from "../kit";

/*
 * Glossaries live in the background worker's local store. Entries are
 * {k: source, v: target, tl?: target language}; the engine applies active
 * glossaries whose site patterns match the page.
 */
type Entry = { k: string; v?: string; tl?: string };
type Glossary = Config & { id: string; name?: string; author?: string; active?: boolean; glossaries?: Entry[] };

const DEFAULT_SITES = ["https://archiveofourown.org/*"];

function siteOrigin(s: string): string | undefined {
  const v = s.trim();
  if (!v) return;
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:" ? `${u.origin}/*` : undefined;
  } catch {
    return;
  }
}

function useGlossaries() {
  const [list, setList] = React.useState<Glossary[] | null>(null);
  const reload = React.useCallback(async () => {
    const metas = (await background<Glossary[]>("queryAllTermsMeta").catch(() => [])) || [];
    setList([...metas].sort((a, b) => (a.author === "self" ? 0 : 1) - (b.author === "self" ? 0 : 1)));
  }, []);
  React.useEffect(() => void reload(), [reload]);
  return { list, reload };
}

function parseTable(text: string): Entry[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.includes("\t") ? line.split("\t") : line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "")) || [line];
      const clean = (c?: string) => (c || "").trim().replace(/^"|"$/g, "").replace(/""/g, '"');
      return { k: clean(cells[0]), v: clean(cells[1]) };
    })
    .filter((e) => e.k && !/^(source|原文|k)$/i.test(e.k));
}

function toCsv(entries: Entry[]) {
  const q = (s = "") => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["source,target", ...entries.map((e) => `${q(e.k)},${q(e.v)}`)].join("\n");
}

export function TermsPage({ sub }: { sub?: string }) {
  const config = useConfig();
  const { t } = useI18n();
  const raw: Config = config.rawUserConfig || {};
  const { list, reload } = useGlossaries();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const sites: string[] = Array.isArray(raw.articleTerminologyMatches) ? raw.articleTerminologyMatches : DEFAULT_SITES;

  const create = async (name: string, entries: Entry[] = []) => {
    const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await background("saveTerms", { id, name, description: "", matches: ["*"], author: "self", glossaries: entries, active: true, useTermNameAsDomain: false, lastUserOpTime: String(Date.now()) });
    await reload();
    navigate("terms", id);
  };

  const importFile = async (file: File) => {
    const entries = parseTable(await file.text());
    if (!entries.length) {
      toast.error(t("terms.importEmpty"));
      return;
    }
    await create(file.name.replace(/\.(csv|tsv|txt)$/i, ""), entries);
    toast.success(t("terms.imported", { n: entries.length }));
  };

  return (
    <Page
      title={t("nav.terms")}
      description={t("terms.description")}
      actions={
        <>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0]).finally(() => (e.target.value = ""))} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            {t("terms.importCsv")}
          </Button>
          <Button onClick={() => create(t("terms.untitled"))}>
            <PlusIcon />
            {t("terms.new")}
          </Button>
        </>
      }
    >
      <Card title={t("terms.glossaries")} description={t("terms.glossariesHint")}>
        {list === null ? (
          <p className="py-6 text-sm text-muted-foreground">…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">{t("terms.none")}</p>
        ) : (
          list.map((g) => (
            <div key={g.id} className="-mx-5 flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
              <a href={`#terms/${encodeURIComponent(g.id)}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{g.name || g.id}</div>
                <div className="truncate text-xs text-muted-foreground">{g.author === "self" ? t("terms.mine") : `@${g.author || "—"}`}</div>
              </a>
              <Switch
                checked={g.active !== false}
                aria-label={t("terms.active")}
                onCheckedChange={async (v) => {
                  const full = await background<Glossary>("queryTerms", g.id);
                  await background("saveTerms", { ...(full || g), active: v });
                  await reload();
                }}
              />
            </div>
          ))
        )}
      </Card>

      <Card title={t("terms.extraction")} description={t("terms.extractionHint")}>
        <SwitchRow label={t("terms.highlights")} description={t("terms.highlightsHint")} checked={raw.showArticleTerminologyHighlights !== false} onChange={(v) => updateConfig({ showArticleTerminologyHighlights: v })} />
        <SwitchRow label={t("terms.smart")} description={t("terms.smartHint")} checked={raw.enableArticleTerminology !== false} onChange={(v) => updateConfig({ enableArticleTerminology: v })} />
        <SwitchRow
          label={t("terms.results")}
          description={t("terms.resultsHint")}
          checked={raw.showArticleTerminologyExtractionResults !== false}
          onChange={(v) => updateConfig({ showArticleTerminologyExtractionResults: v })}
        />
        <Row label={t("terms.sites")} description={t("terms.sitesHint")} stack>
          <PatternList items={sites} normalize={siteOrigin} onChange={(items) => updateConfig({ articleTerminologyMatches: items })} />
        </Row>
      </Card>

      {sub && <GlossaryEditor id={sub} onClose={() => navigate("terms")} onChanged={reload} />}
    </Page>
  );
}

function GlossaryEditor({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => unknown }) {
  const { t } = useI18n();
  const [term, setTerm] = React.useState<Glossary | null>(null);
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<Entry>({ k: "", v: "" });
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const own = term?.author === "self";

  React.useEffect(() => {
    void background<Glossary>("queryTerms", id).then((g) => {
      if (!g) {
        toast.error(t("terms.notFound"));
        onClose();
        return;
      }
      setTerm(g);
      setEntries(g.glossaries || []);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!term) return;
    const add = draft.k.trim() ? [{ k: draft.k.trim(), v: (draft.v || "").trim() }] : [];
    await background("saveTerms", { ...term, glossaries: [...entries, ...add], lastUserOpTime: String(Date.now()) });
    await onChanged();
    toast.success(t("common.saved"));
    onClose();
  };

  const remove = async () => {
    await background("deleteTerms", id);
    await onChanged();
    onClose();
  };

  const shown = query ? entries.filter((e) => `${e.k} ${e.v}`.toLowerCase().includes(query.toLowerCase())) : entries;
  const addDraft = () => {
    if (!draft.k.trim()) return;
    setEntries((list) => [...list.filter((e) => e.k !== draft.k.trim()), { k: draft.k.trim(), v: (draft.v || "").trim() }]);
    setDraft({ k: "", v: "" });
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(entries)], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${term?.name || id}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{term?.name || "…"}</DialogTitle>
          <DialogDescription>{own ? t("terms.editHint") : t("terms.readonlyHint")}</DialogDescription>
        </DialogHeader>
        {term && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="glossary-name">{t("terms.name")}</Label>
                <Input id="glossary-name" value={term.name || ""} disabled={!own} onChange={(e) => setTerm({ ...term, name: e.target.value })} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch id="glossary-active" checked={term.active !== false} onCheckedChange={(v) => setTerm({ ...term, active: v })} />
                <Label htmlFor="glossary-active">{t("terms.active")}</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("terms.search", { n: entries.length })} className="pl-9" />
              </div>
              <Button variant="outline" onClick={exportCsv} disabled={!entries.length}>
                <DownloadIcon />
                CSV
              </Button>
            </div>

            <div className="max-h-[42vh] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("terms.source")}</th>
                    <th className="px-3 py-2 font-medium">{t("terms.target")}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {own && (
                    <tr className="bg-card">
                      <td className="px-2 py-1.5">
                        <Input value={draft.k} placeholder={t("terms.source")} onChange={(e) => setDraft({ ...draft, k: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addDraft()} className="h-8" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={draft.v} placeholder={t("terms.targetPlaceholder")} onChange={(e) => setDraft({ ...draft, v: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addDraft()} className="h-8" />
                      </td>
                      <td className="px-1">
                        <Button variant="ghost" size="icon-sm" onClick={addDraft} disabled={!draft.k.trim()} aria-label={t("common.add")}>
                          <PlusIcon />
                        </Button>
                      </td>
                    </tr>
                  )}
                  {shown.map((e) => (
                    <tr key={`${e.k}\u0000${e.tl || ""}`}>
                      <td className="px-3 py-2 break-all">{e.k}</td>
                      <td className="px-3 py-2 break-all text-muted-foreground">{e.v || <span className="italic opacity-60">{t("terms.keep")}</span>}</td>
                      <td className="px-1">
                        {own && (
                          <Button variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setEntries((list) => list.filter((x) => x !== e))}>
                            <XIcon />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter className="sm:justify-between">
          {own ? (
            confirmDelete ? (
              <Button variant="destructive" onClick={remove}>
                <Trash2Icon />
                {t("terms.confirmDelete")}
              </Button>
            ) : (
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon />
                {t("common.delete")}
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">{t("common.cancel")}</Button>
            </DialogClose>
            <Button onClick={save} disabled={!term}>
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
