import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@dolphin-id/core": fromRoot("./packages/core/src/index.ts"),
      "@dolphin-id/react": fromRoot("./packages/react/src/index.tsx"),
      "@dolphin-id/ui": fromRoot("./packages/ui/src/index.tsx"),
      "@dolphin-id/adapter-evm": fromRoot("./packages/adapter-evm/src/index.ts"),
      "@dolphin-id/adapter-sui": fromRoot("./packages/adapter-sui/src/index.ts"),
      "@dolphin-id/server": fromRoot("./packages/server/src/index.ts")
    }
  }
});
