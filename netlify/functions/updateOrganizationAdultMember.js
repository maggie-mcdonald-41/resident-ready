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

function upsertAdultMemberIndex(index = {}, updatedMembership = {}) {
  const members = Array.isArray(index.members) ? index.members : [];

  const withoutCurrentEmail = members.filter((member) =>
    member.email !== updatedMembership.email
  );

  return {
    ...(index || {}),
    version: 1,
    organizationId: updatedMembership.organizationId,
    organizationName: updatedMembership.organizationName,
    updatedAt: new Date().toISOString(),
    members: [
      {
        organizationId: updatedMembership.organizationId,
        organizationName: updatedMembership.organizationName,
        email: updatedMembership.email,
        displayName: updatedMembership.displayName || "",
        role: updatedMembership.role,
        roleLabel: updatedMembership.roleLabel,
        status: updatedMembership.status,
        assignedCohortIds: Array.isArray(updatedMembership.assignedCohortIds)
          ? updatedMembership.assignedCohortIds
          : [],
        addedByEmail: updatedMembership.addedByEmail,
        joinedAt: updatedMembership.joinedAt,
        updatedAt: updatedMembership.updatedAt
      },
      ...withoutCurrentEmail
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
    const targetRole = normalizeRole(body.role || body.targetRole || "");

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

    if (!["admin", "faculty"].includes(targetRole)) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Role must be admin or faculty."
      }));
    }

    connectLambda(event);

    const requesterMembership = await requireOrgAdmin(requester, organizationId);

    if (requesterMembership.role !== "primary_admin" && targetRole === "admin") {
      return withCors(jsonResponse(403, {
        success: false,
        error: "Only the Primary Admin can assign the Admin role."
      }));
    }

    if (requesterMembership.role !== "primary_admin") {
      return withCors(jsonResponse(403, {
        success: false,
        error: "Only the Primary Admin can update Faculty/Admin member roles right now."
      }));
    }

    if (requester.email && requester.email.toLowerCase() === targetEmail) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "You cannot change your own role from this panel."
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

    const existingAdultMembership = memberships.find((membership) =>
      membership.organizationId === organizationId &&
      ["admin", "faculty"].includes(membership.role) &&
      membership.status === "active"
    );

    if (!existingAdultMembership) {
      return withCors(jsonResponse(404, {
        success: false,
        error: "No active faculty/admin membership found for that email."
      }));
    }

    const now = new Date().toISOString();

    const updatedMembership = {
      ...existingAdultMembership,
      organizationId,
      organizationName: organization.organizationName,
      email: targetEmail,
      role: targetRole,
      roleLabel: getRoleLabel(targetRole),
      status: "active",
      permissions: getPermissionsForRole(targetRole),
      assignedCohortIds:
        targetRole === "admin"
          ? ["all"]
          : (Array.isArray(existingAdultMembership.assignedCohortIds)
              ? existingAdultMembership.assignedCohortIds.filter((cohortId) => cohortId && cohortId !== "all")
              : []),
      updatedByUserId: requester.residentId,
      updatedByEmail: requester.email,
      updatedAt: now
    };

    const updatedUserMembershipRecord = {
      ...existingUserMembershipRecord,
      email: existingUserMembershipRecord?.email || targetEmail,
      updatedAt: now,
      memberships: [
        updatedMembership,
        ...memberships.filter((membership) =>
          !(
            membership.organizationId === organizationId &&
            ["admin", "faculty"].includes(membership.role)
          )
        )
      ]
    };

    const oldAdultMemberKey =
      `organizations/${organizationId}/adult-members/${existingAdultMembership.role}-${targetEmailKey}.json`;
    const newAdultMemberKey =
      `organizations/${organizationId}/adult-members/${targetRole}-${targetEmailKey}.json`;
    const adultMemberIndexKey =
      `organizations/${organizationId}/adult-members/index.json`;

    const existingOldAdultMember = await organizationMemberStore.get(oldAdultMemberKey, {
      type: "json"
    });

    if (existingOldAdultMember && existingAdultMembership.role !== targetRole) {
      await organizationMemberStore.setJSON(oldAdultMemberKey, {
        ...existingOldAdultMember,
        status: "inactive",
        replacedByRole: targetRole,
        updatedAt: now
      });
    }

    const existingAdultIndex = await organizationMemberStore.get(adultMemberIndexKey, {
      type: "json"
    });

    const updatedAdultIndex = upsertAdultMemberIndex(existingAdultIndex || {
      version: 1,
      organizationId,
      organizationName: organization.organizationName,
      members: []
    }, updatedMembership);

    await userMembershipStore.setJSON(userMembershipKey, updatedUserMembershipRecord);
    await organizationMemberStore.setJSON(newAdultMemberKey, updatedMembership);
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
      membership: updatedMembership,
      message: `${targetEmail} is now ${getRoleLabel(targetRole)}.`
    }));
  } catch (error) {
    console.error("[updateOrganizationAdultMember] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not update faculty/admin member."
    }));
  }
};