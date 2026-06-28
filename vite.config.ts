import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const githubPagesBase = "/helper_tracker/";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? githubPagesBase : "/",
  plugins: [react()],
});
