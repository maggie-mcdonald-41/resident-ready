const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident, sanitizeKeyFragment } = require("./_shared/auth");
const { requireFacultyOrAdmin } = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function generateReadableCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = [];

  for (let group = 0; group < 3; group += 1) {
    let value = "";

    for (let index = 0; index < 4; index += 1) {
      value += alphabet[crypto.randomInt(0, alphabet.length)];
    }

    parts.push(value);
  }

  return `RR-${parts.join("-")}`;
}

function hashCode(code = "") {
  return crypto
    .createHash("sha256")
    .update(String(code || "").trim().toUpperCase())
    .digest("hex");
}

function getSafeCohortId(value = "unassigned") {
  return sanitizeKeyFragment(String(value || "unassigned").trim() || "unassigned");
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
    const body = readJsonBody(event);

    const organizationId = sanitizeKeyFragment(body.organizationId || "");
    const targetCohortId = getSafeCohortId(body.targetCohortId || "unassigned");
    const label = String(body.label || "Resident Join Code").trim();
    const maxUses = Math.max(1, Math.min(Number(body.maxUses || 500), 500));
    const expiresAt =
      body.expiresAt ||
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    if (!organizationId) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "organizationId is required."
      }));
    }

    connectLambda(event);

    const requesterMembership = await requireFacultyOrAdmin(requester, organizationId);

    const organizationStore = getStore("resident-ready-organizations");
    const accessCodeStore = getStore("resident-ready-access-codes");

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

    const now = new Date().toISOString();
    const code = generateReadableCode();
    const codeHash = hashCode(code);
    const codeId = `code_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

    const accessCode = {
      version: 1,
      codeId,
      codeHash,
      organizationId,
      organizationName: organization.organizationName,
      targetCohortId,
      targetCohortLabel: cohort.label || targetCohortId,
      label,
      roleGranted: "resident",
      status: "active",
      maxUses,
      currentUses: 0,
      expiresAt,
      createdByUserId: requester.residentId,
      createdByEmail: requester.email,
      createdByRole: requesterMembership.role,
      createdAt: now,
      updatedAt: now
    };

    const organizationCodeKey = `organizations/${organizationId}/access-codes/${codeId}.json`;
    const organizationCodeIndexKey = `organizations/${organizationId}/access-codes/index.json`;
    const lookupKey = `lookup/${codeHash}.json`;

    const existingIndex = await accessCodeStore.get(organizationCodeIndexKey, { type: "json" });
    const existingCodes = Array.isArray(existingIndex?.codes) ? existingIndex.codes : [];

    const codeSummary = {
      codeId,
      organizationId,
      organizationName: organization.organizationName,
      targetCohortId,
      targetCohortLabel: cohort.label || targetCohortId,
      label,
      roleGranted: "resident",
      status: "active",
      maxUses,
      currentUses: 0,
      expiresAt,
      createdByEmail: requester.email,
      createdAt: now,
      updatedAt: now
    };

    const updatedIndex = {
      version: 1,
      organizationId,
      organizationName: organization.organizationName,
      updatedAt: now,
      codes: [codeSummary, ...existingCodes].slice(0, 200)
    };

    await accessCodeStore.setJSON(organizationCodeKey, accessCode);
    await accessCodeStore.setJSON(organizationCodeIndexKey, updatedIndex);
    await accessCodeStore.setJSON(lookupKey, {
      version: 1,
      codeHash,
      organizationId,
      codeId,
      status: "active",
      createdAt: now
    });

    return withCors(jsonResponse(200, {
      success: true,
      code,
      accessCode: codeSummary
    }));
  } catch (error) {
    console.error("[createResidentAccessCode] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not create resident access code."
    }));
  }
};