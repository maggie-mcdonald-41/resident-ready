const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident } = require("./_shared/auth");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors
} = require("./_shared/http");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (event.httpMethod !== "GET") {
    return withCors(methodNotAllowed());
  }

  try {
    const resident = requireResident(event);

    connectLambda(event);
    const store = getStore("resident-ready-profiles");

    const profileKey = `resident/${resident.residentId}/profile.json`;
    const profile = await store.get(profileKey, { type: "json" });

    return withCors(jsonResponse(200, {
      success: true,
      profile: profile || null
    }));
  } catch (error) {
    console.error("[getResidentProfile] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load resident profile."
    }));
  }
};