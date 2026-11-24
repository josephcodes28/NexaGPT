import { build } from "esbuild";

const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL;

if (!neonAuthBaseUrl || !neonAuthBaseUrl.trim()) {
  throw new Error(
    "NEON_AUTH_BASE_URL is not available during the build. Set it for the Vercel deployment environment and redeploy."
  );
}

await build({
  entryPoints: ["auth-client-entry.js"],
  outfile: "auth-client.bundle.js",
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  define: {
    __NEON_AUTH_BASE_URL__: JSON.stringify(neonAuthBaseUrl.trim())
  },
  logLevel: "info"
});
