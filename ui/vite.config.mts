import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Built into the extension root by scripts/build.cjs (OWEN_UI_OUT). Extension
// pages forbid inline scripts, so every chunk is an external module file.
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    outDir: process.env.OWEN_UI_OUT || resolve(__dirname, "dist"),
    emptyOutDir: false,
    assetsDir: "ui",
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    target: "chrome120",
    rolldownOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        "side-panel": resolve(__dirname, "side-panel.html"),
      },
      output: {
        entryFileNames: "ui/[name]-[hash].js",
        chunkFileNames: "ui/[name]-[hash].js",
        assetFileNames: "ui/[name]-[hash][extname]",
        // One vendor chunk shared by the pages; each page keeps its own code.
        codeSplitting: { groups: [{ name: "vendor", test: /node_modules/, minShareCount: 2 }, { name: "shared", test: /ui\/src\/(lib|components|generated)/, minShareCount: 2 }] },
      },
    },
  },
});
