import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { reporter: ["text", "html"] },
    // Process the content stylesheet so tests can load it with `?raw` and
    // check which rows the triage views hide.
    css: { include: [/src\/content\/content\.css/] },
  },
});
