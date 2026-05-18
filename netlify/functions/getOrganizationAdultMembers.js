const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const { requireOrgAdmin } = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors
} = require("./_shared/http");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (event.httpMethod !== "GET") {
    return withCors(methodNotAllowed());
  }

  try {
    const requester = requireResident(event);
    const params = event.queryStringParameters || {};
    const organizationId = sanitizeKeyFragment(params.organizationId || "");

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    connectLambda(event);

    await requireOrgAdmin(requester, organizationId);

    const organizationMemberStore = getStore("resident-ready-organization-members");
    const adultMemberIndexKey = `organizations/${organizationId}/adult-members/index.json`;

    const index = await organizationMemberStore.get(adultMemberIndexKey, {
      type: "json"
    });

    const members = Array.isArray(index?.members)
      ? index.members.filter((member) => member.status !== "inactive")
      : [];

    return withCors(jsonResponse(200, {
      success: true,
      organizationId,
      organizationName: index?.organizationName || "",
      members
    }));
  } catch (error) {
    console.error("[getOrganizationAdultMembers] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load faculty/admin members."
    }));
  }
};