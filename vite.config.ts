// Interfaz web de Offside. El servidor (src/server) sirve lo compilado desde dist/.
// En desarrollo, Vite reenvía /api (incluido el flujo de eventos) a Offside en el puerto 3000.

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API = process.env.OFFSIDE_API ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: API,
        changeOrigin: true,
        // El flujo de eventos no se corta ni se acumula en el camino.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
});
