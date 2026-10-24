import { boot } from "@/components/boot";
import { activeTab } from "@/lib/runtime";
import { App } from "./App";

boot(<App />, activeTab().then((tab) => tab?.url));
