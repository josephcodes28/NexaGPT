import { createInternalNeonAuth } from "@neondatabase/auth";

// Neon Auth URL is a public service endpoint, not a secret.
const authUrl = "https://ep-frosty-grass-b9wxmagb.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth";
const neonAuth = createInternalNeonAuth(authUrl);

window.NexaAuth = {
  adapter: neonAuth.adapter,
  getJWTToken: () => neonAuth.getJWTToken()
};
