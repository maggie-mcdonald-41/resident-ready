const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const { requireFacultyCohortAccess } = require("./_shared/orgAccess");
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

function normalizeAction(action = "") {
  return String(action || "").trim().toLowerCase();
}

function upsertAssignmentIndex(index = {}, assignment = {}) {
  const assignments = Array.isArray(index.assignments) ? index.assignments : [];
  const withoutCurrent = assignments.filter(
    (item) => item.assignmentId !== assignment.assignmentId
  );

  return {
    ...(index || {}),
    version: 1,
    organizationId: assignment.organizationId,
    organizationName: assignment.organizationName,
    cohortId: index?.cohortId ?? null,
    cohortLabel: index?.cohortLabel ?? null,
    updatedAt: new Date().toISOString(),
    assignments: [assignment, ...withoutCurrent].sort((a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    )
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
    const assignmentId = sanitizeKeyFragment(body.assignmentId || "");
    const action = normalizeAction(body.action || "update");
    const title = normalizeText(body.title || "", 120);
    const instructions = normalizeText(body.instructions || "", 500);
    const dueDate = normalizeDate(body.dueDate || "");

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!assignmentId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "assignmentId is required."
      }));
    }

    if (!["update", "archive"].includes(action)) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Action must be update or archive."
      }));
    }

    if (action === "update" && !title) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Assignment title is required."
      }));
    }

    connectLambda(event);

    const assignmentStore = getStore("resident-ready-assignments");
    const organizationStore = getStore("resident-ready-organizations");

    const assignmentKey =
      `organizations/${organizationId}/assignments/${assignmentId}.json`;

    const assignment = await assignmentStore.get(assignmentKey, {
      type: "json"
    });

    if (!assignment) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Assignment not found."
      }));
    }

    await requireFacultyCohortAccess(
      requester,
      organizationId,
      assignment.cohortId
    );

    const now = new Date().toISOString();

    const updatedAssignment = {
      ...assignment,
      title: action === "update" ? title : assignment.title,
      instructions: action === "update" ? instructions : assignment.instructions,
      dueDate: action === "update" ? dueDate : assignment.dueDate,
      status: action === "archive" ? "archived" : assignment.status || "active",
      archivedAt: action === "archive" ? now : assignment.archivedAt || null,
      archivedByEmail: action === "archive" ? requester.email : assignment.archivedByEmail || null,
      updatedByUserId: requester.residentId,
      updatedByEmail: requester.email,
      updatedAt: now
    };

    const organizationIndexKey =
      `organizations/${organizationId}/assignments/index.json`;
    const cohortIndexKey =
      `organizations/${organizationId}/cohorts/${assignment.cohortId}/assignments/index.json`;

    const organizationIndex = await assignmentStore.get(organizationIndexKey, {
      type: "json"
    });

    const cohortIndex = await assignmentStore.get(cohortIndexKey, {
      type: "json"
    });

    await assignmentStore.setJSON(assignmentKey, updatedAssignment);

    if (organizationIndex) {
      await assignmentStore.setJSON(
        organizationIndexKey,
        upsertAssignmentIndex(organizationIndex, updatedAssignment)
      );
    }

    if (cohortIndex) {
      await assignmentStore.setJSON(
        cohortIndexKey,
        upsertAssignmentIndex(cohortIndex, updatedAssignment)
      );
    }

    const organizationKey = `organizations/${organizationId}.json`;
    const organization = await organizationStore.get(organizationKey, {
      type: "json"
    });

    if (organization) {
      await organizationStore.setJSON(organizationKey, {
        ...organization,
        updatedAt: now
      });
    }

    return withCors(jsonResponse(200, {
      success: true,
      action,
      assignment: updatedAssignment,
      message:
        action === "archive"
          ? `${updatedAssignment.title} was archived.`
          : `${updatedAssignment.title} was updated.`
    }));
  } catch (error) {
    console.error("[updateAssignment] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not update assignment."
    }));
  }
};