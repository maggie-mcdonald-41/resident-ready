//auth.js
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_ID =
  process.env.RESIDENT_READY_GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_CLIENT_ID ||
  "";

const SESSION_SECRET =
  process.env.RESIDENT_READY_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function requireEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function base64urlEncode(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64url");
}

function base64urlDecode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function sign(value) {
  requireEnv(SESSION_SECRET, "RESIDENT_READY_SESSION_SECRET");

  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

function sanitizeKeyFragment(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w\-@.]+/g, "_")
    .slice(0, 128);
}

function createResidentId(googleSub) {
  return sanitizeKeyFragment(`google_${googleSub}`);
}

async function verifyGoogleIdToken(idToken) {
  requireEnv(GOOGLE_CLIENT_ID, "RESIDENT_READY_GOOGLE_CLIENT_ID");

  if (!idToken) {
    throw new Error("Missing Google ID token.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Google ID token did not include required identity fields.");
  }

  return {
    residentId: createResidentId(payload.sub),
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name || "",
    picture: payload.picture || ""
  };
}

function createSessionToken(resident) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 7 * 24 * 60 * 60;

  const payload = {
    version: 1,
    residentId: resident.residentId,
    googleSub: resident.googleSub,
    email: resident.email,
    name: resident.name || "",
    picture: resident.picture || "",
    iat: now,
    exp: expiresAt
  };

  const encodedPayload = base64urlEncode(payload);
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt
  };
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    throw new Error("Missing or invalid session token.");
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = sign(encodedPayload);

  const actual = Buffer.from(signature || "");
  const expected = Buffer.from(expectedSignature || "");

  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    throw new Error("Invalid session signature.");
  }

  const payload = base64urlDecode(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) {
    throw new Error("Session token expired.");
  }

  if (!payload.residentId || !payload.email) {
    throw new Error("Session token missing resident identity.");
  }

  return payload;
}

function getBearerToken(event) {
  const header =
    event.headers.authorization ||
    event.headers.Authorization ||
    "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.replace("Bearer ", "").trim();
}

function requireResident(event) {
  const token = getBearerToken(event);
  return verifySessionToken(token);
}

module.exports = {
  verifyGoogleIdToken,
  createSessionToken,
  requireResident,
  sanitizeKeyFragment
};