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
    const facultyScope = getQueryParam(event, "facultyScope", "default");
    const residentId = getQueryParam(event, "residentId");
    const attemptId = getQueryParam(event, "attemptId");

    if (!residentId || !attemptId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Missing residentId or attemptId."
      }));
    }

    connectLambda(event);

    const store = getStore("resident-ready-faculty-attempt-details");

    let detailKey = `faculty/${facultyScope}/residents/${residentId}/attempts/${attemptId}.json`;

    if (organizationId) {
      detailKey = `organizations/${organizationId}/residents/${residentId}/attempts/${attemptId}.json`;
    }

    const detail = await store.get(detailKey, { type: "json" });

    if (organizationId && detail) {
      await requireFacultyCohortAccess(
        requester,
        organizationId,
        detail.cohortId || detail.assignmentContext?.cohortId || ""
      );
    }

    if (!detail) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Faculty-safe attempt detail not found."
      }));
    }

    return withCors(jsonResponse(200, {
      success: true,
      organizationId: organizationId || null,
      detailKey,
      detail
    }));
  } catch (error) {
    console.error("[getFacultyAttemptDetail] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load faculty-safe attempt detail."
    }));
  }
};