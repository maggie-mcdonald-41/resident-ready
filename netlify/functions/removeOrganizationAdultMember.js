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

function markMemberInactive(member = {}, requester = {}, now = new Date().toISOString()) {
  return {
    ...member,
    status: "inactive",
    removedAt: now,
    removedByUserId: requester.residentId,
    removedByEmail: requester.email,
    updatedAt: now
  };
}

function updateAdultMemberIndex(index = {}, targetEmail = "", requester = {}) {
  const now = new Date().toISOString();
  const members = Array.isArray(index.members) ? index.members : [];

  return {
    ...(index || {}),
    version: 1,
    updatedAt: now,
    members: members.map((member) =>
      String(member.email || "").toLowerCase() === targetEmail
        ? markMemberInactive(member, requester, now)
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

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    if (!targetEmail || !isValidEmail(targetEmail)) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Enter a valid email address."
      }));
    }

    connectLambda(event);

    const requesterMembership = await requireOrgAdmin(requester, organizationId);

    if (requesterMembership.role !== "primary_admin") {
      return withCors(jsonResponse(403, {
        success: false,
        error: "Only the Primary Admin can remove Faculty/Admin members."
      }));
    }

    if (requester.email && requester.email.toLowerCase() === targetEmail) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "You cannot remove your own access from this panel."
      }));
    }

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

    const targetEmailKey = getEmailKey(targetEmail);
    const { key: userMembershipKey, record: existingUserMembershipRecord } =
      await getUserMembershipRecord({
        residentId: null,
        email: targetEmail
      });

    const memberships = Array.isArray(existingUserMembershipRecord?.memberships)
      ? existingUserMembershipRecord.memberships
      : [];

    const activeAdultMemberships = memberships.filter((membership) =>
      membership.organizationId === organizationId &&
      ["admin", "faculty"].includes(membership.role) &&
      membership.status === "active"
    );

    if (!activeAdultMemberships.length) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "No active Faculty/Admin membership found for that email."
      }));
    }

    const now = new Date().toISOString();

    const updatedMemberships = memberships.map((membership) => {
      if (
        membership.organizationId === organizationId &&
        ["admin", "faculty"].includes(membership.role) &&
        membership.status === "active"
      ) {
        return markMemberInactive(membership, requester, now);
      }

      return membership;
    });

    const adultMemberIndexKey =
      `organizations/${organizationId}/adult-members/index.json`;

    const existingAdultIndex = await organizationMemberStore.get(adultMemberIndexKey, {
      type: "json"
    });

    const updatedAdultIndex = updateAdultMemberIndex(
      existingAdultIndex || {
        version: 1,
        organizationId,
        organizationName: organization.organizationName,
        members: []
      },
      targetEmail,
      requester
    );

    for (const membership of activeAdultMemberships) {
      const adultMemberKey =
        `organizations/${organizationId}/adult-members/${membership.role}-${targetEmailKey}.json`;

      const existingAdultMember = await organizationMemberStore.get(adultMemberKey, {
        type: "json"
      });

      if (existingAdultMember) {
        await organizationMemberStore.setJSON(
          adultMemberKey,
          markMemberInactive(existingAdultMember, requester, now)
        );
      }
    }

    await userMembershipStore.setJSON(userMembershipKey, {
      ...existingUserMembershipRecord,
      email: existingUserMembershipRecord?.email || targetEmail,
      updatedAt: now,
      memberships: updatedMemberships
    });

    await organizationMemberStore.setJSON(adultMemberIndexKey, updatedAdultIndex);

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
      removedEmail: targetEmail,
      message: `${targetEmail} was removed from Faculty/Admin access for this organization.`
    }));
  } catch (error) {
    console.error("[removeOrganizationAdultMember] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not remove Faculty/Admin member."
    }));
  }
};