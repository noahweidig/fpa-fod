import { defineConfig } from "astro/config";

// GitHub Pages project site: https://<owner>.github.io/<repo>/
// Override SITE/BASE in CI or locally for a custom domain (BASE="/").
export default defineConfig({
  site: process.env.SITE ?? "https://noahweidig.github.io",
  base: process.env.BASE ?? "/fpa-fod",
  trailingSlash: "ignore",
});
