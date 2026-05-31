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

    const feedbackStore = getStore("resident-ready-feedback");
    const indexKey = `resident/${resident.residentId}/feedback/index.json`;

    const index = await feedbackStore.get(indexKey, {
      type: "json"
    });

    const feedback = Array.isArray(index?.feedback)
      ? index.feedback.filter((item) => item.status !== "archived")
      : [];

    return withCors(jsonResponse(200, {
      success: true,
      feedback
    }));
  } catch (error) {
    console.error("[getResidentFeedback] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load resident feedback."
    }));
  }
};