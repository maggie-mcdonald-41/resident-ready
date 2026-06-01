const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function markFeedbackItemRead(item = {}, now = new Date().toISOString()) {
  return {
    ...item,
    readAt: item.readAt || now,
    updatedAt: now
  };
}

function updateFeedbackIndex(index = {}, feedbackId = "", now = new Date().toISOString()) {
  const feedback = Array.isArray(index.feedback) ? index.feedback : [];

  return {
    ...(index || {}),
    version: 1,
    updatedAt: now,
    feedback: feedback.map((item) =>
      item.feedbackId === feedbackId
        ? markFeedbackItemRead(item, now)
        : item
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
    const resident = requireResident(event);
    const body = readJsonBody(event) || {};
    const feedbackId = sanitizeKeyFragment(body.feedbackId || "");
    const organizationId = sanitizeKeyFragment(body.organizationId || "");

    if (!feedbackId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "feedbackId is required."
      }));
    }

    connectLambda(event);

    const feedbackStore = getStore("resident-ready-feedback");
    const residentIndexKey = `resident/${resident.residentId}/feedback/index.json`;

    const residentIndex = await feedbackStore.get(residentIndexKey, {
      type: "json"
    });

    const feedbackItems = Array.isArray(residentIndex?.feedback)
      ? residentIndex.feedback
      : [];

    const targetFeedback = feedbackItems.find((item) =>
      item.feedbackId === feedbackId
    );

    if (!targetFeedback) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Feedback not found."
      }));
    }

    if (
      organizationId &&
      targetFeedback.organizationId &&
      targetFeedback.organizationId !== organizationId
    ) {
      return withCors(jsonResponse(403, {
        success: false,
        error: "This feedback does not belong to the selected organization."
      }));
    }

    const now = new Date().toISOString();
    const updatedFeedback = markFeedbackItemRead(targetFeedback, now);

    const organizationFeedbackKey =
      `organizations/${targetFeedback.organizationId}/residents/${resident.residentId}/feedback/${feedbackId}.json`;

    const organizationResidentIndexKey =
      `organizations/${targetFeedback.organizationId}/residents/${resident.residentId}/feedback/index.json`;

    const organizationResidentIndex = await feedbackStore.get(organizationResidentIndexKey, {
      type: "json"
    });

    await feedbackStore.setJSON(
      residentIndexKey,
      updateFeedbackIndex(residentIndex || {
        version: 1,
        residentId: resident.residentId,
        feedback: []
      }, feedbackId, now)
    );

    await feedbackStore.setJSON(organizationFeedbackKey, updatedFeedback);

    if (organizationResidentIndex) {
      await feedbackStore.setJSON(
        organizationResidentIndexKey,
        updateFeedbackIndex(organizationResidentIndex, feedbackId, now)
      );
    }

    return withCors(jsonResponse(200, {
      success: true,
      feedback: updatedFeedback,
      message: "Feedback marked as read."
    }));
  } catch (error) {
    console.error("[markResidentFeedbackRead] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not mark feedback as read."
    }));
  }
};