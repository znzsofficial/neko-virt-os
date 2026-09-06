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
      input: {
        main: "index.html",
        mmdVr: "mmd-vr.html",
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/]react-rnd[\\/]/.test(id)) return "vendor-windowing";
          if (/[\\/]node_modules[\\/](dexie|zustand)[\\/]/.test(id)) return "vendor-state";
          if (/[\\/]node_modules[\\/](@iconify-icon[\\/]react|clsx|react-hotkeys-hook)[\\/]/.test(id)) return "vendor-ui";
          if (/[\\/]node_modules[\\/]nanoid[\\/]/.test(id)) return "vendor-utils";
          if (/[\\/]node_modules[\\/]@yohawing[\\/]three-mmd-loader[\\/]/.test(id)) return "vendor-mmd";
          if (/[\\/]node_modules[\\/]postprocessing[\\/]/.test(id)) return "vendor-postfx";
          if (/[\\/]node_modules[\\/](@react-three[\\/][^\\/]+|three|three-stdlib)[\\/]/.test(id)) return "vendor-three";
          return undefined;
        },
      },
    },
  },
}));
