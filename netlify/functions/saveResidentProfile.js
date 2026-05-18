const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident } = require("./_shared/auth");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

const EDITABLE_FIELDS = [
  "displayName",
  "specialtyTrack",
  "programYear",
  "boardGoal",
  "preferredStudyStyle"
];

function cleanProfileInput(profile = {}) {
  const cleaned = {};

  EDITABLE_FIELDS.forEach((field) => {
    cleaned[field] = String(profile[field] || "").trim();
  });

  return cleaned;
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (event.httpMethod !== "POST") {
    return withCors(methodNotAllowed());
  }

  try {
    const resident = requireResident(event);
    const body = readJsonBody(event);

    if (!body) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Invalid JSON body."
      }));
    }

    const incomingProfile = cleanProfileInput(body.profile || {});
    const now = new Date().toISOString();

    connectLambda(event);
    const store = getStore("resident-ready-profiles");

    const profileKey = `resident/${resident.residentId}/profile.json`;
    const existingProfile = await store.get(profileKey, { type: "json" });

    const profile = {
      ...(existingProfile || {}),
      ...incomingProfile,
      authProvider: "google",
      userId: resident.googleSub,
      email: resident.email,
      pictureUrl: resident.picture || existingProfile?.pictureUrl || null,
      googleName: resident.name || existingProfile?.googleName || null,
      residentId: resident.residentId,
      updatedAt: now,
      createdAt: existingProfile?.createdAt || now
    };

    await store.setJSON(profileKey, profile);

    return withCors(jsonResponse(200, {
      success: true,
      profile
    }));
  } catch (error) {
    console.error("[saveResidentProfile] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not save resident profile."
    }));
  }
};