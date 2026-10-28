import * as React from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  StarIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ServiceIcon, ServicePicker } from "@/components/service-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ruleAdd, updateConfig, useConfig, type Config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { canListModels, listModels, testService, type TestResult } from "@/lib/service-test";
import {
  SERVICE_KEYS,
  TEMPLATES,
  describe,
  templateLabel,
  getPath,
  managedServices,
  modelChoices,
  newServicePatch,
  selectServicePatch,
  serviceIcon,
  type Field,
  type ServiceItem,
  type ServiceKey,
  type ServiceType,
} from "@/lib/services";
import { cn } from "@/lib/utils";
import { navigate } from "../App";
import { Card, NumberField, Page, Row } from "../kit";

export function ServicesPage({ sub }: { sub?: string }) {
  const config = useConfig();
  if (sub && config.translationServices?.[sub]) return <ServiceDetail id={sub} />;
  return <ServiceList />;
}

/* ---------- list ---------- */

function ServiceList() {
  const config = useConfig();
  const { t, lang } = useI18n();
  const [adding, setAdding] = React.useState(false);
  const services = managedServices(config, lang);

  return (
    <Page
      title={t("nav.services")}
      description={t("services.description")}
      actions={
        <Button onClick={() => setAdding(true)}>
          <PlusIcon />
          {t("services.add")}
        </Button>
      }
    >
      <Card title={t("services.scenes")} description={t("services.scenesHint")}>
        <SceneRow label={t("scene.page")} serviceKey="translationService" />
        <SceneRow label={t("scene.input")} serviceKey="inputTranslationService" />
        <SceneRow label={t("scene.hover")} serviceKey="mouseHoverTranslationService" />
        <SceneRow label={t("scene.subtitle")} serviceKey="subtitleTranslateService" />
        <Row label={t("scene.selection")} description={t("scene.selectionHint")}>
          <ServicePicker
            className="w-56"
            config={config}
            value={config.generalRule?.selectionTranslation?.service || ""}
            noneLabel={t("scene.selectionAuto")}
            filter={(s) => !!s.template?.ai}
            onChange={(id) => updateConfig(ruleAdd("selectionTranslation", { service: id || undefined }))}
            aria-label={t("scene.selection")}
          />
        </Row>
      </Card>

      <Card title={t("services.mine")} description={t("services.mineHint")}>
        {services.map((s) => (
          <ServiceRow key={s.id} item={s} isDefault={config.translationService === s.id} />
        ))}
      </Card>

      <AddServiceDialog open={adding} onOpenChange={setAdding} />
    </Page>
  );
}

function SceneRow({ label, serviceKey }: { label: string; serviceKey: ServiceKey }) {
  const config = useConfig();
  const isMain = serviceKey === "translationService";
  return (
    <Row label={label}>
      <ServicePicker
        className="w-56"
        config={config}
        value={config[serviceKey] || (isMain ? "bing" : "inherit")}
        inherit={!isMain}
        onChange={(id) => updateConfig(selectServicePatch(serviceKey, id))}
        aria-label={label}
      />
    </Row>
  );
}

