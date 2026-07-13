/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
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
          if (id.includes("@yohawing/three-mmd-loader")) return "vendor-mmd";
          if (id.includes("postprocessing")) return "vendor-postfx";
          if (id.includes("@react-three") || id.includes("three")) return "vendor-three";
          return undefined;
        },
      },
    },
  },
}));
