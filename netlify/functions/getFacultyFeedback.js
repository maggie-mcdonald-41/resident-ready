const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const { requireFacultyCohortAccess } = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors
} = require("./_shared/http");

function getQueryParam(event, key, fallback = "") {
  return (event.queryStringParameters || {})[key] || fallback;
}

function filterFeedback(items = [], filters = {}) {
  return items
    .filter((item) => item && item.status !== "archived")
    .filter((item) => {
      if (filters.attemptId && item.attemptId !== filters.attemptId) return false;
      if (filters.assignmentId && item.assignmentId !== filters.assignmentId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (event.httpMethod !== "GET") {
    return withCors(methodNotAllowed());
  }

  try {
    const requester = requireResident(event);
    const organizationId = sanitizeKeyFragment(getQueryParam(event, "organizationId", ""));
    const residentId = sanitizeKeyFragment(getQueryParam(event, "residentId", ""));
    const cohortId = sanitizeKeyFragment(getQueryParam(event, "cohortId", ""));
    const attemptId = sanitizeKeyFragment(getQueryParam(event, "attemptId", ""));
    const assignmentId = sanitizeKeyFragment(getQueryParam(event, "assignmentId", ""));

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!residentId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "residentId is required."
      }));
    }

    if (!cohortId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "cohortId is required."
      }));
    }

    connectLambda(event);

    await requireFacultyCohortAccess(requester, organizationId, cohortId);

    const feedbackStore = getStore("resident-ready-feedback");
    const indexKey = `organizations/${organizationId}/residents/${residentId}/feedback/index.json`;

    const index = await feedbackStore.get(indexKey, {
      type: "json"
    });

    const feedback = filterFeedback(
      Array.isArray(index?.feedback) ? index.feedback : [],
      {
        attemptId,
        assignmentId
      }
    );

    return withCors(jsonResponse(200, {
      success: true,
      organizationId,
      residentId,
      cohortId,
      filters: {
        attemptId: attemptId || null,
        assignmentId: assignmentId || null
      },
      feedback
    }));
  } catch (error) {
    console.error("[getFacultyFeedback] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load faculty feedback history."
    }));
  }
};