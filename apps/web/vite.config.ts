import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/data": {
        target: "http://localhost:3001",
        rewrite: (path) => path.replace(/^\/api\/data/, ""),
      },
      "/api/auth": {
        target: "http://localhost:3002",
        rewrite: (path) => path.replace(/^\/api\/auth/, ""),
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});
