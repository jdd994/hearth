/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Hearth",
        short_name: "Hearth",
        description: "Tend and nourish yourself, gently.",
        theme_color: "#1A130D",
        background_color: "#1A130D",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Shell cached so logging works offline. The seed food data is bundled JS,
        // so it's precached too — lookups never need the network.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        navigateFallback: "index.html",
      },
      devOptions: { enabled: true },
    }),
  ],
  test: { globals: true, environment: "node", include: ["src/**/*.test.ts"] },
});
