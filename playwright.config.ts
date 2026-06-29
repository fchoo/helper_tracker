import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1",
    env: {
      VITE_GOOGLE_CLIENT_ID: "1234567890-e2e.apps.googleusercontent.com",
      VITE_GOOGLE_PICKER_API_KEY: "picker_key_e2e",
      VITE_GOOGLE_PICKER_APP_ID: "404849934745",
    },
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
