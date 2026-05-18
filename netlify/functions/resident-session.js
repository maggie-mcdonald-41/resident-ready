const { getStore, connectLambda } = require("@netlify/blobs");
const {
  verifyGoogleIdToken,
  createSessionToken
} = require("./_shared/auth");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (event.httpMethod !== "POST") {
    return withCors(methodNotAllowed());
  }

  try {
    const body = readJsonBody(event);

    if (!body) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Invalid JSON body."
      }));
    }

    const resident = await verifyGoogleIdToken(body.idToken);

    connectLambda(event);
    const store = getStore("resident-ready-accounts");

    const now = new Date().toISOString();
    const accountKey = `resident/${resident.residentId}/account.json`;

    const existingAccount = await store.get(accountKey, { type: "json" });

    const account = {
      ...(existingAccount || {}),
      residentId: resident.residentId,
      googleSub: resident.googleSub,
      email: resident.email,
      name: resident.name,
      picture: resident.picture,
      authProvider: "google",
      lastSignedInAt: now,
      createdAt: existingAccount?.createdAt || now,
      updatedAt: now
    };

    await store.setJSON(accountKey, account);

    const session = createSessionToken(resident);

    return withCors(jsonResponse(200, {
      success: true,
      resident: account,
      sessionToken: session.token,
      expiresAt: session.expiresAt
    }));
  } catch (error) {
    console.error("[resident-session] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not create resident session."
    }));
  }
};