function ServiceRow({ item, isDefault }: { item: ServiceItem; isDefault: boolean }) {
  const { t, lang } = useI18n();
  const model = item.template?.ai ? String(item.config.model || "") : "";
  return (
    <a href={`#services/${encodeURIComponent(item.id)}`} className="group -mx-5 flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
      <ServiceIcon src={item.icon} className="size-8 rounded-md border bg-card p-1" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          {isDefault && (
            <Badge variant="accent">
              <StarIcon />
              {t("services.default")}
            </Badge>
          )}
          {item.config.visible === false && <Badge variant="outline">{t("services.hidden")}</Badge>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {item.template?.builtin ? t("services.builtin") : item.custom ? templateLabel(item.template!, lang) : t("services.legacy")}
          {model && <span className="font-mono"> · {model}</span>}
        </div>
      </div>
      {item.ready ? (
        <span className="inline-flex items-center gap-1 text-xs text-jade">
          <CheckCircle2Icon className="size-3.5" />
          {t("services.ready")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-ochre">
          <CircleAlertIcon className="size-3.5" />
          {t("service.needsSetup")}
        </span>
      )}
      <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function AddServiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const config = useConfig();
  const { t, lang } = useI18n();
  const add = async (type: ServiceType) => {
    const { id, patch } = newServicePatch(config, type);
    await updateConfig(patch);
    onOpenChange(false);
    navigate("services", id);
  };
  const group = (ai: boolean) => TEMPLATES.filter((x) => x.ai === ai && !x.builtin);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("services.add")}</DialogTitle>
          <DialogDescription>{t("services.addHint")}</DialogDescription>
        </DialogHeader>
        {[true, false].map((ai) => (
          <div key={String(ai)} className="flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">{ai ? t("services.groupAI") : t("services.groupMT")}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group(ai).map((tpl) => (
                <button
                  key={tpl.type}
                  type="button"
                  onClick={() => void add(tpl.type)}
                  className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/30 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ServiceIcon src={serviceIcon(tpl.type)} className="size-6" />
                  <span className="min-w-0 truncate font-medium">{templateLabel(tpl, lang)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- detail ---------- */

function useServiceSaver(id: string) {
  return React.useCallback(
    (path: string, value: unknown) =>
      updateConfig((raw: Config) => {
        const services: Config = { ...raw.translationServices };
        const entry: Config = structuredClone(services[id] || {});
        const keys = path.split(".");
        let node = entry;
        for (const k of keys.slice(0, -1)) node = node[k] = { ...(node[k] || {}) };
        const last = keys[keys.length - 1];
        if (value === undefined) delete node[last];
        else node[last] = value;
        services[id] = entry;
        return { ...raw, translationServices: services };
      }),
    [id],
  );
}

function ServiceDetail({ id }: { id: string }) {
  const config = useConfig();
  const { t, lang } = useI18n();
  const item = describe(config, id, lang);
  const save = useServiceSaver(id);
  const raw: Config = config.rawUserConfig?.translationServices?.[id] || {};
  const [advanced, setAdvanced] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const fields = item.template?.fields || [];
  const basic = fields.filter((f) => !f.advanced);
  const extra = fields.filter((f) => f.advanced);
  const isDefault = config.translationService === id;

  return (
    <Page
      title={item.name}
      description={
        <a href="#services" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("nav.services")}
        </a>
      }
      actions={
        <>
          {!isDefault && (
            <Button variant="outline" disabled={!item.ready} onClick={() => updateConfig(selectServicePatch("translationService", id))}>
              <StarIcon />
              {t("services.makeDefault")}
            </Button>
          )}
        </>
      }
    >
      <Card>
        <div className="flex items-center gap-4 py-4">
          <ServiceIcon src={item.icon} className="size-11 rounded-lg border bg-card p-1.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted-foreground">{item.template ? templateLabel(item.template, lang) : item.type}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {isDefault && (
                <Badge variant="accent">
                  <StarIcon />
                  {t("services.default")}
                </Badge>
              )}
              {item.ready ? <Badge variant="success">{t("services.ready")}</Badge> : <Badge variant="warning">{t("service.needsSetup")}</Badge>}
              {item.template?.ai && <Badge variant="outline">AI</Badge>}
            </div>
          </div>
          {item.template?.keyUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={item.template.keyUrl} target="_blank" rel="noreferrer">
                {t("services.getKey")}
                <ExternalLinkIcon />
              </a>
            </Button>
          )}
        </div>
        {item.custom && (
          <Row label={t("field.name")}>
            <TextField value={item.config.name || ""} onCommit={(v) => save("name", v.trim() || undefined)} className="w-72" />
          </Row>
        )}
        {item.template?.builtin && <Row label={t("services.noSetup")} description={t("services.noSetupHint")} />}
        {basic.map((f) => (
          <FieldRow key={f.name} field={f} item={item} raw={raw} save={save} />
        ))}
        <Row label={t("services.visible")} description={t("services.visibleHint")}>
          <Switch checked={item.config.visible !== false} onCheckedChange={(v) => save("visible", v)} aria-label={t("services.visible")} />
        </Row>
      </Card>

      {!item.template?.builtin && <TestCard item={item} />}

      {extra.length > 0 && (
        <Card
          title={
            <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced}>
              <ChevronRightIcon className={cn("size-4 transition-transform", advanced && "rotate-90")} />
              {t("services.advanced")}
            </button>
          }
          description={advanced ? t("services.advancedHint") : undefined}
          className={advanced ? undefined : "pb-3"}
        >
          {advanced && extra.map((f) => <FieldRow key={f.name} field={f} item={item} raw={raw} save={save} />)}
        </Card>
      )}

      {item.custom && (
        <Card>
          <Row label={t("services.delete")} description={t("services.deleteHint")}>
            <Button variant="outline" className="text-destructive" onClick={() => setDeleting(true)}>
              <Trash2Icon />
              {t("common.delete")}
            </Button>
          </Row>
        </Card>
      )}
      <DeleteDialog id={id} name={item.name} open={deleting} onOpenChange={setDeleting} />
    </Page>
  );
}

function FieldRow({ field, item, raw, save }: { field: Field; item: ServiceItem; raw: Config; save: (path: string, v: unknown) => Promise<void> }) {
  const config = useConfig();
  const { t } = useI18n();
  const value = getPath(item.config, field.name);
  const overridden = getPath(raw, field.name) !== undefined;
  const reset = field.kind === "textarea" && overridden && (
    <Button variant="ghost" size="sm" onClick={() => void save(field.name, undefined)}>
      <RotateCcwIcon />
      {t("common.reset")}
    </Button>
  );
  const hint = field.hint ? t(field.hint) : undefined;
  const label = (
    <>
      {t(field.label)}
      {field.required && <span className="ml-0.5 text-vermilion">*</span>}
    </>
  );

  switch (field.kind) {
    case "switch":
      return (
        <Row label={label} description={hint}>
          <Switch checked={!!value} onCheckedChange={(v) => void save(field.name, v)} aria-label={t(field.label)} />
        </Row>
      );
    case "select":
      return (
        <Row label={label} description={hint}>
          <Select value={String(value ?? field.options?.[0]?.value ?? "")} onValueChange={(v) => void save(field.name, v)}>
            <SelectTrigger className="w-48" aria-label={t(field.label)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {field.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t(o.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      );
    case "number":
      return (
        <Row label={label} description={hint}>
          <NumberField value={value == null || value === "" ? undefined : Number(value)} min={field.min} step={field.step} onCommit={(v) => save(field.name, v)} aria-label={t(field.label)} />
        </Row>
      );
    case "textarea":
      return (
        <Row label={label} description={hint} stack>
          <div className="flex w-full flex-col items-end gap-1">
            <TextField multiline value={String(value ?? "")} onCommit={(v) => save(field.name, v)} className="w-full" />
            {reset}
          </div>
        </Row>
      );
    case "model":
      return (
        <Row label={label} description={hint}>
          <ModelField item={item} value={String(value ?? "")} onCommit={(v) => save(field.name, v.trim() || undefined)} choices={modelChoices(config, item)} />
        </Row>
      );
    default:
      return (
        <Row label={label} description={hint}>
          <TextField
            value={String(value ?? "")}
            placeholder={field.placeholder}
            secret={field.kind === "password"}
            invalid={field.required && !value}
            onCommit={(v) => save(field.name, v.trim() || undefined)}
            className="w-72"
          />
        </Row>
      );
  }
}

function TextField({
  value,
  onCommit,
  placeholder,
  secret,
  multiline,
  invalid,
  className,
  list,
}: {
  value: string;
  onCommit: (v: string) => unknown;
  placeholder?: string;
  secret?: boolean;
  multiline?: boolean;
  invalid?: boolean;
  className?: string;
  list?: string;
}) {
  const { t } = useI18n();
  const [text, setText] = React.useState(value);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => setText(value), [value]);
  const commit = () => text !== value && void onCommit(text);
  if (multiline)
    return <Textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} rows={5} className={className} spellCheck={false} />;
  return (
    <div className={cn("relative", className)}>
      <Input
        type={secret && !shown ? "password" : "text"}
        value={text}
        list={list}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className={cn("font-mono text-[13px]", secret && "pr-9")}
      />
      {secret && (
        <button
          type="button"
          aria-label={shown ? t("common.hide") : t("common.show")}
          onClick={() => setShown((v) => !v)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        >
          {shown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      )}
    </div>
  );
}

function ModelField({ item, value, onCommit, choices }: { item: ServiceItem; value: string; onCommit: (v: string) => unknown; choices: string[] }) {
  const config = useConfig();
  const { t } = useI18n();
  const listId = React.useId();
  const [fetched, setFetched] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const all = [...new Set([...fetched, ...choices])];
  const fetchModels = async () => {
    setLoading(true);
    try {
      const list = await listModels(config, item.id);
      setFetched(list);
      toast.success(t("services.modelsLoaded", { n: list.length }));
    } catch (e) {
      toast.error(t("services.modelsFailed"), { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <TextField value={value} onCommit={onCommit} list={listId} className="w-60" />
      <datalist id={listId}>
        {all.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      {canListModels(item.type) && (
        <Button variant="outline" size="icon" onClick={fetchModels} disabled={loading} aria-label={t("services.fetchModels")} title={t("services.fetchModels")}>
          {loading ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
        </Button>
      )}
    </div>
  );
}

function TestCard({ item }: { item: ServiceItem }) {
  const config = useConfig();
  const { t } = useI18n();
  const [result, setResult] = React.useState<TestResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const run = async () => {
    setRunning(true);
    setResult(null);
    const r = await testService(config, item.id, config.targetLanguage || "zh-CN");
    setResult(r);
    setRunning(false);
    if (r.ok && item.config.visible === undefined) await updateConfig((raw: Config) => ({ ...raw, translationServices: { ...raw.translationServices, [item.id]: { ...raw.translationServices?.[item.id], visible: true } } }));
  };
  return (
    <Card>
      <Row label={t("services.test")} description={t("services.testHint")}>
        <Button variant="outline" onClick={run} disabled={running || !item.ready}>
          {running ? <Loader2Icon className="animate-spin" /> : <ZapIcon />}
          {t("services.runTest")}
        </Button>
      </Row>
      {result && (
        <div className="py-4">
          <div
            role="status"
            className={cn("rounded-lg border px-4 py-3 text-sm", result.ok ? "border-jade/30 bg-jade/8" : "border-destructive/30 bg-destructive/8")}
          >
            <div className={cn("flex items-center gap-2 font-medium", result.ok ? "text-jade" : "text-destructive")}>
              {result.ok ? <CheckCircle2Icon className="size-4" /> : <CircleAlertIcon className="size-4" />}
              {result.ok ? t("services.testOk") : t("services.testFailed")}
              <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">{result.ms} ms</span>
            </div>
            {result.text && <p className="mt-1.5 font-mono text-[13px] break-words whitespace-pre-wrap text-foreground/90">{result.text}</p>}
          </div>
        </div>
      )}
    </Card>
  );
}

function DeleteDialog({ id, name, open, onOpenChange }: { id: string; name: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const config = useConfig();
  const { t } = useI18n();
  const remove = async () => {
    await updateConfig((raw: Config) => {
      const services = { ...raw.translationServices };
      delete services[id];
      const next: Config = { ...raw, translationServices: services };
      const users: Config = raw.userTranslationServices && !Array.isArray(raw.userTranslationServices) ? { ...raw.userTranslationServices } : {};
      for (const key of SERVICE_KEYS) {
        if (config[key] === id || users[key] === id) {
          next[key] = key === "translationService" ? "bing" : "inherit";
          users[key] = next[key];
        }
      }
      next.userTranslationServices = users;
      const seg = raw.generalRule?.["subtitleRule.add"];
      if (seg?.aiSegmentService === id) next.generalRule = { ...raw.generalRule, "subtitleRule.add": { ...seg, aiSegmentService: "" } };
      return next;
    });
    onOpenChange(false);
    navigate("services");
    toast.success(t("services.deleted", { name }));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("services.deleteTitle", { name })}</DialogTitle>
          <DialogDescription>{t("services.deleteConfirm")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common.cancel")}</Button>
          </DialogClose>
          <Button variant="destructive" onClick={remove}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
