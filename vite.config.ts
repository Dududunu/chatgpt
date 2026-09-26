import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const EXERCISE_IMAGE_ASSETS = [
  "./exercise-images/incline-db.webp",
  "./exercise-images/seal-row-db.webp",
  "./exercise-images/chinup.webp",
  "./exercise-images/cable-lateral.webp",
  "./exercise-images/hammer-rope.webp",
  "./exercise-images/rope-pushdown.webp",
  "./exercise-images/back-squat.webp",
  "./exercise-images/walking-lunge.webp",
  "./exercise-images/hip-thrust.webp",
  "./exercise-images/standing-calf.webp",
  "./exercise-images/leg-curl.webp",
  "./exercise-images/cable-crunch.webp",
  "./exercise-images/ohp.webp",
  "./exercise-images/bench.webp",
  "./exercise-images/single-pulldown.webp",
  "./exercise-images/pec-deck.webp",
  "./exercise-images/reverse-pec-deck.webp",
  "./exercise-images/incline-curl.webp",
  "./exercise-images/db-french.webp",
  "./exercise-images/rdl.webp",
  "./exercise-images/leg-press.webp",
  "./exercise-images/back-extension.webp",
  "./exercise-images/seated-calf.webp",
  "./exercise-images/leg-extension-uni.webp",
  "./exercise-images/farmer-single.webp"
];

export default defineConfig({
  plugins: [react(), {
    name: "gym-pwa-precache-assets",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = [...Object.keys(bundle)
        .filter((fileName) => bundle[fileName].type === "chunk" || /\.(css|svg|png|webp|woff2?)$/i.test(fileName))
        .map((fileName) => `./${fileName}`), ...EXERCISE_IMAGE_ASSETS];
      this.emitFile({ type: "asset", fileName: "sw-assets.json", source: JSON.stringify(assets) });
    }
  }],
  base: "./"
});
