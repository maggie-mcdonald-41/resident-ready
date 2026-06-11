const crypto = require("crypto");
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

function normalizeMessage(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 1200);
}

function normalizeScope(value = "") {
  const scope = String(value || "").trim().toLowerCase();
  return scope === "cohort" ? "cohort" : "resident";
}

function upsertFeedbackIndex(index = {}, feedback = {}) {
  const items = Array.isArray(index.feedback) ? index.feedback : [];
  const withoutCurrent = items.filter((item) => item.feedbackId !== feedback.feedbackId);

  return {
    ...(index || {}),
    version: 1,
    residentId: feedback.residentId,
    updatedAt: new Date().toISOString(),
    feedback: [feedback, ...withoutCurrent]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  };
}

function getResidentDisplayName(resident = {}, residentId = "") {
  return (
    resident.residentName ||
    resident.displayName ||
    resident.residentEmail ||
    resident.email ||
    residentId ||
    "Resident"
  );
}

function getResidentEmail(resident = {}) {
  return resident.residentEmail || resident.email || "";
}

async function saveFeedbackForResident({
  feedbackStore,
  baseFeedback,
  resident,
  residentId
}) {
  const feedbackId = `feedback-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  const feedback = {
    ...baseFeedback,
    feedbackId,
    residentId,
    residentName: getResidentDisplayName(resident, residentId),
    residentEmail: getResidentEmail(resident)
  };

  const feedbackKey =
    `organizations/${feedback.organizationId}/residents/${residentId}/feedback/${feedbackId}.json`;

  const residentFeedbackIndexKey =
    `resident/${residentId}/feedback/index.json`;

  const organizationResidentFeedbackIndexKey =
    `organizations/${feedback.organizationId}/residents/${residentId}/feedback/index.json`;

  const residentIndex = await feedbackStore.get(residentFeedbackIndexKey, {
    type: "json"
  });

  const organizationResidentIndex = await feedbackStore.get(organizationResidentFeedbackIndexKey, {
    type: "json"
  });

  await feedbackStore.setJSON(feedbackKey, feedback);

  await feedbackStore.setJSON(
    residentFeedbackIndexKey,
    upsertFeedbackIndex(residentIndex || {
      version: 1,
      residentId,
      feedback: []
    }, feedback)
  );

  await feedbackStore.setJSON(
    organizationResidentFeedbackIndexKey,
    upsertFeedbackIndex(organizationResidentIndex || {
      version: 1,
      residentId,
      organizationId: feedback.organizationId,
      feedback: []
    }, feedback)
  );

  return feedback;
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
    const residentId = sanitizeKeyFragment(body.residentId || "");
    const scope = normalizeScope(body.scope || "resident");
    const message = normalizeMessage(body.message || "");

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!cohortId || cohortId === "all") {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Choose one cohort before sending feedback."
      }));
    }

    if (scope === "resident" && !residentId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Choose a resident before sending individual feedback."
      }));
    }

    if (!message) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Enter feedback before sending."
      }));
    }

    connectLambda(event);

    await requireFacultyCohortAccess(requester, organizationId, cohortId);

    const organizationStore = getStore("resident-ready-organizations");
    const facultyIndexStore = getStore("resident-ready-faculty-indexes");
    const feedbackStore = getStore("resident-ready-feedback");

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

    const roster = await facultyIndexStore.get(
      `organizations/${organizationId}/cohorts/${cohortId}/roster.json`,
      { type: "json" }
    );

    const rosterResidents = Array.isArray(roster?.residents)
      ? roster.residents
      : [];

    const rosterLookup = new Map(
      rosterResidents
        .filter((resident) => resident?.residentId)
        .map((resident) => [resident.residentId, resident])
    );

    const targetResidentIds =
      scope === "cohort"
        ? Array.from(new Set([
            ...(Array.isArray(cohort.residentIds) ? cohort.residentIds : []),
            ...rosterResidents.map((resident) => resident.residentId).filter(Boolean)
          ]))
        : [residentId];

    if (!targetResidentIds.length) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "No current residents were found for this cohort."
      }));
    }

    if (scope === "resident" && !rosterLookup.has(residentId)) {
      return withCors(jsonResponse(403, {
        success: false,
        error: "That resident is not currently visible in the selected cohort."
      }));
    }

    const now = new Date().toISOString();
    const cohortMessageId =
      scope === "cohort"
        ? `cohort-message-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`
        : null;

    const baseFeedback = {
      version: 1,
      organizationId,
      organizationName: organization.organizationName || "",
      cohortId,
      cohortLabel: cohort.label || cohortId,
      contextType: scope === "cohort" ? "cohort" : "general",
      cohortMessageId,
      attemptId: null,
      attemptType: null,
      attemptScore: null,
      assignmentId: null,
      assignmentTitle: null,
      message,
      createdByUserId: requester.residentId,
      createdByName: requester.name || "",
      createdByEmail: requester.email,
      createdAt: now,
      status: "active",
      readAt: null,
      isRead: false
    };

    const savedFeedback = [];

    for (const targetResidentId of targetResidentIds) {
      savedFeedback.push(
        await saveFeedbackForResident({
          feedbackStore,
          baseFeedback,
          resident: rosterLookup.get(targetResidentId) || {},
          residentId: targetResidentId
        })
      );
    }

    return withCors(jsonResponse(200, {
      success: true,
      scope,
      cohortMessageId,
      savedCount: savedFeedback.length,
      feedback: savedFeedback,
      message:
        scope === "cohort"
          ? `Feedback sent to ${savedFeedback.length} resident${savedFeedback.length === 1 ? "" : "s"} in ${cohort.label || cohortId}.`
          : "Feedback sent to resident."
    }));
  } catch (error) {
    console.error("[saveGeneralFacultyFeedback] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not send feedback."
    }));
  }
};