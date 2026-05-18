const { getStore } = require("@netlify/blobs");
const { sanitizeKeyFragment } = require("./auth");

function getEmailKey(email = "") {
  return sanitizeKeyFragment(String(email || "").trim().toLowerCase());
}

async function getUserMembershipRecord(user = {}) {
  const emailKey = getEmailKey(user.email);
  const userMembershipStore = getStore("resident-ready-user-memberships");

  const key = `users/${emailKey}/memberships.json`;
  const record = await userMembershipStore.get(key, { type: "json" });

  return {
    key,
    record: record || {
      version: 1,
      userId: user.residentId,
      email: user.email,
      memberships: []
    }
  };
}

async function getUserMemberships(user = {}) {
  const { record } = await getUserMembershipRecord(user);
  return Array.isArray(record.memberships) ? record.memberships : [];
}

function hasActiveRole(membership = {}, allowedRoles = []) {
  return !!(
    membership &&
    membership.status === "active" &&
    allowedRoles.includes(membership.role)
  );
}

async function requireOrganizationRole(user = {}, organizationId = "", allowedRoles = []) {
  if (!organizationId) {
    throw new Error("Missing organizationId.");
  }

  const memberships = await getUserMemberships(user);

  const membership = memberships.find((item) =>
    item.organizationId === organizationId &&
    hasActiveRole(item, allowedRoles)
  );

  if (!membership) {
    throw new Error("You do not have permission for this organization.");
  }

  return membership;
}

async function requireOrgAdmin(user = {}, organizationId = "") {
  return requireOrganizationRole(user, organizationId, [
    "primary_admin",
    "admin"
  ]);
}

async function requireFacultyOrAdmin(user = {}, organizationId = "") {
  return requireOrganizationRole(user, organizationId, [
    "primary_admin",
    "admin",
    "faculty"
  ]);
}

function isOrgAdminMembership(membership = {}) {
  return ["primary_admin", "admin"].includes(membership.role);
}

function getAssignedCohortIds(membership = {}) {
  return Array.isArray(membership.assignedCohortIds)
    ? membership.assignedCohortIds.filter(Boolean)
    : [];
}

function canAccessCohort(membership = {}, cohortId = "") {
  if (isOrgAdminMembership(membership)) return true;

  if (membership.role !== "faculty") return false;

  const assignedCohortIds = getAssignedCohortIds(membership);

  if (!assignedCohortIds.length) return false;
  if (assignedCohortIds.includes("all")) return true;

  return assignedCohortIds.includes(cohortId);
}

async function requireFacultyCohortAccess(user = {}, organizationId = "", cohortId = "") {
  const membership = await requireFacultyOrAdmin(user, organizationId);

  if (isOrgAdminMembership(membership)) {
    return membership;
  }

  if (!cohortId || cohortId === "all") {
    throw new Error("Select an assigned cohort to view faculty data.");
  }

  if (!canAccessCohort(membership, cohortId)) {
    throw new Error("You do not have access to this cohort.");
  }

  return membership;
}

function mergeUserMembership(existing = {}, membership = {}) {
  const memberships = Array.isArray(existing.memberships)
    ? existing.memberships
    : [];

  const withoutCurrent = memberships.filter((item) =>
    !(
      item.organizationId === membership.organizationId &&
      item.role === membership.role
    )
  );

  return {
    version: 1,
    userId: existing.userId || membership.userId,
    email: existing.email || membership.email,
    updatedAt: new Date().toISOString(),
    memberships: [membership, ...withoutCurrent]
  };
}

module.exports = {
  getEmailKey,
  getUserMembershipRecord,
  getUserMemberships,
  requireOrganizationRole,
  requireOrgAdmin,
  requireFacultyOrAdmin,
  requireFacultyCohortAccess,
  isOrgAdminMembership,
  getAssignedCohortIds,
  canAccessCohort,
  mergeUserMembership
};