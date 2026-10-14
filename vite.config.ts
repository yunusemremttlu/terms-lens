import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(root, "popup.html"),
        options: resolve(root, "options.html"),
        demo: resolve(root, "demo.html")
      },
      output: {
        chunkFileNames: "assets/[name]-[hash].js"
      }
    },
    emptyOutDir: true
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
