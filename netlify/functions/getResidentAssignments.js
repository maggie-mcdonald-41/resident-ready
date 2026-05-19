const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident } = require("./_shared/auth");
const { getUserMemberships } = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors
} = require("./_shared/http");

function getResidentMemberships(memberships = []) {
  return memberships.filter((membership) =>
    membership &&
    membership.status === "active" &&
    membership.role === "resident" &&
    membership.organizationId &&
    membership.activeCohortId
  );
}

function filterVisibleAssignments(assignments = [], membership = {}) {
  return assignments.filter((assignment) =>
    assignment &&
    assignment.status === "active" &&
    assignment.organizationId === membership.organizationId &&
    assignment.cohortId === membership.activeCohortId
  );
}

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

    const memberships = await getUserMemberships(resident);
    const residentMemberships = getResidentMemberships(memberships);

    if (!residentMemberships.length) {
      return withCors(jsonResponse(200, {
        success: true,
        assignments: []
      }));
    }

    const assignmentStore = getStore("resident-ready-assignments");

    const allAssignments = [];

    for (const membership of residentMemberships) {
      const indexKey =
        `organizations/${membership.organizationId}/cohorts/${membership.activeCohortId}/assignments/index.json`;

      const index = await assignmentStore.get(indexKey, { type: "json" });

      const visibleAssignments = filterVisibleAssignments(
        Array.isArray(index?.assignments) ? index.assignments : [],
        membership
      );

      visibleAssignments.forEach((assignment) => {
        allAssignments.push({
          ...assignment,
          residentMembership: {
            organizationId: membership.organizationId,
            organizationName: membership.organizationName,
            cohortId: membership.activeCohortId,
            cohortLabel: membership.activeCohortLabel
          }
        });
      });
    }

    allAssignments.sort((a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    return withCors(jsonResponse(200, {
      success: true,
      assignments: allAssignments
    }));
  } catch (error) {
    console.error("[getResidentAssignments] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load assigned work."
    }));
  }
};