import { defineConfig } from "cypress";

export default defineConfig({
  video: true,
  videoCompression: false,
  videosFolder: "artifacts/videos",
  screenshotsFolder: "artifacts/screenshots",
  e2e: {
    baseUrl: "http://127.0.0.1:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: false
  }
});
