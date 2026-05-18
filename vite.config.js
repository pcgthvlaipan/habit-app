import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["ios >= 13", "safari >= 13"],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
  ],
  build: {
    target: "es2015",
    minify: "esbuild",
  },
  esbuild: {
    target: "es2015",
  },
});
