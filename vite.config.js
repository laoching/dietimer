import { defineConfig } from "vite";

import aitDevtools from "@apps-in-toss/devtools/unplugin";

export default defineConfig({
  base: "./",
  plugins: [aitDevtools.vite()],
});
