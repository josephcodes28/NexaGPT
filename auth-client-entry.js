import { createInternalNeonAuth } from "@neondatabase/auth";

// Injected at build time by Vercel for the current deployment.
// Neon may provide a different Auth endpoint for each Preview deployment.
const authUrl = __NEON_AUTH_BASE_URL__;

if (typeof authUrl !== "string" || !authUrl.trim()) {
  throw new Error(
    "NEON_AUTH_BASE_URL is missing for this deployment. Configure it in Vercel and redeploy."
  );
}

const neonAuth = createInternalNeonAuth(authUrl);

window.NexaAuth = {
  adapter: neonAuth.adapter,
  getJWTToken: () => neonAuth.getJWTToken()
};
