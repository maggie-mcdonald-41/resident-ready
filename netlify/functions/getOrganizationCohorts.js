const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const { requireFacultyOrAdmin } = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors
} = require("./_shared/http");

function getOrganizationId(event) {
  const params = event.queryStringParameters || {};
  return sanitizeKeyFragment(params.organizationId || "");
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
    const organizationId = getOrganizationId(event);

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    connectLambda(event);

    const membership = await requireFacultyOrAdmin(requester, organizationId);

    const organizationStore = getStore("resident-ready-organizations");
    const organization = await organizationStore.get(`organizations/${organizationId}.json`, {
      type: "json"
    });

    if (!organization) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Organization not found."
      }));
    }

    const cohortIndex = await organizationStore.get(
      `organizations/${organizationId}/cohorts/index.json`,
      { type: "json" }
    );

    const allCohorts = Array.isArray(cohortIndex?.cohorts)
      ? cohortIndex.cohorts
      : [];

    const visibleCohorts =
      membership.role === "faculty"
        ? allCohorts.filter((cohort) => {
            const assignedCohortIds = Array.isArray(membership.assignedCohortIds)
              ? membership.assignedCohortIds
              : [];

            return (
              cohort.status !== "archived" &&
              assignedCohortIds.includes(cohort.cohortId)
            );
          })
        : allCohorts;

    return withCors(jsonResponse(200, {
      success: true,
      organization: {
        organizationId,
        organizationName: organization.organizationName
      },
      cohorts: visibleCohorts
    }));
  } catch (error) {
    console.error("[getOrganizationCohorts] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load organization cohorts."
    }));
  }
};