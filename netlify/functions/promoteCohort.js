const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const {
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

function removeValues(values = [], valuesToRemove = []) {
  const removeSet = new Set(valuesToRemove);
  return values.filter((item) => !removeSet.has(item));
}

function getResidentIdsFromRoster(roster = {}, sourceCohortId = "") {
  const residents = Array.isArray(roster.residents) ? roster.residents : [];

  return residents
    .filter((resident) => (resident.cohortId || "unassigned") === sourceCohortId)
    .map((resident) => resident.residentId)
    .filter(Boolean);
}

function getResidentRosterItem(roster = {}, residentId = "") {
  const residents = Array.isArray(roster.residents) ? roster.residents : [];

  return residents.find((resident) => resident.residentId === residentId) || null;
}

function updateMembershipCohort(membership = {}, targetCohort = {}, reason = "cohort_promotion") {
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

function updateOrganizationRoster(roster = {}, residentIds = [], targetCohort = {}) {
  const moveSet = new Set(residentIds);
  const residents = Array.isArray(roster.residents) ? roster.residents : [];

  return {
    ...(roster || {}),
    version: 1,
    appName: "Resident Ready",
    updatedAt: new Date().toISOString(),
    residents: residents.map((resident) =>
      moveSet.has(resident.residentId)
        ? {
            ...resident,
            cohortId: targetCohort.cohortId,
            cohortLabel: targetCohort.label || targetCohort.cohortId,
            updatedAt: new Date().toISOString()
          }
        : resident
    )
  };
}

function removeResidentsFromRoster(roster = {}, residentIds = []) {
  const moveSet = new Set(residentIds);

  return {
    ...(roster || {}),
    version: 1,
    appName: "Resident Ready",
    updatedAt: new Date().toISOString(),
    residents: (Array.isArray(roster.residents) ? roster.residents : [])
      .filter((resident) => !moveSet.has(resident.residentId))
  };
}

function addResidentsToRoster(roster = {}, rosterItems = [], targetCohort = {}, organization = {}) {
  const existingResidents = Array.isArray(roster.residents) ? roster.residents : [];
  const movingIds = new Set(rosterItems.map((item) => item.residentId).filter(Boolean));
  const withoutMovingResidents = existingResidents.filter(
    (resident) => !movingIds.has(resident.residentId)
  );

  const movedResidents = rosterItems
    .filter((item) => item?.residentId)
    .map((item) => ({
      ...item,
      organizationId: organization.organizationId || item.organizationId,
      organizationName: organization.organizationName || item.organizationName,
      cohortId: targetCohort.cohortId,
      cohortLabel: targetCohort.label || targetCohort.cohortId,
      updatedAt: new Date().toISOString()
    }));

  return {
    ...(roster || {}),
    version: 1,
    appName: "Resident Ready",
    organizationId: organization.organizationId || roster.organizationId || null,
    organizationName: organization.organizationName || roster.organizationName || null,
    cohortId: targetCohort.cohortId,
    cohortLabel: targetCohort.label || targetCohort.cohortId,
    updatedAt: new Date().toISOString(),
    residents: [...movedResidents, ...withoutMovingResidents].sort((a, b) => {
      const nameA = String(a.residentName || a.residentEmail || "").toLowerCase();
      const nameB = String(b.residentName || b.residentEmail || "").toLowerCase();
      return nameA.localeCompare(nameB);
    })
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
    const sourceCohortId = sanitizeKeyFragment(body.sourceCohortId || "");
    const targetCohortId = sanitizeKeyFragment(body.targetCohortId || "");
    const reason = String(body.reason || "cohort_promotion").trim() || "cohort_promotion";

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!sourceCohortId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "sourceCohortId is required."
      }));
    }

    if (!targetCohortId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "targetCohortId is required."
      }));
    }

    if (sourceCohortId === targetCohortId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Choose a different target cohort."
      }));
    }

    connectLambda(event);

    await requireOrgAdmin(requester, organizationId);

    const organizationStore = getStore("resident-ready-organizations");
    const organizationMemberStore = getStore("resident-ready-organization-members");
    const userMembershipStore = getStore("resident-ready-user-memberships");
    const facultyIndexStore = getStore("resident-ready-faculty-indexes");

    const organizationKey = `organizations/${organizationId}.json`;
    const sourceCohortKey = `organizations/${organizationId}/cohorts/${sourceCohortId}.json`;
    const targetCohortKey = `organizations/${organizationId}/cohorts/${targetCohortId}.json`;

    const organization = await organizationStore.get(organizationKey, {
      type: "json"
    });

    if (!organization) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Organization not found."
      }));
    }

    const sourceCohort = await organizationStore.get(sourceCohortKey, {
      type: "json"
    });

    const targetCohort = await organizationStore.get(targetCohortKey, {
      type: "json"
    });

    if (!sourceCohort || sourceCohort.status === "archived") {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Source cohort not found or archived."
      }));
    }

    if (!targetCohort || targetCohort.status === "archived") {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Target cohort not found or archived."
      }));
    }

    const organizationRosterKey = `organizations/${organizationId}/roster.json`;
    const sourceCohortRosterKey = `organizations/${organizationId}/cohorts/${sourceCohortId}/roster.json`;
    const targetCohortRosterKey = `organizations/${organizationId}/cohorts/${targetCohortId}/roster.json`;

    const organizationRoster = await facultyIndexStore.get(organizationRosterKey, {
      type: "json"
    });

    const sourceCohortRoster = await facultyIndexStore.get(sourceCohortRosterKey, {
      type: "json"
    });

    const targetCohortRoster = await facultyIndexStore.get(targetCohortRosterKey, {
      type: "json"
    });

    const sourceResidentIdsFromRoster = getResidentIdsFromRoster(
      organizationRoster || {},
      sourceCohortId
    );

    const sourceResidentIdsFromCohort = Array.isArray(sourceCohort.residentIds)
      ? sourceCohort.residentIds
      : [];

    const residentIdsToMove = uniqueValues([
      ...sourceResidentIdsFromRoster,
      ...sourceResidentIdsFromCohort
    ]);

    if (!residentIdsToMove.length) {
      return withCors(jsonResponse(409, {
        success: false,
        error: "No residents were found in the source cohort."
      }));
    }

    const now = new Date().toISOString();
    const movedRosterItems = [];
    const movedResidents = [];

    for (const residentId of residentIdsToMove) {
      const organizationMemberKey = `organizations/${organizationId}/members/${residentId}.json`;

      const existingMembership = await organizationMemberStore.get(organizationMemberKey, {
        type: "json"
      });

      if (!existingMembership || existingMembership.role !== "resident") {
        continue;
      }

      const currentCohortId = existingMembership.activeCohortId || "unassigned";

      if (currentCohortId !== sourceCohortId) {
        continue;
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

      await organizationMemberStore.setJSON(organizationMemberKey, updatedMembership);
      await userMembershipStore.setJSON(userMembershipKey, updatedUserMembershipRecord);

      const existingRosterItem =
        getResidentRosterItem(organizationRoster || {}, residentId) ||
        getResidentRosterItem(sourceCohortRoster || {}, residentId) ||
        {
          residentId,
          residentEmail: existingMembership.email,
          residentName: existingMembership.displayName || existingMembership.email,
          displayName: existingMembership.displayName || "",
          latestPercentCorrect: null,
          programYear: "",
          specialtyTrack: ""
        };

      movedRosterItems.push({
        ...existingRosterItem,
        cohortId: targetCohortId,
        cohortLabel: targetCohort.label || targetCohortId,
        organizationId,
        organizationName: organization.organizationName,
        updatedAt: now
      });

      const residentSummaryKey = `organizations/${organizationId}/residents/${residentId}/summary.json`;
      const residentSummary = await facultyIndexStore.get(residentSummaryKey, {
        type: "json"
      });

      if (residentSummary) {
        await facultyIndexStore.setJSON(
          residentSummaryKey,
          updateResidentSummaryCohort(residentSummary, {
            cohortId: targetCohortId,
            label: targetCohort.label || targetCohortId
          })
        );
      }

      movedResidents.push({
        residentId,
        email: existingMembership.email,
        displayName: existingMembership.displayName || ""
      });
    }

    const actuallyMovedResidentIds = movedResidents.map((resident) => resident.residentId);

    if (!actuallyMovedResidentIds.length) {
      return withCors(jsonResponse(409, {
        success: false,
        error: "No active residents in the source cohort were eligible to move."
      }));
    }

    const updatedSourceCohort = {
      ...sourceCohort,
      residentIds: removeValues(
        Array.isArray(sourceCohort.residentIds) ? sourceCohort.residentIds : [],
        actuallyMovedResidentIds
      ),
      updatedAt: now
    };

    const updatedTargetCohort = {
      ...targetCohort,
      residentIds: uniqueValues([
        ...(Array.isArray(targetCohort.residentIds) ? targetCohort.residentIds : []),
        ...actuallyMovedResidentIds
      ]),
      updatedAt: now
    };

    await organizationStore.setJSON(sourceCohortKey, updatedSourceCohort);
    await organizationStore.setJSON(targetCohortKey, updatedTargetCohort);

    await facultyIndexStore.setJSON(
      organizationRosterKey,
      updateOrganizationRoster(
        organizationRoster || {
          version: 1,
          appName: "Resident Ready",
          organizationId,
          organizationName: organization.organizationName,
          residents: []
        },
        actuallyMovedResidentIds,
        {
          cohortId: targetCohortId,
          label: targetCohort.label || targetCohortId
        }
      )
    );

    await facultyIndexStore.setJSON(
      sourceCohortRosterKey,
      removeResidentsFromRoster(
        sourceCohortRoster || {
          version: 1,
          appName: "Resident Ready",
          organizationId,
          organizationName: organization.organizationName,
          cohortId: sourceCohortId,
          cohortLabel: sourceCohort.label || sourceCohortId,
          residents: []
        },
        actuallyMovedResidentIds
      )
    );

    await facultyIndexStore.setJSON(
      targetCohortRosterKey,
      addResidentsToRoster(
        targetCohortRoster || {
          version: 1,
          appName: "Resident Ready",
          organizationId,
          organizationName: organization.organizationName,
          cohortId: targetCohortId,
          cohortLabel: targetCohort.label || targetCohortId,
          residents: []
        },
        movedRosterItems,
        {
          cohortId: targetCohortId,
          label: targetCohort.label || targetCohortId
        },
        {
          organizationId,
          organizationName: organization.organizationName
        }
      )
    );

    await organizationStore.setJSON(organizationKey, {
      ...organization,
      updatedAt: now
    });

    return withCors(jsonResponse(200, {
      success: true,
      organization: {
        organizationId,
        organizationName: organization.organizationName
      },
      sourceCohort: {
        cohortId: sourceCohortId,
        label: sourceCohort.label || sourceCohortId
      },
      targetCohort: {
        cohortId: targetCohortId,
        label: targetCohort.label || targetCohortId
      },
      movedCount: movedResidents.length,
      movedResidents
    }));
  } catch (error) {
    console.error("[promoteCohort] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not promote cohort."
    }));
  }
};