import { ArrowLeftIcon, Loader2Icon, Settings2Icon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { engine, usePanelState } from "./engine";
import { Terminology } from "./Terminology";
import { TextTranslate } from "./TextTranslate";

export function App() {
  const state = usePanelState();
  const { t } = useI18n();
  const surface = state?.surface;

  return (
    <div dir={state?.rtl ? "rtl" : "ltr"} className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
        {surface ? (
          <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 px-2 text-muted-foreground" onClick={() => state.leaveSurface()}>
            <ArrowLeftIcon />
            {t("panel.title")}
          </Button>
        ) : (
          <>
            <BrandMark className="size-[22px]" />
            <h1 className="font-serif text-[15px] font-black tracking-wider">{t("panel.title")}</h1>
          </>
        )}
        <span className="flex-1" />
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={t("popup.settings")} title={t("popup.settings")} onClick={() => engine.openOptions("")}>
          <Settings2Icon />
        </Button>
      </header>
      <main className="flex-1 px-4 py-4">
        {!state?.ctx ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ) : surface && state.actions ? (
          <Terminology state={state} surface={surface} actions={state.actions} />
        ) : (
          <TextTranslate ctx={state.ctx} />
        )}
      </main>
    </div>
  );
}
