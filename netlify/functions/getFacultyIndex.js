const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const { requireFacultyOrAdmin } = require("./_shared/orgAccess");
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
    const cohortId = sanitizeKeyFragment(getQueryParam(event, "cohortId", ""));
    const facultyScope = getQueryParam(event, "facultyScope", "default");

    connectLambda(event);

    const facultyIndexStore = getStore("resident-ready-faculty-indexes");

    let rosterKey = `faculty/${facultyScope}/roster.json`;
    let recentAttemptsKey = `faculty/${facultyScope}/recent-attempts.json`;

    if (organizationId) {
      await requireFacultyOrAdmin(requester, organizationId);

      if (cohortId && cohortId !== "all") {
        rosterKey = `organizations/${organizationId}/cohorts/${cohortId}/roster.json`;
        recentAttemptsKey = `organizations/${organizationId}/cohorts/${cohortId}/recent-attempts.json`;
      } else {
        rosterKey = `organizations/${organizationId}/roster.json`;
        recentAttemptsKey = `organizations/${organizationId}/recent-attempts.json`;
      }
    }

    const roster = await facultyIndexStore.get(rosterKey, { type: "json" });
    const recentAttempts = await facultyIndexStore.get(recentAttemptsKey, { type: "json" });

    return withCors(jsonResponse(200, {
      success: true,
      facultyScope,
      organizationId: organizationId || null,
      cohortId: cohortId || null,
      requester: {
        residentId: requester.residentId,
        email: requester.email
      },
      sourceKeys: {
        rosterKey,
        recentAttemptsKey
      },
      roster: roster || {
        version: 1,
        appName: "Resident Ready",
        facultyScope,
        organizationId: organizationId || null,
        cohortId: cohortId || null,
        residents: []
      },
      recentAttempts: recentAttempts || {
        version: 1,
        appName: "Resident Ready",
        facultyScope,
        organizationId: organizationId || null,
        cohortId: cohortId || null,
        attempts: []
      }
    }));
  } catch (error) {
    console.error("[getFacultyIndex] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load faculty index."
    }));
  }
};