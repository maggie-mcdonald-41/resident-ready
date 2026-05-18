const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const {
  getEmailKey,
  getUserMembershipRecord,
  mergeUserMembership,
  requireOrgAdmin
} = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function removeValue(values = [], value = "") {
  return values.filter((item) => item !== value);
}

function getResidentRosterItemFromMembership(membership = {}, targetCohort = {}) {
  return {
    residentId: membership.userId,
    residentEmail: membership.email,
    residentName: membership.displayName || membership.email,
    displayName: membership.displayName || "",
    specialtyTrack: "",
    programYear: "",
    boardGoal: "",
    preferredStudyStyle: "",
    organizationId: membership.organizationId,
    organizationName: membership.organizationName,
    cohortId: targetCohort.cohortId,
    cohortLabel: targetCohort.label || targetCohort.cohortId,
    facultyScope: "default",
    latestAttemptId: null,
    latestAttemptType: null,
    latestPercentCorrect: null,
    latestAttemptSavedAt: null,
    updatedAt: new Date().toISOString()
  };
}

function updateRosterResident(roster = {}, residentId = "", updatedRosterItem = {}) {
  const residents = Array.isArray(roster.residents) ? roster.residents : [];
  const existing = residents.find((item) => item.residentId === residentId) || {};
  const withoutResident = residents.filter((item) => item.residentId !== residentId);

  const mergedResident = {
    ...existing,
    ...updatedRosterItem,
    updatedAt: new Date().toISOString()
  };

  return {
    ...(roster || {}),
    version: 1,
    appName: "Resident Ready",
    organizationId: updatedRosterItem.organizationId || roster.organizationId || null,
    organizationName: updatedRosterItem.organizationName || roster.organizationName || null,
    cohortId: roster.cohortId || null,
    cohortLabel: roster.cohortLabel || null,
    updatedAt: new Date().toISOString(),
    residents: [mergedResident, ...withoutResident].sort((a, b) => {
      const nameA = String(a.residentName || a.residentEmail || "").toLowerCase();
      const nameB = String(b.residentName || b.residentEmail || "").toLowerCase();
      return nameA.localeCompare(nameB);
    })
  };
}

function removeResidentFromRoster(roster = {}, residentId = "") {
  return {
    ...(roster || {}),
    version: 1,
    appName: "Resident Ready",
    updatedAt: new Date().toISOString(),
    residents: (Array.isArray(roster.residents) ? roster.residents : [])
      .filter((item) => item.residentId !== residentId)
  };
}

function updateResidentSummaryCohort(summary = {}, targetCohort = {}) {
  if (!summary || !summary.residentId) return summary || null;

  return {
    ...summary,
    cohortId: targetCohort.cohortId,
    cohortLabel: targetCohort.label || targetCohort.cohortId,
    updatedAt: new Date().toISOString()
  };
}

