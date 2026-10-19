import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite-конфиг веб-версии STOPBLOCK VPN.
// Данные — встроенный демо-бэкенд (localStorage), поэтому прокси на API не нужен.
//
// base — путь, с которого раздаётся сайт. Для GitHub Pages проекта
// (https://<user>.github.io/stopblock-site/) нужен подкаталог /stopblock-site/;
// можно переопределить: VITE_BASE=/my-path/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/stopblock-site/",
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  preview: {
    port: 4173,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
