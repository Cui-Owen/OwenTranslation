import * as React from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadConfig, useConfigState } from "@/lib/config";
import { followSystemTheme } from "@/lib/theme";
import "@/styles.css";

function Gate({ children }: { children: React.ReactNode }) {
  const { config, error } = useConfigState();
  React.useEffect(() => {
    if (config?.interfaceLanguage) document.documentElement.lang = config.interfaceLanguage;
  }, [config?.interfaceLanguage]);
  if (error && !config) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!config) return null;
  return <>{children}</>;
}

/** Shared page bootstrap: theme, first config load, providers. */
export function boot(app: React.ReactNode, pageUrl?: Promise<string | undefined>) {
  followSystemTheme();
  void (pageUrl ?? Promise.resolve(undefined)).then((url) => loadConfig(url));
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <TooltipProvider delayDuration={400}>
        <Gate>{app}</Gate>
      </TooltipProvider>
    </React.StrictMode>,
  );
}
