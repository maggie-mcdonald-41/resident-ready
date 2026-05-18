const crypto = require("crypto");
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

function slugifyCohortName(name = "") {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "cohort";
}

function buildCohortId(label = "") {
  return sanitizeKeyFragment(slugifyCohortName(label));
}

function normalizeCohortLabel(label = "") {
  return String(label || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
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
    const label = normalizeCohortLabel(body.label || body.name || "");

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!label) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Cohort name is required."
      }));
    }

    if (label.toLowerCase() === "all cohorts" || label.toLowerCase() === "all") {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Please choose a specific cohort name."
      }));
    }

    connectLambda(event);

    await requireOrgAdmin(requester, organizationId);

    const organizationStore = getStore("resident-ready-organizations");

    const organizationKey = `organizations/${organizationId}.json`;
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

    const existingIndex = await organizationStore.get(cohortIndexKey, {
      type: "json"
    });

    const existingCohorts = Array.isArray(existingIndex?.cohorts)
      ? existingIndex.cohorts
      : [];

    const normalizedLabel = label.toLowerCase();

    const duplicateByLabel = existingCohorts.find((cohort) =>
      String(cohort.label || "").trim().toLowerCase() === normalizedLabel &&
      cohort.status !== "archived"
    );

    if (duplicateByLabel) {
      return withCors(jsonResponse(409, {
        success: false,
        error: "A cohort with that name already exists."
      }));
    }

    const baseCohortId = buildCohortId(label);
    let cohortId = baseCohortId;
    let cohortKey = `organizations/${organizationId}/cohorts/${cohortId}.json`;
    let existingCohort = await organizationStore.get(cohortKey, {
      type: "json"
    });

    if (existingCohort) {
      cohortId = `${baseCohortId}-${crypto.randomBytes(2).toString("hex")}`;
      cohortKey = `organizations/${organizationId}/cohorts/${cohortId}.json`;
      existingCohort = await organizationStore.get(cohortKey, {
        type: "json"
      });
    }

    if (existingCohort) {
      return withCors(jsonResponse(409, {
        success: false,
        error: "Could not create a unique cohort. Please try a slightly different name."
      }));
    }

    const now = new Date().toISOString();

    const cohort = {
      version: 1,
      cohortId,
      label,
      status: "active",
      academicYear: "",
      description: "",
      residentIds: [],
      createdByUserId: requester.residentId,
      createdByEmail: requester.email,
      createdAt: now,
      updatedAt: now
    };

    const updatedIndex = {
      version: 1,
      organizationId,
      organizationName: organization.organizationName,
      updatedAt: now,
      cohorts: [cohort, ...existingCohorts]
        .sort((a, b) => {
          if (a.cohortId === "unassigned") return -1;
          if (b.cohortId === "unassigned") return 1;
          return String(a.label || "").localeCompare(String(b.label || ""));
        })
    };

    await organizationStore.setJSON(cohortKey, cohort);
    await organizationStore.setJSON(cohortIndexKey, updatedIndex);
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
      cohort
    }));
  } catch (error) {
    console.error("[createOrganizationCohort] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not create organization cohort."
    }));
  }
};