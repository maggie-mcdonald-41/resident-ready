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

function getLatestAttemptByResidentForAssignment(attempts = [], assignmentId = "") {
  const latestByResident = new Map();

  attempts
    .filter((attempt) =>
      attempt.assignmentContext?.assignmentId === assignmentId ||
      attempt.assignmentId === assignmentId
    )
    .forEach((attempt) => {
      if (!attempt.residentId) return;

      const existing = latestByResident.get(attempt.residentId);
      const attemptTime = new Date(attempt.savedAt || 0).getTime();
      const existingTime = new Date(existing?.savedAt || 0).getTime();

      if (!existing || attemptTime > existingTime) {
        latestByResident.set(attempt.residentId, attempt);
      }
    });

  return latestByResident;
}

function buildCompletionRows(assignment = {}, rosterResidents = [], recentAttempts = []) {
  const latestByResident = getLatestAttemptByResidentForAssignment(
    recentAttempts,
    assignment.assignmentId
  );

  const assignedIds = new Set(
    Array.isArray(assignment.assignedResidentIds)
      ? assignment.assignedResidentIds.filter(Boolean)
      : []
  );

  rosterResidents.forEach((resident) => {
    if (resident?.residentId) assignedIds.add(resident.residentId);
  });

  latestByResident.forEach((attempt, residentId) => {
    if (residentId) assignedIds.add(residentId);
  });

  const residentLookup = new Map(
    rosterResidents
      .filter((resident) => resident?.residentId)
      .map((resident) => [resident.residentId, resident])
  );

  const rows = Array.from(assignedIds).map((residentId) => {
    const resident = residentLookup.get(residentId) || {};
    const attempt = latestByResident.get(residentId) || null;

    return {
      residentId,
      residentName:
        resident.residentName ||
        resident.displayName ||
        attempt?.residentName ||
        attempt?.residentEmail ||
        "Unnamed Resident",
      residentEmail:
        resident.residentEmail ||
        attempt?.residentEmail ||
        "No email",
      status: attempt ? "completed" : "not_started",
      percentCorrect: attempt?.percentCorrect ?? null,
      correctCount: attempt?.correctCount ?? null,
      totalQuestions: attempt?.totalQuestions ?? null,
      completedAt: attempt?.savedAt || null,
      attemptId: attempt?.id || null,
      facultyScope: attempt?.facultyScope || "default"
    };
  });

  return rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === "completed" ? -1 : 1;
    return String(a.residentName || a.residentEmail || "")
      .localeCompare(String(b.residentName || b.residentEmail || ""));
  });
}

function summarizeCompletion(rows = []) {
  const completedRows = rows.filter((row) => row.status === "completed");
  const scores = completedRows
    .map((row) => Number(row.percentCorrect))
    .filter((score) => Number.isFinite(score));

  return {
    assignedCount: rows.length,
    completedCount: completedRows.length,
    notStartedCount: rows.length - completedRows.length,
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null
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
    const requester = requireResident(event);
    const organizationId = sanitizeKeyFragment(getQueryParam(event, "organizationId", ""));
    const cohortId = sanitizeKeyFragment(getQueryParam(event, "cohortId", ""));

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    connectLambda(event);

    await requireFacultyCohortAccess(requester, organizationId, cohortId);

    const assignmentStore = getStore("resident-ready-assignments");
    const facultyIndexStore = getStore("resident-ready-faculty-indexes");

    const assignmentIndexKey =
      cohortId && cohortId !== "all"
        ? `organizations/${organizationId}/cohorts/${cohortId}/assignments/index.json`
        : `organizations/${organizationId}/assignments/index.json`;

    const rosterKey =
      cohortId && cohortId !== "all"
        ? `organizations/${organizationId}/cohorts/${cohortId}/roster.json`
        : `organizations/${organizationId}/roster.json`;

    const recentAttemptsKey =
      cohortId && cohortId !== "all"
        ? `organizations/${organizationId}/cohorts/${cohortId}/recent-attempts.json`
        : `organizations/${organizationId}/recent-attempts.json`;

    const assignmentIndex = await assignmentStore.get(assignmentIndexKey, {
      type: "json"
    });

    const roster = await facultyIndexStore.get(rosterKey, {
      type: "json"
    });

    const recentAttempts = await facultyIndexStore.get(recentAttemptsKey, {
      type: "json"
    });

    const rosterResidents = Array.isArray(roster?.residents)
      ? roster.residents
      : [];

    const attempts = Array.isArray(recentAttempts?.attempts)
      ? recentAttempts.attempts
      : [];

    const assignments = (Array.isArray(assignmentIndex?.assignments)
      ? assignmentIndex.assignments
      : []
    )
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => {
        const completionRows = buildCompletionRows(
          assignment,
          rosterResidents,
          attempts
        );

        return {
          ...assignment,
          completion: summarizeCompletion(completionRows),
          completionRows
        };
      });

    return withCors(jsonResponse(200, {
      success: true,
      organizationId,
      cohortId: cohortId || null,
      sourceKeys: {
        assignmentIndexKey,
        rosterKey,
        recentAttemptsKey
      },
      assignments
    }));
  } catch (error) {
    console.error("[getFacultyAssignments] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load faculty assignments."
    }));
  }
};