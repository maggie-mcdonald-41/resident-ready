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

function getLatestAssignmentAttempt(attempts = [], assignmentId = "") {
  return attempts
    .filter((attempt) =>
      attempt &&
      (
        attempt.assignmentContext?.assignmentId === assignmentId ||
        attempt.assignmentId === assignmentId
      )
    )
    .sort((a, b) =>
      new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime()
    )[0] || null;
}

function getDueDateEndOfDay(value = "") {
  if (!value) return null;

  const parts = String(value).split("-").map(Number);

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [year, month, day] = parts;
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  date.setHours(23, 59, 59, 999);
  return date;
}

function getAssignmentCompletionStatus(assignment = {}, latestAttempt = null) {
  const dueEnd = getDueDateEndOfDay(assignment.dueDate);
  const now = new Date();

  if (!latestAttempt) {
    if (dueEnd && now.getTime() > dueEnd.getTime()) {
      return "past_due";
    }

    return "not_started";
  }

  const completedAt = new Date(latestAttempt.savedAt || 0);

  if (
    dueEnd &&
    !Number.isNaN(completedAt.getTime()) &&
    completedAt.getTime() > dueEnd.getTime()
  ) {
    return "completed_late";
  }

  return "completed";
}

function decorateAssignmentWithCompletion(assignment = {}, attempts = []) {
  const latestAttempt = getLatestAssignmentAttempt(attempts, assignment.assignmentId);
  const completionStatus = getAssignmentCompletionStatus(assignment, latestAttempt);

  if (!latestAttempt) {
    return {
      ...assignment,
      completionStatus,
      latestAttempt: null
    };
  }

  return {
    ...assignment,
    completionStatus,
    latestAttempt: {
      attemptId: latestAttempt.id,
      savedAt: latestAttempt.savedAt,
      percentCorrect: latestAttempt.percentCorrect,
      correctCount: latestAttempt.correctCount,
      totalQuestions: latestAttempt.totalQuestions,
      assignmentTitle: latestAttempt.assignmentTitle || assignment.title || ""
    }
  };
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