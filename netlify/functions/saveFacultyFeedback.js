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
    const residentId = sanitizeKeyFragment(body.residentId || "");
    const attemptId = sanitizeKeyFragment(body.attemptId || "");
    const message = normalizeMessage(body.message || "");

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!residentId || !attemptId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "residentId and attemptId are required."
      }));
    }

    if (!message) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Enter feedback before saving."
      }));
    }

    connectLambda(event);

    const attemptDetailStore = getStore("resident-ready-faculty-attempt-details");
    const feedbackStore = getStore("resident-ready-feedback");

    const detailKey =
      `organizations/${organizationId}/residents/${residentId}/attempts/${attemptId}.json`;

    const detail = await attemptDetailStore.get(detailKey, {
      type: "json"
    });

    if (!detail) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Faculty-safe attempt detail was not found."
      }));
    }

    await requireFacultyCohortAccess(
      requester,
      organizationId,
      detail.cohortId || detail.assignmentContext?.cohortId || ""
    );

    const now = new Date().toISOString();
    const feedbackId = `feedback-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    const feedback = {
      version: 1,
      feedbackId,
      organizationId,
      organizationName: detail.organizationName || "",
      cohortId: detail.cohortId || detail.assignmentContext?.cohortId || "",
      cohortLabel: detail.cohortLabel || detail.assignmentContext?.cohortLabel || "",
      residentId,
      residentName: detail.residentName || detail.residentEmail || "Resident",
      residentEmail: detail.residentEmail || "",
      contextType: "attempt",
      attemptId,
      attemptType: detail.type || "Attempt",
      attemptScore: detail.percentCorrect ?? null,
      assignmentId: detail.assignmentContext?.assignmentId || null,
      assignmentTitle: detail.assignmentContext?.assignmentTitle || null,
      message,
      createdByUserId: requester.residentId,
      createdByName: requester.name || "",
      createdByEmail: requester.email,
      createdAt: now,
      status: "active",
      readAt: null
    };

    const feedbackKey =
      `organizations/${organizationId}/residents/${residentId}/feedback/${feedbackId}.json`;

    const residentFeedbackIndexKey =
      `resident/${residentId}/feedback/index.json`;

    const organizationResidentFeedbackIndexKey =
      `organizations/${organizationId}/residents/${residentId}/feedback/index.json`;

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
        organizationId,
        feedback: []
      }, feedback)
    );

    return withCors(jsonResponse(200, {
      success: true,
      feedback,
      message: "Feedback sent to resident."
    }));
  } catch (error) {
    console.error("[saveFacultyFeedback] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not save faculty feedback."
    }));
  }
};