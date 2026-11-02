import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": process.env.PORTFOLIO_API_TARGET ?? "http://127.0.0.1:4010",
      "/projects": process.env.PORTFOLIO_API_TARGET ?? "http://127.0.0.1:4010",
      "/pages": process.env.PORTFOLIO_API_TARGET ?? "http://127.0.0.1:4010",
      "/sitemap.xml":
        process.env.PORTFOLIO_API_TARGET ?? "http://127.0.0.1:4010",
      "/media": process.env.PORTFOLIO_API_TARGET ?? "http://127.0.0.1:4010",
    },
  },
});
