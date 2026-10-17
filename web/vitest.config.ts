import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    env: {
      AWNING_DB: "memory",
      AWNING_FACILITATOR_URL: "mock",
      AWNING_PLUGIN_KEY: "test-plugin-key",
      AWNING_OWNER_TOKEN_SECRET: "test-owner-secret-0123456789abcdef",
      AWNING_TREASURY_ADDRESS: "0x4a8B4f274979d744B55f8d77FD5B1c5Ac1DD3C1e",
      AWNING_API_URL: "https://api.awning.sh",
      AWNING_FORCE_MOCKS: "1",
    },
  },
});
