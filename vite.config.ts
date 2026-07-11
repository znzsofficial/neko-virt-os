import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-rnd")) return "vendor-windowing";
          if (id.includes("dexie") || id.includes("zustand")) return "vendor-state";
          if (id.includes("@iconify-icon/react") || id.includes("clsx") || id.includes("react-hotkeys-hook")) return "vendor-ui";
          if (id.includes("nanoid")) return "vendor-utils";
          return undefined;
        },
      },
    },
  },
}));
