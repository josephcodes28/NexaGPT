import { createRemoteJWKSet, jwtVerify } from "jose";

let remoteKeys;

function getKeys() {
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) {
    const error = new Error("NEON_AUTH_JWKS_URL is not configured.");
    error.status = 503;
    throw error;
  }
  if (!remoteKeys) remoteKeys = createRemoteJWKSet(new URL(url));
  return remoteKeys;
}

export async function requireUser(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    const error = new Error("Please sign in to use NexaGPT.");
    error.status = 401;
    throw error;
  }

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    const error = new Error("NEON_AUTH_BASE_URL is not configured.");
    error.status = 503;
    throw error;
  }

  const issuer = new URL(baseUrl).origin;
  let payload;
  try {
    ({ payload } = await jwtVerify(match[1], getKeys(), {
      issuer,
      algorithms: ["EdDSA"]
    }));
  } catch {
    const error = new Error("Your sign-in session is invalid or expired. Please sign in again.");
    error.status = 401;
    throw error;
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    const error = new Error("The sign-in token does not contain a valid account ID.");
    error.status = 401;
    throw error;
  }

  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null
  };
}
