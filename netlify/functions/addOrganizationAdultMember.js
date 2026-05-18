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

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(role = "") {
  return String(role || "").trim().toLowerCase();
}

function getRoleLabel(role = "") {
  const labels = {
    admin: "Admin",
    faculty: "Faculty"
  };

  return labels[role] || role;
}

function getPermissionsForRole(role = "") {
  if (role === "admin") {
    return [
      "manage_faculty",
      "manage_cohorts",
      "manage_residents",
      "create_access_codes",
      "assign_work",
      "view_faculty_dashboard",
      "view_resident_progress",
      "leave_feedback"
    ];
  }

  return [
    "create_access_codes",
    "assign_work",
    "view_faculty_dashboard",
    "view_resident_progress",
    "leave_feedback"
  ];
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function upsertAdultMemberIndex(index = {}, membership = {}) {
  const members = Array.isArray(index.members) ? index.members : [];

  const withoutCurrent = members.filter((member) =>
    !(
      member.email === membership.email &&
      member.role === membership.role
    )
  );

  return {
    ...(index || {}),
    version: 1,
    organizationId: membership.organizationId,
    organizationName: membership.organizationName,
    updatedAt: new Date().toISOString(),
    members: [
      {
        organizationId: membership.organizationId,
        organizationName: membership.organizationName,
        email: membership.email,
        displayName: membership.displayName || "",
        role: membership.role,
        roleLabel: membership.roleLabel,
        status: membership.status,
        addedByEmail: membership.addedByEmail,
        joinedAt: membership.joinedAt,
        updatedAt: membership.updatedAt
      },
      ...withoutCurrent
    ].sort((a, b) => {
      const roleOrder = { admin: 1, faculty: 2 };
      const roleCompare = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
      if (roleCompare !== 0) return roleCompare;
      return String(a.email || "").localeCompare(String(b.email || ""));
    })
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
    const role = normalizeRole(body.role || "");

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

    if (!["admin", "faculty"].includes(role)) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Role must be admin or faculty."
      }));
    }

    connectLambda(event);

    const requesterMembership = await requireOrgAdmin(requester, organizationId);

    if (requesterMembership.role === "admin" && role === "admin") {
      return withCors(jsonResponse(403, {
        success: false,
        error: "Only the Primary Admin can add another admin."
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

    const existingMemberships = Array.isArray(existingUserMembershipRecord?.memberships)
      ? existingUserMembershipRecord.memberships
      : [];

    const existingSameRole = existingMemberships.find((membership) =>
      membership.organizationId === organizationId &&
      membership.role === role &&
      membership.status === "active"
    );

    if (existingSameRole) {
      return withCors(jsonResponse(409, {
        success: false,
        error: `${targetEmail} already has the ${getRoleLabel(role)} role for this organization.`
      }));
    }

    const now = new Date().toISOString();

    const membership = {
      version: 1,
      organizationId,
      organizationName: organization.organizationName,
      userId: existingUserMembershipRecord?.userId || null,
      email: targetEmail,
      displayName: "",
      role,
      roleLabel: getRoleLabel(role),
      status: "active",
      permissions: getPermissionsForRole(role),
      activeCohortId: null,
      assignedCohortIds: ["all"],
      addedByUserId: requester.residentId,
      addedByEmail: requester.email,
      joinedAt: now,
      updatedAt: now
    };

    const updatedUserMembershipRecord = mergeUserMembership(
      {
        ...existingUserMembershipRecord,
        email: existingUserMembershipRecord?.email || targetEmail
      },
      membership
    );

    const adultMemberKey =
      `organizations/${organizationId}/adult-members/${role}-${targetEmailKey}.json`;
    const adultMemberIndexKey =
      `organizations/${organizationId}/adult-members/index.json`;

    const existingAdultIndex = await organizationMemberStore.get(adultMemberIndexKey, {
      type: "json"
    });

    const updatedAdultIndex = upsertAdultMemberIndex(existingAdultIndex || {
      version: 1,
      organizationId,
      organizationName: organization.organizationName,
      members: []
    }, membership);

    await userMembershipStore.setJSON(userMembershipKey, updatedUserMembershipRecord);
    await organizationMemberStore.setJSON(adultMemberKey, membership);
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
      membership,
      message: `${targetEmail} was added as ${getRoleLabel(role)}. They can now sign in with Google using that email.`
    }));
  } catch (error) {
    console.error("[addOrganizationAdultMember] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not add faculty/admin member."
    }));
  }
};