const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

const DEV_SETUP_CODE =
  process.env.RESIDENT_READY_DEV_SETUP_CODE ||
  "RR-DEMO-SETUP";

function slugifyOrganizationName(name = "") {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "organization";
}

function createOrganizationId(name = "") {
  const slug = slugifyOrganizationName(name);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug}-${suffix}`;
}

function getEmailKey(email = "") {
  return sanitizeKeyFragment(String(email || "").trim().toLowerCase());
}

function buildDefaultCohort(now) {
  return {
    cohortId: "unassigned",
    label: "Unassigned",
    status: "active",
    academicYear: "",
    description: "Default holding cohort for residents who have not been placed yet.",
    residentIds: [],
    createdAt: now,
    updatedAt: now
  };
}

function mergeUserMembership(existing = {}, membership) {
  const memberships = Array.isArray(existing.memberships)
    ? existing.memberships
    : [];

  const withoutCurrent = memberships.filter(
    (item) => item.organizationId !== membership.organizationId
  );

  return {
    version: 1,
    userId: membership.userId,
    email: membership.email,
    updatedAt: new Date().toISOString(),
    memberships: [membership, ...withoutCurrent]
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
    const user = requireResident(event);
    const body = readJsonBody(event);

    const setupCode = String(body.setupCode || "").trim();
    const organizationName = String(body.organizationName || "").trim();

    if (!setupCode || setupCode !== DEV_SETUP_CODE) {
      return withCors(jsonResponse(403, {
        success: false,
        error: "Invalid setup code."
      }));
    }

    if (!organizationName) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Organization name is required."
      }));
    }

    connectLambda(event);

    const now = new Date().toISOString();
    const organizationId = createOrganizationId(organizationName);
    const emailKey = getEmailKey(user.email);

    const organizationStore = getStore("resident-ready-organizations");
    const userMembershipStore = getStore("resident-ready-user-memberships");
    const organizationMemberStore = getStore("resident-ready-organization-members");

    const defaultCohort = buildDefaultCohort(now);

    const organization = {
      version: 1,
      organizationId,
      organizationName,
      status: "active",
      setupStatus: "claimed",
      billingProvider: "development",
      externalCustomerId: null,
      externalSubscriptionId: null,
      subscriptionStatus: "development_active",
      planId: "development",
      planLimits: {
        maxResidents: 250,
        maxFaculty: 50,
        maxCohorts: 25
      },
      primaryAdminUserId: user.residentId,
      primaryAdminEmail: user.email,
      createdBy: user.email,
      createdAt: now,
      updatedAt: now
    };

    const primaryAdminMembership = {
      version: 1,
      organizationId,
      organizationName,
      userId: user.residentId,
      email: user.email,
      displayName: user.name || "",
      role: "primary_admin",
      roleLabel: "Primary Admin",
      status: "active",
      permissions: [
        "manage_admins",
        "manage_faculty",
        "manage_cohorts",
        "manage_residents",
        "create_access_codes",
        "assign_work",
        "view_faculty_dashboard",
        "view_resident_progress",
        "leave_feedback"
      ],
      activeCohortId: null,
      assignedCohortIds: ["all"],
      joinedAt: now,
      updatedAt: now
    };

    const organizationKey = `organizations/${organizationId}.json`;
    const cohortIndexKey = `organizations/${organizationId}/cohorts/index.json`;
    const cohortKey = `organizations/${organizationId}/cohorts/unassigned.json`;
    const organizationMemberKey = `organizations/${organizationId}/members/${user.residentId}.json`;
    const userMembershipKey = `users/${emailKey}/memberships.json`;

    const existingUserMemberships = await userMembershipStore.get(userMembershipKey, {
      type: "json"
    });

    const updatedUserMemberships = mergeUserMembership(
      existingUserMemberships || {},
      primaryAdminMembership
    );

    await organizationStore.setJSON(organizationKey, organization);

    await organizationStore.setJSON(cohortIndexKey, {
      version: 1,
      organizationId,
      organizationName,
      updatedAt: now,
      cohorts: [defaultCohort]
    });

    await organizationStore.setJSON(cohortKey, defaultCohort);
    await organizationMemberStore.setJSON(organizationMemberKey, primaryAdminMembership);
    await userMembershipStore.setJSON(userMembershipKey, updatedUserMemberships);

    return withCors(jsonResponse(200, {
      success: true,
      organization,
      membership: primaryAdminMembership,
      setup: {
        defaultCohort,
        userMembershipKey,
        organizationMemberKey
      }
    }));
  } catch (error) {
    console.error("[claimOrganization] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not claim organization."
    }));
  }
};