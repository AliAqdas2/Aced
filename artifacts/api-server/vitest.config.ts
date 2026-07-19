import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Each test file runs in its own worker so vi.mock isolation is clean
    pool: "forks",
  },
});
