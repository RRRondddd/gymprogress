import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:4173/gymprogress/",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173/gymprogress/",
    reuseExistingServer: true,
  },
});
