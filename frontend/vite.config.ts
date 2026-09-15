import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
  ],

  server: {
    allowedHosts: [
      ".trycloudflare.com",
    ],

    proxy: {
      "/api": {
        target:
          "http://localhost:3000",

        changeOrigin:
          true,

        /*
         * Browser requests are same-origin through Vite.
         * The backend still receives its expected
         * development Origin for CSRF enforcement.
         */
        headers: {
          origin:
            "http://localhost:5173",
        },
      },
    },
  },
});
