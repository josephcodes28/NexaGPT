import { build } from "esbuild";

await build({
  entryPoints: ["auth-client-entry.js"],
  outfile: "auth-client.bundle.js",
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  logLevel: "info"
});
