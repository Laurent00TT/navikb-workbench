import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.KB_UI_API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  base: "/ui/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/ui/api": apiTarget,
      "/ingestion": apiTarget
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
