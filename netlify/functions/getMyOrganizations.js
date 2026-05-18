const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors
} = require("./_shared/http");

function getEmailKey(email = "") {
  return sanitizeKeyFragment(String(email || "").trim().toLowerCase());
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  if (event.httpMethod !== "GET") {
    return withCors(methodNotAllowed());
  }

  try {
    const user = requireResident(event);

    connectLambda(event);

    const emailKey = getEmailKey(user.email);
    const userMembershipStore = getStore("resident-ready-user-memberships");

    const userMembershipKey = `users/${emailKey}/memberships.json`;
    const membershipRecord = await userMembershipStore.get(userMembershipKey, {
      type: "json"
    });

    const memberships = Array.isArray(membershipRecord?.memberships)
      ? membershipRecord.memberships
      : [];

    return withCors(jsonResponse(200, {
      success: true,
      user: {
        userId: user.residentId,
        email: user.email,
        name: user.name || ""
      },
      memberships
    }));
  } catch (error) {
    console.error("[getMyOrganizations] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not load organizations."
    }));
  }
};