import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    target: "esnext",
    rollupOptions: {
      input: { main: resolve("index.html"), admin: resolve("admin.html") },
    },
  },
});
