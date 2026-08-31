import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // react() compiles JSX for the component tests.
  plugins: [react()],
  // Resolves the `@/*` alias from tsconfig.json natively -- supersedes the
  // vite-tsconfig-paths plugin the Next.js guide still recommends.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // `node` stays the default so `engine/` tests keep proving they need no
    // browser (AD-1). Component tests opt in per file with a
    // `// @vitest-environment jsdom` docblock.
    environment: "node",
  },
});