function updateMembershipCohort(membership = {}, targetCohort = {}, reason = "manual_move") {
  const now = new Date().toISOString();
  const oldCohortId = membership.activeCohortId || "unassigned";
  const oldCohortLabel = membership.activeCohortLabel || oldCohortId;

  const existingHistory = Array.isArray(membership.cohortHistory)
    ? membership.cohortHistory
    : [];

  const closedHistory = existingHistory.map((item) => {
    if (!item || item.endDate) return item;

    if ((item.cohortId || "unassigned") === oldCohortId) {
      return {
        ...item,
        endDate: now
      };
    }

    return item;
  });

  return {
    ...membership,
    activeCohortId: targetCohort.cohortId,
    activeCohortLabel: targetCohort.label || targetCohort.cohortId,
    assignedCohortIds: uniqueValues([
      targetCohort.cohortId,
      ...(Array.isArray(membership.assignedCohortIds) ? membership.assignedCohortIds : [])
    ]),
    previousCohortId: oldCohortId,
    previousCohortLabel: oldCohortLabel,
    updatedAt: now,
    cohortHistory: [
      {
        cohortId: targetCohort.cohortId,
        label: targetCohort.label || targetCohort.cohortId,
        startDate: now,
        endDate: null,
        reason
      },
      ...closedHistory
    ]
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
    const targetCohortId = sanitizeKeyFragment(body.targetCohortId || "");
    const reason = String(body.reason || "manual_move").trim() || "manual_move";

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!residentId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "residentId is required."
      }));
    }

    if (!targetCohortId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "targetCohortId is required."
      }));
    }

    connectLambda(event);

    await requireOrgAdmin(requester, organizationId);

    const organizationStore = getStore("resident-ready-organizations");
    const organizationMemberStore = getStore("resident-ready-organization-members");
    const userMembershipStore = getStore("resident-ready-user-memberships");
    const facultyIndexStore = getStore("resident-ready-faculty-indexes");

    const organizationKey = `organizations/${organizationId}.json`;
    const organization = await organizationStore.get(organizationKey, {
      type: "json"
    });

    if (!organization) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Organization not found."
      }));
    }

    const targetCohortKey = `organizations/${organizationId}/cohorts/${targetCohortId}.json`;
    const targetCohort = await organizationStore.get(targetCohortKey, {
      type: "json"
    });

    if (!targetCohort || targetCohort.status === "archived") {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Target cohort not found or archived."
      }));
    }

    const organizationMemberKey = `organizations/${organizationId}/members/${residentId}.json`;
    const existingMembership = await organizationMemberStore.get(organizationMemberKey, {
      type: "json"
    });

    if (!existingMembership || existingMembership.role !== "resident") {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Resident membership not found for this organization."
      }));
    }

    const oldCohortId = existingMembership.activeCohortId || "unassigned";

    if (oldCohortId === targetCohortId) {
      return withCors(jsonResponse(200, {
        success: true,
        message: "Resident is already in that cohort.",
        membership: existingMembership
      }));
    }

    const updatedMembership = updateMembershipCohort(
      {
        ...existingMembership,
        organizationName: existingMembership.organizationName || organization.organizationName
      },
      {
        cohortId: targetCohortId,
        label: targetCohort.label || targetCohortId
      },
      reason
    );

    const emailKey = getEmailKey(existingMembership.email);
    const { key: userMembershipKey, record: existingUserMembershipRecord } =
      await getUserMembershipRecord({
        residentId,
        email: existingMembership.email
      });

    const updatedUserMembershipRecord = mergeUserMembership(
      {
        ...existingUserMembershipRecord,
        email: existingUserMembershipRecord.email || existingMembership.email
      },
      updatedMembership
    );

    const oldCohortKey = `organizations/${organizationId}/cohorts/${oldCohortId}.json`;
    const oldCohort = await organizationStore.get(oldCohortKey, {
      type: "json"
    });

    const updatedOldCohort = oldCohort
      ? {
          ...oldCohort,
          residentIds: removeValue(
            Array.isArray(oldCohort.residentIds) ? oldCohort.residentIds : [],
            residentId
          ),
          updatedAt: new Date().toISOString()
        }
      : null;

    const updatedTargetCohort = {
      ...targetCohort,
      residentIds: uniqueValues([
        ...(Array.isArray(targetCohort.residentIds) ? targetCohort.residentIds : []),
        residentId
      ]),
      updatedAt: new Date().toISOString()
    };

    const organizationRosterKey = `organizations/${organizationId}/roster.json`;
    const oldCohortRosterKey = `organizations/${organizationId}/cohorts/${oldCohortId}/roster.json`;
    const targetCohortRosterKey = `organizations/${organizationId}/cohorts/${targetCohortId}/roster.json`;
    const residentSummaryKey = `organizations/${organizationId}/residents/${residentId}/summary.json`;

    const organizationRoster = await facultyIndexStore.get(organizationRosterKey, {
      type: "json"
    });

    const oldCohortRoster = await facultyIndexStore.get(oldCohortRosterKey, {
      type: "json"
    });

    const targetCohortRoster = await facultyIndexStore.get(targetCohortRosterKey, {
      type: "json"
    });

    const residentSummary = await facultyIndexStore.get(residentSummaryKey, {
      type: "json"
    });

    const fallbackRosterItem = getResidentRosterItemFromMembership(
      updatedMembership,
      {
        cohortId: targetCohortId,
        label: targetCohort.label || targetCohortId
      }
    );

    const existingOrganizationRosterItem = Array.isArray(organizationRoster?.residents)
      ? organizationRoster.residents.find((item) => item.residentId === residentId)
      : null;

    const updatedRosterItem = {
      ...(existingOrganizationRosterItem || fallbackRosterItem),
      cohortId: targetCohortId,
      cohortLabel: targetCohort.label || targetCohortId,
      organizationId,
      organizationName: organization.organizationName,
      updatedAt: new Date().toISOString()
    };

    await organizationMemberStore.setJSON(organizationMemberKey, updatedMembership);
    await userMembershipStore.setJSON(userMembershipKey, updatedUserMembershipRecord);

    if (updatedOldCohort) {
      await organizationStore.setJSON(oldCohortKey, updatedOldCohort);
    }

    await organizationStore.setJSON(targetCohortKey, updatedTargetCohort);

    await facultyIndexStore.setJSON(
      organizationRosterKey,
      updateRosterResident(organizationRoster || {
        version: 1,
        appName: "Resident Ready",
        organizationId,
        organizationName: organization.organizationName,
        residents: []
      }, residentId, updatedRosterItem)
    );

    await facultyIndexStore.setJSON(
      oldCohortRosterKey,
      removeResidentFromRoster(oldCohortRoster || {
        version: 1,
        appName: "Resident Ready",
        organizationId,
        organizationName: organization.organizationName,
        cohortId: oldCohortId,
        residents: []
      }, residentId)
    );

    await facultyIndexStore.setJSON(
      targetCohortRosterKey,
      updateRosterResident(targetCohortRoster || {
        version: 1,
        appName: "Resident Ready",
        organizationId,
        organizationName: organization.organizationName,
        cohortId: targetCohortId,
        cohortLabel: targetCohort.label || targetCohortId,
        residents: []
      }, residentId, updatedRosterItem)
    );

    if (residentSummary) {
      await facultyIndexStore.setJSON(
        residentSummaryKey,
        updateResidentSummaryCohort(residentSummary, {
          cohortId: targetCohortId,
          label: targetCohort.label || targetCohortId
        })
      );
    }

    await organizationStore.setJSON(organizationKey, {
      ...organization,
      updatedAt: new Date().toISOString()
    });

    return withCors(jsonResponse(200, {
      success: true,
      organization: {
        organizationId,
        organizationName: organization.organizationName
      },
      resident: {
        residentId,
        email: existingMembership.email,
        displayName: existingMembership.displayName || ""
      },
      previousCohort: {
        cohortId: oldCohortId,
        label: existingMembership.activeCohortLabel || oldCohortId
      },
      targetCohort: {
        cohortId: targetCohortId,
        label: targetCohort.label || targetCohortId
      },
      membership: updatedMembership,
      debug: {
        emailKey
      }
    }));
  } catch (error) {
    console.error("[moveResidentToCohort] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not move resident to cohort."
    }));
  }
};