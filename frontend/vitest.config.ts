import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// No @vitejs/plugin-react here: it exists for Fast Refresh, which tests don't
// use, and its Vite 8 peer clashes with the Vite 7 that Vitest bundles. Vitest's
// esbuild transform already compiles .tsx using tsconfig's "jsx": "react-jsx".
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "@/*" -> "./src/*" mapping in tsconfig.json. Vitest
      // doesn't read tsconfig paths, so the two have to be kept in step.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
