const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const {
  getEmailKey,
  getUserMembershipRecord,
  requireOrgAdmin
} = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeCohortIds(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => sanitizeKeyFragment(value || ""))
      .filter((value) => value && value !== "all")
  ));
}

function updateAdultMemberIndex(index = {}, targetEmail = "", assignedCohortIds = []) {
  const members = Array.isArray(index.members) ? index.members : [];

  return {
    ...(index || {}),
    version: 1,
    updatedAt: new Date().toISOString(),
    members: members.map((member) =>
      String(member.email || "").toLowerCase() === targetEmail &&
      member.role === "faculty"
        ? {
            ...member,
            assignedCohortIds,
            updatedAt: new Date().toISOString()
          }
        : member
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
    const targetEmail = normalizeEmail(body.email || body.targetEmail || "");
    const assignedCohortIds = normalizeCohortIds(body.assignedCohortIds || []);

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!targetEmail || !isValidEmail(targetEmail)) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Enter a valid faculty email address."
      }));
    }

    connectLambda(event);

    await requireOrgAdmin(requester, organizationId);

    const organizationStore = getStore("resident-ready-organizations");
    const userMembershipStore = getStore("resident-ready-user-memberships");
    const organizationMemberStore = getStore("resident-ready-organization-members");

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

    const cohortIndex = await organizationStore.get(
      `organizations/${organizationId}/cohorts/index.json`,
      { type: "json" }
    );

    const activeCohortIds = new Set(
      (Array.isArray(cohortIndex?.cohorts) ? cohortIndex.cohorts : [])
        .filter((cohort) => cohort.status !== "archived")
        .map((cohort) => cohort.cohortId)
    );

    const invalidCohortIds = assignedCohortIds.filter((cohortId) =>
      !activeCohortIds.has(cohortId)
    );

    if (invalidCohortIds.length) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "One or more selected cohorts are not active."
      }));
    }

    const targetEmailKey = getEmailKey(targetEmail);
    const { key: userMembershipKey, record: existingUserMembershipRecord } =
      await getUserMembershipRecord({
        residentId: null,
        email: targetEmail
      });

    const memberships = Array.isArray(existingUserMembershipRecord?.memberships)
      ? existingUserMembershipRecord.memberships
      : [];

    const facultyMembership = memberships.find((membership) =>
      membership.organizationId === organizationId &&
      membership.role === "faculty" &&
      membership.status === "active"
    );

    if (!facultyMembership) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "No active Faculty membership found for that email."
      }));
    }

    const now = new Date().toISOString();

    const updatedFacultyMembership = {
      ...facultyMembership,
      assignedCohortIds,
      updatedByUserId: requester.residentId,
      updatedByEmail: requester.email,
      updatedAt: now
    };

    const updatedUserMembershipRecord = {
      ...existingUserMembershipRecord,
      email: existingUserMembershipRecord?.email || targetEmail,
      updatedAt: now,
      memberships: [
        updatedFacultyMembership,
        ...memberships.filter((membership) =>
          !(
            membership.organizationId === organizationId &&
            membership.role === "faculty"
          )
        )
      ]
    };

    const adultMemberKey =
      `organizations/${organizationId}/adult-members/faculty-${targetEmailKey}.json`;
    const adultMemberIndexKey =
      `organizations/${organizationId}/adult-members/index.json`;

    const existingAdultMember = await organizationMemberStore.get(adultMemberKey, {
      type: "json"
    });

    await userMembershipStore.setJSON(userMembershipKey, updatedUserMembershipRecord);

    await organizationMemberStore.setJSON(adultMemberKey, {
      ...(existingAdultMember || updatedFacultyMembership),
      ...updatedFacultyMembership
    });

    const existingAdultIndex = await organizationMemberStore.get(adultMemberIndexKey, {
      type: "json"
    });

    await organizationMemberStore.setJSON(
      adultMemberIndexKey,
      updateAdultMemberIndex(
        existingAdultIndex || {
          version: 1,
          organizationId,
          organizationName: organization.organizationName,
          members: []
        },
        targetEmail,
        assignedCohortIds
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
      email: targetEmail,
      assignedCohortIds,
      message:
        assignedCohortIds.length
          ? `${targetEmail} now has access to ${assignedCohortIds.length} cohort${assignedCohortIds.length === 1 ? "" : "s"}.`
          : `${targetEmail} now has no assigned cohorts.`
    }));
  } catch (error) {
    console.error("[assignFacultyCohorts] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not assign Faculty cohort access."
    }));
  }
};