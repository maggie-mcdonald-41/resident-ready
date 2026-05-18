const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const { requireOrgAdmin } = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function normalizeLabel(label = "") {
  return String(label || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function normalizeAction(action = "") {
  return String(action || "").trim().toLowerCase();
}

function sortCohorts(cohorts = []) {
  return [...cohorts].sort((a, b) => {
    if (a.cohortId === "unassigned") return -1;
    if (b.cohortId === "unassigned") return 1;

    const statusA = a.status === "archived" ? 1 : 0;
    const statusB = b.status === "archived" ? 1 : 0;

    if (statusA !== statusB) return statusA - statusB;

    return String(a.label || "").localeCompare(String(b.label || ""));
  });
}

function updateCohortInIndex(index = {}, updatedCohort = {}) {
  const existingCohorts = Array.isArray(index.cohorts) ? index.cohorts : [];
  const hasCohort = existingCohorts.some(
    (cohort) => cohort.cohortId === updatedCohort.cohortId
  );

  const cohorts = hasCohort
    ? existingCohorts.map((cohort) =>
        cohort.cohortId === updatedCohort.cohortId
          ? {
              ...cohort,
              ...updatedCohort
            }
          : cohort
      )
    : [updatedCohort, ...existingCohorts];

  return {
    ...index,
    version: 1,
    updatedAt: new Date().toISOString(),
    cohorts: sortCohorts(cohorts)
  };
}

function updateRosterLabels(roster = {}, cohortId = "", label = "") {
  const residents = Array.isArray(roster.residents) ? roster.residents : [];

  return {
    ...(roster || {}),
    updatedAt: new Date().toISOString(),
    cohortLabel: roster.cohortId === cohortId ? label : roster.cohortLabel,
    residents: residents.map((resident) =>
      resident.cohortId === cohortId
        ? {
            ...resident,
            cohortLabel: label,
            updatedAt: new Date().toISOString()
          }
        : resident
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
    const cohortId = sanitizeKeyFragment(body.cohortId || "");
    const action = normalizeAction(body.action || "");
    const label = normalizeLabel(body.label || "");

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!cohortId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "cohortId is required."
      }));
    }

    if (!["rename", "archive", "restore"].includes(action)) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Action must be rename, archive, or restore."
      }));
    }

    if (cohortId === "unassigned" && action === "archive") {
      return withCors(jsonResponse(400, {
        success: false,
        error: "The Unassigned cohort cannot be archived."
      }));
    }

    if (action === "rename" && !label) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Cohort name is required."
      }));
    }

    connectLambda(event);

    await requireOrgAdmin(requester, organizationId);

    const organizationStore = getStore("resident-ready-organizations");
    const facultyIndexStore = getStore("resident-ready-faculty-indexes");

    const organizationKey = `organizations/${organizationId}.json`;
    const cohortKey = `organizations/${organizationId}/cohorts/${cohortId}.json`;
    const cohortIndexKey = `organizations/${organizationId}/cohorts/index.json`;

    const organization = await organizationStore.get(organizationKey, {
      type: "json"
    });

    if (!organization) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Organization not found."
      }));
    }

    const cohort = await organizationStore.get(cohortKey, {
      type: "json"
    });

    if (!cohort) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Cohort not found."
      }));
    }

    const cohortIndex = await organizationStore.get(cohortIndexKey, {
      type: "json"
    });

    const indexCohorts = Array.isArray(cohortIndex?.cohorts)
      ? cohortIndex.cohorts
      : [];

    if (action === "rename") {
      const duplicate = indexCohorts.find((item) =>
        item.cohortId !== cohortId &&
        item.status !== "archived" &&
        String(item.label || "").trim().toLowerCase() === label.toLowerCase()
      );

      if (duplicate) {
        return withCors(jsonResponse(409, {
          success: false,
          error: "An active cohort with that name already exists."
        }));
      }
    }

    const now = new Date().toISOString();

    const updatedCohort = {
      ...cohort,
      label: action === "rename" ? label : cohort.label,
      status:
        action === "archive"
          ? "archived"
          : action === "restore"
            ? "active"
            : cohort.status || "active",
      archivedAt: action === "archive" ? now : cohort.archivedAt || null,
      archivedByEmail: action === "archive" ? requester.email : cohort.archivedByEmail || null,
      restoredAt: action === "restore" ? now : cohort.restoredAt || null,
      restoredByEmail: action === "restore" ? requester.email : cohort.restoredByEmail || null,
      updatedAt: now
    };

    const updatedCohortSummary = {
      cohortId: updatedCohort.cohortId,
      label: updatedCohort.label,
      status: updatedCohort.status,
      academicYear: updatedCohort.academicYear || "",
      description: updatedCohort.description || "",
      residentIds: Array.isArray(updatedCohort.residentIds) ? updatedCohort.residentIds : [],
      createdAt: updatedCohort.createdAt,
      updatedAt: updatedCohort.updatedAt,
      archivedAt: updatedCohort.archivedAt || null,
      restoredAt: updatedCohort.restoredAt || null
    };

    const updatedIndex = updateCohortInIndex(cohortIndex || {
      version: 1,
      organizationId,
      organizationName: organization.organizationName,
      cohorts: []
    }, updatedCohortSummary);

    await organizationStore.setJSON(cohortKey, updatedCohort);
    await organizationStore.setJSON(cohortIndexKey, updatedIndex);

    if (action === "rename") {
      const organizationRosterKey = `organizations/${organizationId}/roster.json`;
      const cohortRosterKey = `organizations/${organizationId}/cohorts/${cohortId}/roster.json`;

      const organizationRoster = await facultyIndexStore.get(organizationRosterKey, {
        type: "json"
      });

      const cohortRoster = await facultyIndexStore.get(cohortRosterKey, {
        type: "json"
      });

      if (organizationRoster) {
        await facultyIndexStore.setJSON(
          organizationRosterKey,
          updateRosterLabels(organizationRoster, cohortId, label)
        );
      }

      if (cohortRoster) {
        await facultyIndexStore.setJSON(
          cohortRosterKey,
          updateRosterLabels(cohortRoster, cohortId, label)
        );
      }
    }

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
      action,
      cohort: updatedCohortSummary
    }));
  } catch (error) {
    console.error("[updateOrganizationCohort] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not update organization cohort."
    }));
  }
};