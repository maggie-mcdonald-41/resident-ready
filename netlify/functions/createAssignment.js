const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const {
  requireFacultyCohortAccess,
  canAccessCohort
} = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function normalizeText(value = "", maxLength = 240) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeDate(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return raw;
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function upsertAssignmentIndex(index = {}, assignment = {}) {
  const assignments = Array.isArray(index.assignments) ? index.assignments : [];
  const withoutCurrent = assignments.filter((item) => item.assignmentId !== assignment.assignmentId);

  return {
    ...(index || {}),
    version: 1,
    organizationId: assignment.organizationId,
    organizationName: assignment.organizationName,
    cohortId: assignment.cohortId,
    cohortLabel: assignment.cohortLabel,
    updatedAt: new Date().toISOString(),
    assignments: [assignment, ...withoutCurrent]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (event.httpMethod !== "POST") {
    return withCors(methodNotAllowed());
  }

  try {
    const requester = requireResident(event);
    const body = readJsonBody(event) || {};

    const organizationId = sanitizeKeyFragment(body.organizationId || "");
    const cohortId = sanitizeKeyFragment(body.cohortId || "");
    const title = normalizeText(body.title || "", 120);
    const activityType = normalizeText(body.activityType || "diagnostic", 40);
    const instructions = normalizeText(body.instructions || "", 500);
    const dueDate = normalizeDate(body.dueDate || "");

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!cohortId || cohortId === "all") {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Choose one cohort for this assignment."
      }));
    }

    if (!title) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Assignment title is required."
      }));
    }

    if (activityType !== "diagnostic") {
      return withCors(jsonResponse(400, {
        success: false,
        error: "This first assignment version supports diagnostic assignments only."
      }));
    }

    connectLambda(event);

    const membership = await requireFacultyCohortAccess(
      requester,
      organizationId,
      cohortId
    );

    if (!canAccessCohort(membership, cohortId)) {
      return withCors(jsonResponse(403, {
        success: false,
        error: "You do not have access to assign work for this cohort."
      }));
    }

    const organizationStore = getStore("resident-ready-organizations");
    const assignmentStore = getStore("resident-ready-assignments");

    const organization = await organizationStore.get(
      `organizations/${organizationId}.json`,
      { type: "json" }
    );

    if (!organization) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Organization not found."
      }));
    }

    const cohort = await organizationStore.get(
      `organizations/${organizationId}/cohorts/${cohortId}.json`,
      { type: "json" }
    );

    if (!cohort || cohort.status === "archived") {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Target cohort not found or archived."
      }));
    }

    const now = new Date().toISOString();
    const assignmentId = `assignment-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    const assignment = {
      version: 1,
      assignmentId,
      organizationId,
      organizationName: organization.organizationName,
      cohortId,
      cohortLabel: cohort.label || cohortId,
      title,
      activityType: "diagnostic",
      instructions,
      dueDate,
      status: "active",
      assignedResidentIds: Array.isArray(cohort.residentIds) ? uniqueValues(cohort.residentIds) : [],
      createdByUserId: requester.residentId,
      createdByEmail: requester.email,
      createdAt: now,
      updatedAt: now
    };

    const assignmentKey =
      `organizations/${organizationId}/assignments/${assignmentId}.json`;
    const organizationIndexKey =
      `organizations/${organizationId}/assignments/index.json`;
    const cohortIndexKey =
      `organizations/${organizationId}/cohorts/${cohortId}/assignments/index.json`;

    const organizationIndex = await assignmentStore.get(organizationIndexKey, {
      type: "json"
    });

    const cohortIndex = await assignmentStore.get(cohortIndexKey, {
      type: "json"
    });

    await assignmentStore.setJSON(assignmentKey, assignment);
    await assignmentStore.setJSON(
      organizationIndexKey,
      upsertAssignmentIndex(organizationIndex || {
        version: 1,
        organizationId,
        organizationName: organization.organizationName,
        cohortId: null,
        assignments: []
      }, assignment)
    );

    await assignmentStore.setJSON(
      cohortIndexKey,
      upsertAssignmentIndex(cohortIndex || {
        version: 1,
        organizationId,
        organizationName: organization.organizationName,
        cohortId,
        cohortLabel: cohort.label || cohortId,
        assignments: []
      }, assignment)
    );

    await organizationStore.setJSON(`organizations/${organizationId}.json`, {
      ...organization,
      updatedAt: now
    });

    return withCors(jsonResponse(200, {
      success: true,
      assignment,
      message: `${title} assigned to ${cohort.label || cohortId}.`
    }));
  } catch (error) {
    console.error("[createAssignment] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not create assignment."
    }));
  }
};