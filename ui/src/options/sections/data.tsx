import * as React from "react";
import { DownloadIcon, HistoryIcon, RotateCcwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { loadConfig, useRawConfig, type Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { background } from "@/lib/runtime";
import { backupConfig, clearCaches, configHistory, deleteHistory, download } from "@/lib/storage";
import { Card, Page, Row } from "../kit";

type Glossary = Config & { id: string; glossaries?: { k: string; v?: string; tl?: string }[] };

async function exportTerms() {
  const metas = (await background<Glossary[]>("queryAllTermsMeta").catch(() => [])) || [];
  const data: Glossary[] = [];
  for (const m of metas) {
    const g = await background<Glossary>("queryTerms", m.id).catch(() => null);
    if (g) data.push(g);
  }
  return data.length ? { version: 1, exportedAt: new Date().toISOString(), data } : null;
}

async function importTerms(terms: { version?: number; data?: Glossary[] }) {
  let count = 0;
  for (const g of terms?.data || []) {
    if (!g?.id) continue;
    const existing = await background<Glossary>("queryTerms", g.id).catch(() => null);
    if (existing) {
      const merged = new Map((existing.glossaries || []).map((e) => [`${e.k}\u0000${e.tl || ""}`, e]));
      for (const e of g.glossaries || []) merged.set(`${e.k}\u0000${e.tl || ""}`, e);
      await background("saveTerms", { ...g, glossaries: [...merged.values()], active: existing.active ?? g.active, useTermNameAsDomain: existing.useTermNameAsDomain ?? g.useTermNameAsDomain });
    } else {
      await background("saveTerms", { ...g, active: g.active ?? true, useTermNameAsDomain: g.useTermNameAsDomain ?? g.author !== "self" });
    }
    count++;
  }
  return count;
}

async function replaceConfig(next: Config, current: Config) {
  await backupConfig(current);
  if (current.DEBUG) next = { ...next, DEBUG: current.DEBUG };
  await background("setUserConfig", next);
  await loadConfig();
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function DataPage() {
  const raw = useRawConfig();
  const { t } = useI18n();
  const [withTerms, setWithTerms] = React.useState(true);
  const [history, setHistory] = React.useState<Config[]>([]);
  const [resetting, setResetting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const refreshHistory = React.useCallback(() => void configHistory().then(setHistory), []);
  React.useEffect(refreshHistory, [refreshHistory, raw]);

  const doExport = async () => {
    const out: Config = { ...raw };
    delete out.deletedAlwaysTranslatedUrls;
    if (withTerms) {
      const terms = await exportTerms();
      if (terms) out.terms = terms;
    }
    download(`owen-translation-config-${stamp()}.json`, JSON.stringify(out, null, 2));
  };

  const doImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      const { terms, ...config } = parsed as Config;
      delete config.deletedAlwaysTranslatedUrls;
      await replaceConfig(config, raw);
      const n = withTerms && terms ? await importTerms(terms) : 0;
      toast.success(n ? t("data.importedWithTerms", { n }) : t("data.imported"));
    } catch (e) {
      toast.error(t("data.importFailed"), { description: (e as Error).message });
    }
  };

  const doReset = async () => {
    await replaceConfig({ updatedAt: new Date().toISOString() }, raw);
    await background("setLocalConfig", {}).catch(() => {});
    await clearCaches();
    setResetting(false);
    toast.success(t("data.resetDone"));
  };

  return (
    <Page title={t("nav.data")} description={t("data.description")}>
      <Card title={t("data.file")}>
        <Row label={t("data.withTerms")} description={t("data.withTermsHint")}>
          <Switch checked={withTerms} onCheckedChange={setWithTerms} aria-label={t("data.withTerms")} />
        </Row>
        <Row label={t("data.export")} description={t("data.exportHint")}>
          <Button variant="outline" onClick={doExport}>
            <DownloadIcon />
            {t("data.exportAction")}
          </Button>
        </Row>
        <Row label={t("data.import")} description={t("data.importHint")}>
          <input ref={fileRef} type="file" accept="application/json,.json,text/plain" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0]).finally(() => (e.target.value = ""))} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            {t("data.importAction")}
          </Button>
        </Row>
      </Card>

      <Card title={t("data.history")} description={t("data.historyHint")}>
        {history.length === 0 ? (
          <p className="py-4 text-[13px] text-muted-foreground">{t("data.historyEmpty")}</p>
        ) : (
          history.map((h) => (
            <div key={h.updatedAt} className="flex items-center gap-3 py-3">
              <HistoryIcon className="size-4 text-muted-foreground" />
              <span className="flex-1 font-mono text-[13px]">{new Date(h.updatedAt).toLocaleString()}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await replaceConfig(h, raw);
                  toast.success(t("data.restored"));
                }}
              >
                <RotateCcwIcon />
                {t("data.restore")}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={t("common.delete")} onClick={() => void deleteHistory(h.updatedAt).then(refreshHistory)}>
                <Trash2Icon />
              </Button>
            </div>
          ))
        )}
      </Card>

      <Card>
        <Row label={t("data.reset")} description={t("data.resetHint")}>
          <Button variant="outline" className="text-destructive" onClick={() => setResetting(true)}>
            <RotateCcwIcon />
            {t("data.resetAction")}
          </Button>
        </Row>
      </Card>

      <details className="rounded-xl border bg-card px-5 py-3 text-sm">
        <summary className="cursor-pointer font-medium">{t("data.raw")}</summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">{JSON.stringify(raw, null, 2)}</pre>
      </details>

      <Dialog open={resetting} onOpenChange={setResetting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("data.resetTitle")}</DialogTitle>
            <DialogDescription>{t("data.resetConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("common.cancel")}</Button>
            </DialogClose>
            <Button variant="destructive" onClick={doReset}>
              {t("data.resetAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
