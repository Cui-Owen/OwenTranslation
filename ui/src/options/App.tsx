import * as React from "react";
import {
  BookMarkedIcon,
  CaptionsIcon,
  DatabaseIcon,
  GlobeIcon,
  InfoIcon,
  KeyboardIcon,
  LanguagesIcon,
  MousePointer2Icon,
  ServerIcon,
  SlidersHorizontalIcon,
  TextCursorInputIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Toaster } from "@/components/ui/sonner";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { extensionVersion } from "@/lib/runtime";
import { cn } from "@/lib/utils";
import { AboutPage } from "./sections/about";
import { DataPage } from "./sections/data";
import { GeneralPage } from "./sections/general";
import { HoverPage } from "./sections/hover";
import { InputPage } from "./sections/input";
import { PagePage } from "./sections/page";
import { SelectionPage } from "./sections/selection";
import { ServicesPage } from "./sections/services";
import { ShortcutsPage } from "./sections/shortcuts";
import { SubtitlePage } from "./sections/subtitle";
import { TermsPage } from "./sections/terms";

type Route = { id: string; label: MessageKey; icon: React.ComponentType<{ className?: string }>; page: React.ComponentType<{ sub?: string }> };

const GROUPS: { label: MessageKey; routes: Route[] }[] = [
  {
    label: "nav.translation",
    routes: [
      { id: "general", label: "nav.general", icon: LanguagesIcon, page: GeneralPage },
      { id: "services", label: "nav.services", icon: ServerIcon, page: ServicesPage },
      { id: "page", label: "nav.page", icon: GlobeIcon, page: PagePage },
      { id: "terms", label: "nav.terms", icon: BookMarkedIcon, page: TermsPage },
    ],
  },
  {
    label: "nav.interaction",
    routes: [
      { id: "selection_translation", label: "nav.selection", icon: TextCursorInputIcon, page: SelectionPage },
      { id: "mouse_hover", label: "nav.hover", icon: MousePointer2Icon, page: HoverPage },
      { id: "input", label: "nav.input", icon: KeyboardIcon, page: InputPage },
      { id: "subtitle", label: "nav.subtitle", icon: CaptionsIcon, page: SubtitlePage },
    ],
  },
  {
    label: "nav.more",
    routes: [
      { id: "shortcuts", label: "nav.shortcuts", icon: SlidersHorizontalIcon, page: ShortcutsPage },
      { id: "import_export", label: "nav.data", icon: DatabaseIcon, page: DataPage },
      { id: "about", label: "nav.about", icon: InfoIcon, page: AboutPage },
    ],
  },
];

const ROUTES = GROUPS.flatMap((g) => g.routes);
// Routes the previous settings page used, still linked from the side panel and page UI.
const ALIASES: Record<string, string> = { advanced: "page", ai: "services", download_config: "import_export" };

function parseHash(): { id: string; sub?: string } {
  const raw = decodeURIComponent(location.hash.replace(/^#/, "")).split("?")[0];
  const [head, ...rest] = raw.split("/");
  const id = ALIASES[head] || head;
  return ROUTES.some((r) => r.id === id) ? { id, sub: rest.join("/") || undefined } : { id: "general" };
}

export function useRoute() {
  const [route, setRoute] = React.useState(parseHash);
  React.useEffect(() => {
    const on = () => setRoute(parseHash());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function navigate(id: string, sub?: string) {
  location.hash = sub ? `${id}/${encodeURIComponent(sub)}` : id;
}

export function App() {
  const { t } = useI18n();
  const route = useRoute();
  const current = ROUTES.find((r) => r.id === route.id)!;
  const Page = current.page;

  React.useEffect(() => {
    document.title = `${t(current.label)} · ${t("app.name")}`;
    window.scrollTo({ top: 0 });
  }, [current, t]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="border-b bg-background md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
        <div className="flex h-full flex-col px-3 py-4 md:py-6">
          <a href="#general" className="mb-4 flex items-center gap-2.5 px-3 md:mb-6">
            <BrandMark className="size-7" />
            <span className="font-serif text-lg font-black tracking-wider">{t("app.name")}</span>
          </a>
          <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-1 md:flex-col md:gap-5 md:overflow-y-auto md:pb-0" aria-label={t("nav.settings")}>
            {GROUPS.map((g) => (
              <div key={g.label} className="flex shrink-0 gap-1 md:flex-col md:gap-0.5">
                <div className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase md:block">{t(g.label)}</div>
                {g.routes.map((r) => {
                  const active = r.id === current.id;
                  return (
                    <a
                      key={r.id}
                      href={`#${r.id}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                        active ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                      )}
                    >
                      {active && <span className="absolute top-2 bottom-2 left-0 hidden w-0.5 rounded-full bg-vermilion md:block" />}
                      <r.icon className="size-4 shrink-0" />
                      {t(r.label)}
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="hidden px-3 pt-4 font-mono text-[11px] text-muted-foreground md:block">{extensionVersion()}</div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">
        <Page sub={route.sub} />
      </main>
      <Toaster position="bottom-center" />
    </div>
  );
}
