//getResidentAttempts.js
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

    const detailStore = getStore("resident-ready-attempt-details");
    const indexStore = getStore("resident-ready-attempt-indexes");

    const indexKey = `resident/${resident.residentId}/index.json`;
    const index = await indexStore.get(indexKey, { type: "json" });

    const summaries = Array.isArray(index?.attempts) ? index.attempts : [];

    const attempts = [];

    for (const summary of summaries.slice(0, 50)) {
      if (!summary?.id) continue;

      const detailKey = `resident/${resident.residentId}/attempts/${summary.id}.json`;
      const record = await detailStore.get(detailKey, { type: "json" });

      if (record) {
        attempts.push(record);
      }
    }

    attempts.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

    return withCors(jsonResponse(200, {
      success: true,
      index: index || null,
      attempts
    }));
  } catch (error) {
    console.error("[getResidentAttempts] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load resident attempts."
    }));
  }
};