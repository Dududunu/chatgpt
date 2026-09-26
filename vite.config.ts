import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), {
    name: "gym-pwa-precache-assets",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((fileName) => bundle[fileName].type === "chunk" || /\.(css|svg|png|webp|woff2?)$/i.test(fileName))
        .map((fileName) => `./${fileName}`);
      this.emitFile({ type: "asset", fileName: "sw-assets.json", source: JSON.stringify(assets) });
    }
  }],
  base: "./"
});