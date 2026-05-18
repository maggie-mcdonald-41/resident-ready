const { getStore, connectLambda } = require("@netlify/blobs");
const { requireResident } = require("./_shared/auth");
const { getUserMemberships } = require("./_shared/orgAccess");
const {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
} = require("./_shared/http");

function safeString(value, fallback = "") {
  return String(value || fallback).trim();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getAttemptType(record = {}) {
  return record.type || record.scoredAttempt?.type || "diagnostic";
}

function getResidentProfileSnapshot(record = {}, resident = {}) {
  const snapshot = record.residentProfileSnapshot || {};

  return {
    displayName: snapshot.displayName || resident.name || "",
    specialtyTrack: snapshot.specialtyTrack || "",
    programYear: snapshot.programYear || "",
    boardGoal: snapshot.boardGoal || "",
    preferredStudyStyle: snapshot.preferredStudyStyle || "",
    email: snapshot.email || resident.email || null,
    googleName: snapshot.googleName || resident.name || ""
  };
}

function getFacultyScope(record = {}) {
  return record.facultyScope || "default";
}

function getCohortId(record = {}) {
  return record.cohortId || "unassigned";
}

function getActiveAttemptMembership(memberships = []) {
  const activeMemberships = memberships.filter((membership) =>
    membership && membership.status === "active" && membership.organizationId
  );

  return (
    activeMemberships.find((membership) => membership.role === "resident") ||
    activeMemberships.find((membership) => membership.role === "primary_admin") ||
    activeMemberships.find((membership) => membership.role === "admin") ||
    activeMemberships.find((membership) => membership.role === "faculty") ||
    null
  );
}

function getOrganizationContext(record = {}, membership = null) {
  const organizationId =
    record.organizationId ||
    record.assignmentContext?.organizationId ||
    membership?.organizationId ||
    null;

  const organizationName =
    record.organizationName ||
    record.assignmentContext?.organizationName ||
    membership?.organizationName ||
    null;

  const cohortId =
    record.cohortId ||
    record.assignmentContext?.cohortId ||
    membership?.activeCohortId ||
    "unassigned";

  const cohortLabel =
    record.cohortLabel ||
    record.assignmentContext?.cohortLabel ||
    membership?.activeCohortLabel ||
    (cohortId === "unassigned" ? "Unassigned" : cohortId);

  return {
    organizationId,
    organizationName,
    cohortId,
    cohortLabel,
    membershipRole: membership?.role || null
  };
}

function buildAttemptSummary(record = {}, resident = {}, organizationContext = {}) {
  const scoredAttempt = record.scoredAttempt || {};
  const results = Array.isArray(scoredAttempt.results) ? scoredAttempt.results : [];
  const totalQuestions = safeNumber(scoredAttempt.totalQuestions || results.length, 0);
  const correctCount = results.filter((result) => result && result.isCorrect).length;
  const flaggedCount = Object.values(scoredAttempt.flaggedQuestions || {}).filter(Boolean).length;

  const type = getAttemptType(record);
  const percentCorrect = safeNumber(scoredAttempt.percentCorrect, 0);
  const profileSnapshot = getResidentProfileSnapshot(record, resident);
  const facultyScope = getFacultyScope(record);
  const cohortId = organizationContext.cohortId || getCohortId(record);
  const studentFeedback = record.studentFeedback || {};

  return {
    id: record.id,
    residentId: resident.residentId,
    residentEmail: resident.email,
    residentName: profileSnapshot.displayName || profileSnapshot.googleName || resident.name || resident.email,
    displayName: profileSnapshot.displayName,
    specialtyTrack: profileSnapshot.specialtyTrack,
    programYear: profileSnapshot.programYear,
    boardGoal: profileSnapshot.boardGoal,
    preferredStudyStyle: profileSnapshot.preferredStudyStyle,
    facultyScope,
    organizationId: organizationContext.organizationId || null,
    organizationName: organizationContext.organizationName || null,
    cohortId,
    cohortLabel: organizationContext.cohortLabel || cohortId,
    membershipRole: organizationContext.membershipRole || null,
    type,
    focusTag: record.focusTag || scoredAttempt.focusTag || null,
    focusLabel: record.focusLabel || scoredAttempt.focusLabel || null,
    savedAt: record.savedAt,
    finishedAt: scoredAttempt.diagnosticFinishedAt || record.savedAt,
    startedAt: scoredAttempt.diagnosticStartedAt || null,
    percentCorrect,
    totalQuestions,
    correctCount,
    missedCount: Math.max(0, totalQuestions - correctCount),
    flaggedCount,
    totalTimeSeconds: safeNumber(scoredAttempt.totalTimeSeconds, 0),
    studentFeedbackSnapshot: {
      scoreLine: studentFeedback.scoreLine || "",
      strengthsLine: studentFeedback.strengthsLine || "",
      weaknessesLine: studentFeedback.weaknessesLine || "",
      errorPatternLine: studentFeedback.errorPatternLine || ""
    },
    createdBy: resident.email,
    updatedAt: new Date().toISOString()
  };
}

function cleanAttemptRecord(record = {}, resident = {}, organizationContext = {}) {
  const now = new Date().toISOString();
  const type = getAttemptType(record);
  const id = safeString(record.id, `attempt-${Date.now()}`);

  const profileSnapshot = getResidentProfileSnapshot(record, resident);
  const facultyScope = getFacultyScope(record);
  const cohortId = organizationContext.cohortId || getCohortId(record);

  return {
    id,
    savedAt: record.savedAt || now,
    type,
    focusTag: record.focusTag || record.scoredAttempt?.focusTag || null,
    focusLabel: record.focusLabel || record.scoredAttempt?.focusLabel || null,
    facultyScope,
    organizationId: organizationContext.organizationId || null,
    organizationName: organizationContext.organizationName || null,
    cohortId,
    cohortLabel: organizationContext.cohortLabel || cohortId,
    membershipRole: organizationContext.membershipRole || null,
    assignmentContext: {
      ...(record.assignmentContext || {}),
      organizationId: organizationContext.organizationId || record.assignmentContext?.organizationId || null,
      organizationName: organizationContext.organizationName || record.assignmentContext?.organizationName || null,
      cohortId,
      cohortLabel: organizationContext.cohortLabel || record.assignmentContext?.cohortLabel || cohortId
    },
    facultyReviewSnapshot: record.facultyReviewSnapshot || null,
    residentProfileSnapshot: profileSnapshot,
    scoredAttempt: {
      ...(record.scoredAttempt || {}),
      type,
      focusTag: record.focusTag || record.scoredAttempt?.focusTag || null,
      focusLabel: record.focusLabel || record.scoredAttempt?.focusLabel || null
    },
    facultySummary: record.facultySummary || null,
    studentFeedback: record.studentFeedback || null,
    residentId: resident.residentId,
    residentEmail: resident.email,
    updatedAt: now
  };
}

function mergeFacultyRoster(roster = {}, summary = {}) {
  const existingResidents = Array.isArray(roster.residents) ? roster.residents : [];
  const withoutCurrent = existingResidents.filter((item) => item.residentId !== summary.residentId);

  const residentRosterItem = {
    residentId: summary.residentId,
    residentEmail: summary.residentEmail,
    residentName: summary.residentName,
    displayName: summary.displayName,
    specialtyTrack: summary.specialtyTrack,
    programYear: summary.programYear,
    boardGoal: summary.boardGoal,
    preferredStudyStyle: summary.preferredStudyStyle,
    organizationId: summary.organizationId || null,
    organizationName: summary.organizationName || null,
    cohortId: summary.cohortId,
    cohortLabel: summary.cohortLabel || summary.cohortId,
    facultyScope: summary.facultyScope,
    latestAttemptId: summary.id,
    latestAttemptType: summary.type,
    latestPercentCorrect: summary.percentCorrect,
    latestAttemptSavedAt: summary.savedAt,
    updatedAt: new Date().toISOString()
  };

  const residents = [residentRosterItem, ...withoutCurrent]
    .sort((a, b) => {
      const nameA = String(a.residentName || a.residentEmail || "").toLowerCase();
      const nameB = String(b.residentName || b.residentEmail || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  return {
    version: 1,
    appName: "Resident Ready",
    facultyScope: summary.facultyScope,
    organizationId: summary.organizationId || null,
    organizationName: summary.organizationName || null,
    cohortId: summary.cohortId || null,
    cohortLabel: summary.cohortLabel || null,
    updatedAt: new Date().toISOString(),
    residents
  };
}

function mergeFacultyRecentAttempts(recentIndex = {}, summary = {}) {
  const existingAttempts = Array.isArray(recentIndex.attempts) ? recentIndex.attempts : [];
  const withoutCurrent = existingAttempts.filter((item) => item.id !== summary.id);

  const attempts = [summary, ...withoutCurrent]
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
    .slice(0, 200);

  return {
    version: 1,
    appName: "Resident Ready",
    facultyScope: summary.facultyScope,
    organizationId: summary.organizationId || null,
    organizationName: summary.organizationName || null,
    cohortId: summary.cohortId || null,
    cohortLabel: summary.cohortLabel || null,
    updatedAt: new Date().toISOString(),
    attempts
  };
}

function sanitizeFacultyReviewItem(item = {}) {
  return {
    questionNumber: item.questionNumber || null,
    questionId: item.questionId || null,
    stem: item.stem || "",
    answerChoices: Array.isArray(item.answerChoices)
      ? item.answerChoices.map((choice) => ({
          id: choice.id || choice.label || "",
          label: choice.label || choice.id || "",
          text: choice.text || ""
        }))
      : [],
    selectedAnswer: item.selectedAnswer || null,
    correctAnswer: item.correctAnswer || null,
    isCorrect: !!item.isCorrect,
    rationale: item.rationale || "",
    clinicalReasoningTakeaway: item.clinicalReasoningTakeaway || "",
    tags: item.tags || {},
    system: item.system || null,
    clinicalTask: item.clinicalTask || null,
    errorPattern: item.errorPattern || null
  };
}

function buildFacultySafeAttemptDetail(record = {}, summary = {}) {
  const scoredAttempt = record.scoredAttempt || {};
  const results = Array.isArray(scoredAttempt.results) ? scoredAttempt.results : [];
  const reviewSnapshot = record.facultyReviewSnapshot || {};
  const reviewItems = Array.isArray(reviewSnapshot.reviewItems)
    ? reviewSnapshot.reviewItems
    : [];

  const safeReviewItems = reviewItems.length
    ? reviewItems.map(sanitizeFacultyReviewItem)
    : results.map((result, index) => sanitizeFacultyReviewItem({
        questionNumber: index + 1,
        questionId: result.questionId || null,
        selectedAnswer:
          result.selectedAnswer ||
          result.selectedChoice ||
          result.selectedOption ||
          result.answer ||
          null,
        correctAnswer:
          result.correctAnswer ||
          result.correctChoice ||
          result.correctOption ||
          null,
        isCorrect: !!result.isCorrect,
        tags: result.tags || {},
        errorPattern: result.errorPattern || result.errorTag || null
      }));

  return {
    version: 1,
    appName: "Resident Ready",
    privacyLevel: "faculty_safe",
    facultyScope: summary.facultyScope,
    organizationId: summary.organizationId || null,
    organizationName: summary.organizationName || null,
    cohortId: summary.cohortId,
    cohortLabel: summary.cohortLabel || summary.cohortId,
    residentId: summary.residentId,
    residentEmail: summary.residentEmail,
    residentName: summary.residentName,
    displayName: summary.displayName,
    attemptId: summary.id,
    type: summary.type,
    focusTag: summary.focusTag,
    focusLabel: summary.focusLabel,
    assignmentContext: record.assignmentContext || null,
    savedAt: summary.savedAt,
    finishedAt: summary.finishedAt,
    startedAt: summary.startedAt,
    percentCorrect: summary.percentCorrect,
    totalQuestions: summary.totalQuestions,
    correctCount: summary.correctCount,
    missedCount: summary.missedCount,
    flaggedCount: summary.flaggedCount,
    totalTimeSeconds: summary.totalTimeSeconds,
    reviewItems: safeReviewItems,
    updatedAt: new Date().toISOString()
  };
}

function mergeFacultyResidentSummary(existingSummary = {}, summary = {}) {
  const existingAttempts = Array.isArray(existingSummary.attempts) ? existingSummary.attempts : [];
  const withoutCurrent = existingAttempts.filter((item) => item.id !== summary.id);

  const attempts = [summary, ...withoutCurrent]
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
    .slice(0, 100);

  const diagnosticAttempts = attempts.filter((item) => item.type === "diagnostic");
  const practiceAttempts = attempts.filter((item) => item.type === "practice");
  const latestDiagnostic = diagnosticAttempts[0] || null;

  return {
    version: 1,
    appName: "Resident Ready",
    facultyScope: summary.facultyScope,
    organizationId: summary.organizationId || null,
    organizationName: summary.organizationName || null,
    cohortId: summary.cohortId,
    cohortLabel: summary.cohortLabel || summary.cohortId,
    residentId: summary.residentId,
    residentEmail: summary.residentEmail,
    residentName: summary.residentName,
    displayName: summary.displayName,
    specialtyTrack: summary.specialtyTrack,
    programYear: summary.programYear,
    boardGoal: summary.boardGoal,
    preferredStudyStyle: summary.preferredStudyStyle,
    latestAttemptId: attempts[0]?.id || null,
    latestDiagnosticAttemptId: latestDiagnostic?.id || null,
    latestDiagnosticPercentCorrect: latestDiagnostic?.percentCorrect ?? null,
    diagnosticAttemptCount: diagnosticAttempts.length,
    practiceAttemptCount: practiceAttempts.length,
    totalAttemptCount: attempts.length,
    updatedAt: new Date().toISOString(),
    attempts,
    diagnosticAttempts,
    practiceAttempts
  };
}

function mergeAttemptSummary(index = {}, summary) {
  const existingSummaries = Array.isArray(index.attempts) ? index.attempts : [];
  const withoutCurrent = existingSummaries.filter((item) => item.id !== summary.id);

  const attempts = [summary, ...withoutCurrent]
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
    .slice(0, 100);

  const diagnosticAttempts = attempts.filter((item) => item.type === "diagnostic");
  const practiceAttempts = attempts.filter((item) => item.type === "practice");

  return {
    version: 1,
    appName: "Resident Ready",
    residentId: summary.residentId,
    updatedAt: new Date().toISOString(),
    latestDiagnosticAttemptId: diagnosticAttempts[0]?.id || null,
    latestPracticeAttemptId: practiceAttempts[0]?.id || null,
    attempts,
    diagnosticAttempts,
    practiceAttempts
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
    const resident = requireResident(event);
    const body = readJsonBody(event);

    if (!body || !body.record) {
      return withCors(jsonResponse(400, {
        success: false,
        error: "Missing attempt record."
      }));
    }

    connectLambda(event);

    const memberships = await getUserMemberships(resident);
    const activeAttemptMembership = getActiveAttemptMembership(memberships);
    const organizationContext = getOrganizationContext(body.record, activeAttemptMembership);

    const record = cleanAttemptRecord(body.record, resident, organizationContext);
    const summary = buildAttemptSummary(record, resident, organizationContext);

    const detailStore = getStore("resident-ready-attempt-details");
    const indexStore = getStore("resident-ready-attempt-indexes");
    const facultyIndexStore = getStore("resident-ready-faculty-indexes");
    const facultyAttemptDetailStore = getStore("resident-ready-faculty-attempt-details");

    const detailKey = `resident/${resident.residentId}/attempts/${record.id}.json`;
    const indexKey = `resident/${resident.residentId}/index.json`;

    const facultyRosterKey = `faculty/${summary.facultyScope}/roster.json`;
    const facultyRecentAttemptsKey = `faculty/${summary.facultyScope}/recent-attempts.json`;
    const facultyResidentSummaryKey = `faculty/${summary.facultyScope}/residents/${resident.residentId}/summary.json`;
    const facultyAttemptDetailKey = `faculty/${summary.facultyScope}/residents/${resident.residentId}/attempts/${record.id}.json`;

    const hasOrganizationScope = !!summary.organizationId;

    const organizationRosterKey = hasOrganizationScope
      ? `organizations/${summary.organizationId}/roster.json`
      : null;

    const organizationRecentAttemptsKey = hasOrganizationScope
      ? `organizations/${summary.organizationId}/recent-attempts.json`
      : null;

    const organizationResidentSummaryKey = hasOrganizationScope
      ? `organizations/${summary.organizationId}/residents/${resident.residentId}/summary.json`
      : null;

    const organizationAttemptDetailKey = hasOrganizationScope
      ? `organizations/${summary.organizationId}/residents/${resident.residentId}/attempts/${record.id}.json`
      : null;

    const organizationCohortRosterKey = hasOrganizationScope
      ? `organizations/${summary.organizationId}/cohorts/${summary.cohortId}/roster.json`
      : null;

    const organizationCohortRecentAttemptsKey = hasOrganizationScope
      ? `organizations/${summary.organizationId}/cohorts/${summary.cohortId}/recent-attempts.json`
      : null;

    const existingIndex = await indexStore.get(indexKey, { type: "json" });
    const updatedIndex = mergeAttemptSummary(existingIndex || {}, summary);

    const existingFacultyRoster = await facultyIndexStore.get(facultyRosterKey, { type: "json" });
    const updatedFacultyRoster = mergeFacultyRoster(existingFacultyRoster || {}, summary);

    const existingFacultyRecentAttempts = await facultyIndexStore.get(facultyRecentAttemptsKey, { type: "json" });
    const updatedFacultyRecentAttempts = mergeFacultyRecentAttempts(existingFacultyRecentAttempts || {}, summary);

    const existingFacultyResidentSummary = await facultyIndexStore.get(facultyResidentSummaryKey, { type: "json" });
    const updatedFacultyResidentSummary = mergeFacultyResidentSummary(existingFacultyResidentSummary || {}, summary);
    const facultySafeAttemptDetail = buildFacultySafeAttemptDetail(record, summary);

    let updatedOrganizationRoster = null;
    let updatedOrganizationRecentAttempts = null;
    let updatedOrganizationResidentSummary = null;
    let updatedOrganizationCohortRoster = null;
    let updatedOrganizationCohortRecentAttempts = null;

    if (hasOrganizationScope) {
      const existingOrganizationRoster = await facultyIndexStore.get(organizationRosterKey, { type: "json" });
      updatedOrganizationRoster = mergeFacultyRoster(existingOrganizationRoster || {}, summary);

      const existingOrganizationRecentAttempts = await facultyIndexStore.get(organizationRecentAttemptsKey, { type: "json" });
      updatedOrganizationRecentAttempts = mergeFacultyRecentAttempts(existingOrganizationRecentAttempts || {}, summary);

      const existingOrganizationResidentSummary = await facultyIndexStore.get(organizationResidentSummaryKey, { type: "json" });
      updatedOrganizationResidentSummary = mergeFacultyResidentSummary(existingOrganizationResidentSummary || {}, summary);

      const existingOrganizationCohortRoster = await facultyIndexStore.get(organizationCohortRosterKey, { type: "json" });
      updatedOrganizationCohortRoster = mergeFacultyRoster(existingOrganizationCohortRoster || {}, summary);

      const existingOrganizationCohortRecentAttempts = await facultyIndexStore.get(organizationCohortRecentAttemptsKey, { type: "json" });
      updatedOrganizationCohortRecentAttempts = mergeFacultyRecentAttempts(existingOrganizationCohortRecentAttempts || {}, summary);
    }

    await detailStore.setJSON(detailKey, record);
    await indexStore.setJSON(indexKey, updatedIndex);

    // Legacy preview path. Keep temporarily while transitioning old test data.
    await facultyIndexStore.setJSON(facultyRosterKey, updatedFacultyRoster);
    await facultyIndexStore.setJSON(facultyRecentAttemptsKey, updatedFacultyRecentAttempts);
    await facultyIndexStore.setJSON(facultyResidentSummaryKey, updatedFacultyResidentSummary);
    await facultyAttemptDetailStore.setJSON(facultyAttemptDetailKey, facultySafeAttemptDetail);

    // New organization-scoped path.
    if (hasOrganizationScope) {
      await facultyIndexStore.setJSON(organizationRosterKey, updatedOrganizationRoster);
      await facultyIndexStore.setJSON(organizationRecentAttemptsKey, updatedOrganizationRecentAttempts);
      await facultyIndexStore.setJSON(organizationResidentSummaryKey, updatedOrganizationResidentSummary);
      await facultyIndexStore.setJSON(organizationCohortRosterKey, updatedOrganizationCohortRoster);
      await facultyIndexStore.setJSON(organizationCohortRecentAttemptsKey, updatedOrganizationCohortRecentAttempts);
      await facultyAttemptDetailStore.setJSON(organizationAttemptDetailKey, facultySafeAttemptDetail);
    }

    return withCors(jsonResponse(200, {
      success: true,
      record,
      summary,
      index: updatedIndex,
      facultyIndex: {
        facultyScope: summary.facultyScope,
        organizationId: summary.organizationId || null,
        organizationName: summary.organizationName || null,
        cohortId: summary.cohortId,
        cohortLabel: summary.cohortLabel || summary.cohortId,
        rosterKey: facultyRosterKey,
        recentAttemptsKey: facultyRecentAttemptsKey,
        residentSummaryKey: facultyResidentSummaryKey,
        facultyAttemptDetailKey,
        organizationKeys: hasOrganizationScope
          ? {
              rosterKey: organizationRosterKey,
              recentAttemptsKey: organizationRecentAttemptsKey,
              residentSummaryKey: organizationResidentSummaryKey,
              cohortRosterKey: organizationCohortRosterKey,
              cohortRecentAttemptsKey: organizationCohortRecentAttemptsKey,
              attemptDetailKey: organizationAttemptDetailKey
            }
          : null
      }
    }));
  } catch (error) {
    console.error("[saveResidentAttempt] Error:", error);

    return withCors(jsonResponse(401, {
      success: false,
      error: error.message || "Could not save resident attempt."
    }));
  }
};