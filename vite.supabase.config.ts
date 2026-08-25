import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "supabase-frontend",
  publicDir: "public",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: "../dist-supabase",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
});
