const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident } = require("./_shared/auth");
const {
  getEmailKey,
  getUserMembershipRecord,
  mergeUserMembership
} = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function hashCode(code = "") {
  return crypto
    .createHash("sha256")
    .update(String(code || "").trim().toUpperCase())
    .digest("hex");
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
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
    const body = readJsonBody(event);
    const code = String(body.code || "").trim().toUpperCase();

    if (!code) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Access code is required."
      }));
    }

    connectLambda(event);

    const codeHash = hashCode(code);

    const accessCodeStore = getStore("resident-ready-access-codes");
    const organizationStore = getStore("resident-ready-organizations");
    const organizationMemberStore = getStore("resident-ready-organization-members");
    const userMembershipStore = getStore("resident-ready-user-memberships");

    const lookup = await accessCodeStore.get(`lookup/${codeHash}.json`, { type: "json" });

    if (!lookup?.organizationId || !lookup?.codeId) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Access code not found."
      }));
    }

    const accessCodeKey = `organizations/${lookup.organizationId}/access-codes/${lookup.codeId}.json`;
    const accessCode = await accessCodeStore.get(accessCodeKey, { type: "json" });

    if (!accessCode || accessCode.status !== "active") {
      return withCors(jsonResponse(403, {
        success: false,
        error: "This access code is not active."
      }));
    }

    if (isExpired(accessCode.expiresAt)) {
      return withCors(jsonResponse(403, {
        success: false,
        error: "This access code has expired."
      }));
    }

    if (Number(accessCode.currentUses || 0) >= Number(accessCode.maxUses || 0)) {
      return withCors(jsonResponse(403, {
        success: false,
        error: "This access code has reached its maximum number of uses."
      }));
    }

    const now = new Date().toISOString();
    const organizationId = accessCode.organizationId;
    const targetCohortId = accessCode.targetCohortId || "unassigned";

    const organizationKey = `organizations/${organizationId}.json`;
    const organization = await organizationStore.get(organizationKey, { type: "json" });

    if (!organization) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Organization not found."
      }));
    }

    const cohortKey = `organizations/${organizationId}/cohorts/${targetCohortId}.json`;
    const cohort = await organizationStore.get(cohortKey, { type: "json" });

    if (!cohort) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "Target cohort not found."
      }));
    }

    const residentMembership = {
      version: 1,
      organizationId,
      organizationName: organization.organizationName,
      userId: resident.residentId,
      email: resident.email,
      displayName: resident.name || "",
      role: "resident",
      roleLabel: "Resident",
      status: "active",
      permissions: [
        "complete_assigned_work",
        "complete_practice",
        "view_own_progress",
        "view_own_feedback"
      ],
      activeCohortId: targetCohortId,
      activeCohortLabel: cohort.label || targetCohortId,
      assignedCohortIds: [targetCohortId],
      joinedByCodeId: accessCode.codeId,
      joinedAt: now,
      updatedAt: now,
      cohortHistory: [
        {
          cohortId: targetCohortId,
          label: cohort.label || targetCohortId,
          startDate: now,
          endDate: null,
          reason: "joined_with_access_code"
        }
      ]
    };

    const { key: userMembershipKey, record: existingUserMembershipRecord } =
      await getUserMembershipRecord(resident);

    const updatedUserMembershipRecord = mergeUserMembership(
      existingUserMembershipRecord,
      residentMembership
    );

    const organizationMemberKey = `organizations/${organizationId}/members/${resident.residentId}.json`;
    const updatedCohort = {
      ...cohort,
      residentIds: uniqueValues([
        ...(Array.isArray(cohort.residentIds) ? cohort.residentIds : []),
        resident.residentId
      ]),
      updatedAt: now
    };

    const updatedAccessCode = {
      ...accessCode,
      currentUses: Number(accessCode.currentUses || 0) + 1,
      updatedAt: now,
      recentUses: [
        {
          userId: resident.residentId,
          email: resident.email,
          usedAt: now
        },
        ...(Array.isArray(accessCode.recentUses) ? accessCode.recentUses : [])
      ].slice(0, 50)
    };

    const organizationCodeIndexKey = `organizations/${organizationId}/access-codes/index.json`;
    const existingCodeIndex = await accessCodeStore.get(organizationCodeIndexKey, { type: "json" });
    const existingCodeSummaries = Array.isArray(existingCodeIndex?.codes)
      ? existingCodeIndex.codes
      : [];

    const updatedCodeSummaries = existingCodeSummaries.map((item) =>
      item.codeId === accessCode.codeId
        ? {
            ...item,
            currentUses: updatedAccessCode.currentUses,
            updatedAt: now
          }
        : item
    );

    await userMembershipStore.setJSON(userMembershipKey, updatedUserMembershipRecord);
    await organizationMemberStore.setJSON(organizationMemberKey, residentMembership);
    await organizationStore.setJSON(cohortKey, updatedCohort);
    await accessCodeStore.setJSON(accessCodeKey, updatedAccessCode);

    await accessCodeStore.setJSON(organizationCodeIndexKey, {
      ...(existingCodeIndex || {
        version: 1,
        organizationId,
        organizationName: organization.organizationName
      }),
      updatedAt: now,
      codes: updatedCodeSummaries
    });

    return withCors(jsonResponse(200, {
      success: true,
      organization: {
        organizationId,
        organizationName: organization.organizationName
      },
      cohort: {
        cohortId: targetCohortId,
        label: cohort.label || targetCohortId
      },
      membership: residentMembership
    }));
  } catch (error) {
    console.error("[joinOrganizationWithCode] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not join organization with access code."
    }));
  }
};