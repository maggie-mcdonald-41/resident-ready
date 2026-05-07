//app.js

window.App = {
  showView(viewId) {
    document.querySelectorAll(".app-view").forEach((view) => {
      view.classList.remove("active-view");
    });

    document.getElementById(viewId).classList.add("active-view");

    if (viewId === "launchView") {
      this.loadSavedResidentData();
      this.renderResidentHome();
    }

    if (
      viewId === "residentResultsView" &&
      window.latestScoredAttempt &&
      window.latestStudentFeedback &&
      window.ResidentTestUI &&
      typeof window.ResidentTestUI.renderResidentResults === "function"
    ) {
      window.ResidentTestUI.renderResidentResults(
        window.latestScoredAttempt,
        window.latestStudentFeedback
      );
    }
  },

  renderResidentHome() {
    const scoredAttempt = window.latestScoredAttempt;
    const facultySummary = window.latestFacultySummary;

    this.renderResidentProfile();

    if (!scoredAttempt) {
      document.getElementById("residentHomeSummary").textContent =
        this.getPersonalizedDashboardSummary("empty");

      document.getElementById("homeScorePercent").textContent = "--%";
      document.getElementById("homeRiskLevel").textContent = "--";
      document.getElementById("homeQuestionCount").textContent = "--";

      const latestPanel = document.getElementById("residentLatestAttemptPanel");
      if (latestPanel) latestPanel.classList.add("hidden");

      const historyList = document.getElementById("residentAttemptHistoryList");
      if (historyList) {
        historyList.innerHTML =
          "Complete a diagnostic to begin building your attempt history.";
      }

      this.renderPracticeHistory();

      return;
    }

    document.getElementById("residentHomeSummary").textContent =
      this.getPersonalizedDashboardSummary("latest");

    document.getElementById("homeScorePercent").textContent =
      `${scoredAttempt.percentCorrect}%`;

    document.getElementById("homeRiskLevel").textContent =
      window.FacultyDashboardUI.getRiskLevel(scoredAttempt.percentCorrect);

    document.getElementById("homeQuestionCount").textContent =
      scoredAttempt.totalQuestions;

    this.renderLatestAttemptPanel(scoredAttempt);
    this.renderAttemptHistory();
    this.renderGrowthInsights();
    this.renderPracticeHistory();

    if (window.ResidentDashboardUI) {
      window.ResidentDashboardUI.render(facultySummary, scoredAttempt);
    }
  },

  getStorageKey() {
    return "doctorDashboardResidentMemory_v1";
  },

  getResidentMemory() {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};

      return {
        profile: parsed.profile || null,
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : []
      };
    } catch (error) {
      console.warn("[Doctor Dashboard] Could not read resident memory.", error);
      return {
        profile: null,
        attempts: []
      };
    }
  },

  saveResidentMemory(memory) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(memory));
    } catch (error) {
      console.warn("[Doctor Dashboard] Could not save resident memory.", error);
    }
  },

  getResidentProfile() {
    const memory = this.getResidentMemory();
    return memory.profile || null;
  },

  hasResidentProfile() {
    const profile = this.getResidentProfile();

    return !!(
      profile &&
      (
        profile.displayName ||
        profile.specialtyTrack ||
        profile.programYear ||
        profile.boardGoal ||
        profile.preferredStudyStyle
      )
    );
  },

  saveResidentProfile(profileData) {
    const memory = this.getResidentMemory();
    const existingProfile = memory.profile || {};

    memory.profile = {
      displayName: profileData.displayName || "",
      specialtyTrack: profileData.specialtyTrack || "",
      programYear: profileData.programYear || "",
      boardGoal: profileData.boardGoal || "",
      preferredStudyStyle: profileData.preferredStudyStyle || "",
      authProvider: existingProfile.authProvider || "local",
      userId: existingProfile.userId || null,
      email: existingProfile.email || null,
      updatedAt: new Date().toISOString()
    };

    this.saveResidentMemory(memory);
    this.renderResidentHome();
  },

  renderResidentProfile() {
    const card = document.getElementById("residentProfileCard");
    const summaryView = document.getElementById("residentProfileSummaryView");
    const formView = document.getElementById("residentProfileFormView");
    const title = document.getElementById("residentProfileTitle");
    const description = document.getElementById("residentProfileDescription");
    const chips = document.getElementById("residentProfileChips");
    const setupBtn = document.getElementById("setupResidentProfileBtn");
    const editBtn = document.getElementById("editResidentProfileBtn");

    if (!card || !summaryView || !formView || !title || !description || !chips) return;

    const profile = this.getResidentProfile();

    summaryView.classList.remove("hidden");
    formView.classList.add("hidden");

    if (!this.hasResidentProfile()) {
      title.textContent = "Personalize Resident Ready";
      description.textContent =
        "Add your track, program year, and board goal so your dashboard can better support your review plan.";
      chips.innerHTML = `
        <span>Local profile</span>
        <span>Google-ready later</span>
        <span>Resident-owned</span>
      `;

      if (setupBtn) setupBtn.classList.remove("hidden");
      if (editBtn) editBtn.classList.add("hidden");
      return;
    }

    const displayName = this.getProfileDisplayName(profile);
    const summaryParts = this.getProfileSummaryParts(profile);

    title.textContent = displayName
      ? `Welcome back, ${displayName}.`
      : "Welcome back.";

    description.textContent = summaryParts.length
      ? summaryParts.join(" · ")
      : "Your profile is saved locally on this device.";

    chips.innerHTML = this.getProfileChips(profile)
      .map((chip) => `<span>${chip}</span>`)
      .join("");

    if (setupBtn) setupBtn.classList.add("hidden");
    if (editBtn) editBtn.classList.remove("hidden");
  },

  openResidentProfileForm() {
    const summaryView = document.getElementById("residentProfileSummaryView");
    const formView = document.getElementById("residentProfileFormView");
    const profile = this.getResidentProfile() || {};

    if (!summaryView || !formView) return;

    document.getElementById("profileDisplayNameInput").value = profile.displayName || "";
    document.getElementById("profileSpecialtyTrackSelect").value = profile.specialtyTrack || "";
    document.getElementById("profileProgramYearSelect").value = profile.programYear || "";
    document.getElementById("profileBoardGoalSelect").value = profile.boardGoal || "";
    document.getElementById("profileStudyStyleSelect").value = profile.preferredStudyStyle || "";

    summaryView.classList.add("hidden");
    formView.classList.remove("hidden");
  },

  closeResidentProfileForm() {
    this.renderResidentProfile();
  },

  collectResidentProfileFormData() {
    return {
      displayName: document.getElementById("profileDisplayNameInput")?.value.trim() || "",
      specialtyTrack: document.getElementById("profileSpecialtyTrackSelect")?.value || "",
      programYear: document.getElementById("profileProgramYearSelect")?.value || "",
      boardGoal: document.getElementById("profileBoardGoalSelect")?.value || "",
      preferredStudyStyle: document.getElementById("profileStudyStyleSelect")?.value || ""
    };
  },

  getProfileDisplayName(profile = this.getResidentProfile()) {
    return profile?.displayName?.trim() || "";
  },

  getProfileSummaryParts(profile = this.getResidentProfile()) {
    if (!profile) return [];

    return [
      profile.specialtyTrack,
      profile.programYear,
      profile.boardGoal
    ].filter(Boolean);
  },

  getProfileChips(profile = this.getResidentProfile()) {
    if (!profile) return [];

    const chips = [];

    if (profile.specialtyTrack) chips.push(profile.specialtyTrack);
    if (profile.programYear) chips.push(profile.programYear);
    if (profile.boardGoal) chips.push(profile.boardGoal);
    if (profile.preferredStudyStyle) chips.push(profile.preferredStudyStyle);

    return chips.length ? chips : ["Profile saved locally"];
  },

  getPersonalizedDashboardSummary(state = "empty") {
    const profile = this.getResidentProfile();
    const displayName = this.getProfileDisplayName(profile);
    const boardGoal = profile?.boardGoal;

    const greeting = displayName ? `Welcome, ${displayName}. ` : "";

    if (state === "latest") {
      return `${greeting}Here is your latest saved diagnostic snapshot. Use this data to guide your next review session.`;
    }

    if (boardGoal) {
      return `${greeting}Complete your first diagnostic to generate ${boardGoal}-focused board-readiness feedback and targeted review data.`;
    }

    return `${greeting}Complete your first diagnostic to generate board-readiness feedback and targeted review data.`;
  },


  getAttemptType(record) {
    return record?.type || record?.scoredAttempt?.type || "diagnostic";
  },

  getDiagnosticAttempts(memory = this.getResidentMemory()) {
    return (memory.attempts || []).filter(
      (record) => this.getAttemptType(record) === "diagnostic"
    );
  },

  getPracticeAttempts(memory = this.getResidentMemory()) {
    return (memory.attempts || []).filter(
      (record) => this.getAttemptType(record) === "practice"
    );
  },

  loadSavedResidentData() {
    const memory = this.getResidentMemory();
    const latestRecord = this.getDiagnosticAttempts(memory)[0];

    if (!latestRecord) return;

    window.latestScoredAttempt = latestRecord.scoredAttempt;
    window.latestFacultySummary = latestRecord.facultySummary;
    window.latestStudentFeedback = latestRecord.studentFeedback;
  },

  saveResidentAttempt(scoredAttempt, facultySummary, studentFeedback, metadata = {}) {
    const memory = this.getResidentMemory();
    const type = metadata.type || scoredAttempt?.type || "diagnostic";
    const focusTag = metadata.focusTag || scoredAttempt?.focusTag || null;
    const focusLabel = metadata.focusLabel || scoredAttempt?.focusLabel || null;

    const record = {
      id: `attempt-${Date.now()}`,
      savedAt: new Date().toISOString(),
      type,
      focusTag,
      focusLabel,
      scoredAttempt: {
        ...scoredAttempt,
        type,
        focusTag,
        focusLabel
      },
      facultySummary,
      studentFeedback
    };

    memory.attempts = [record, ...(memory.attempts || [])].slice(0, 20);

    this.saveResidentMemory(memory);
  },

  renderLatestAttemptPanel(scoredAttempt) {
    const panel = document.getElementById("residentLatestAttemptPanel");
    const title = document.getElementById("latestAttemptTitle");
    const details = document.getElementById("latestAttemptDetails");

    if (!panel || !title || !details) return;

    const total = scoredAttempt.totalQuestions || scoredAttempt.results?.length || 0;
    const correct = scoredAttempt.results?.filter((result) => result.isCorrect).length || 0;
    const missed = Math.max(0, total - correct);
    const flagged = Object.values(scoredAttempt.flaggedQuestions || {}).filter(Boolean).length;
    const totalTime = this.formatSeconds(scoredAttempt.totalTimeSeconds || 0);
    const finishedAt = scoredAttempt.diagnosticFinishedAt
      ? this.formatDate(scoredAttempt.diagnosticFinishedAt)
      : "Most recent attempt";

    panel.classList.remove("hidden");

    title.textContent = `${scoredAttempt.percentCorrect}% · ${correct}/${total} correct`;
    details.textContent =
      `${finishedAt} · ${totalTime} total · ${missed} missed · ${flagged} flagged`;
  },

  renderAttemptHistory() {
    const historyList = document.getElementById("residentAttemptHistoryList");
    if (!historyList) return;

    const memory = this.getResidentMemory();
    const attempts = this.getDiagnosticAttempts(memory);

    if (!attempts.length) {
      historyList.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Saved diagnostics will appear here.</strong>
          <p>Complete a diagnostic to begin building your board-readiness history.</p>
        </div>
      `;
      return;
    }

    const latestAttempt = attempts[0].scoredAttempt || {};
    const oldestAttempt = attempts[attempts.length - 1].scoredAttempt || {};
    const latestScore = Number(latestAttempt.percentCorrect || 0);
    const oldestScore = Number(oldestAttempt.percentCorrect || 0);
    const scoreChange = latestScore - oldestScore;

    let trendMessage = "Complete another diagnostic to see your board-readiness trend.";

    if (attempts.length >= 2) {
      if (scoreChange > 0) {
        trendMessage = `Your diagnostic score is up ${scoreChange} percentage point${scoreChange === 1 ? "" : "s"} across saved attempts.`;
      } else if (scoreChange < 0) {
        trendMessage = `Your latest diagnostic score dipped by ${Math.abs(scoreChange)} percentage point${Math.abs(scoreChange) === 1 ? "" : "s"}. Use missed and flagged questions to guide your next review.`;
      } else {
        trendMessage = "Your diagnostic score is holding steady across saved attempts. Keep using missed and flagged questions to sharpen your next review.";
      }
    }

    const summaryHtml = `
      <div class="diagnostic-history-summary">
        <div>
          <strong>Diagnostic History Snapshot</strong>
          <p>${trendMessage}</p>
        </div>

        <div class="diagnostic-history-mini-metrics">
          <span><strong>${attempts.length}</strong> saved diagnostic${attempts.length === 1 ? "" : "s"}</span>
          <span><strong>${latestScore}%</strong> latest score</span>
        </div>
      </div>
    `;

    const historyHtml = attempts
      .map((record, index) => {
        const attempt = record.scoredAttempt;
        const total = attempt.totalQuestions || attempt.results?.length || 0;
        const correct = attempt.results?.filter((result) => result.isCorrect).length || 0;
        const flagged = Object.values(attempt.flaggedQuestions || {}).filter(Boolean).length;
        const totalTime = this.formatSeconds(attempt.totalTimeSeconds || 0);
        const savedAt = record.savedAt ? this.formatDate(record.savedAt) : "Saved attempt";

        return `
          <div class="attempt-history-item diagnostic-history-item">
            <div>
              <strong>${index === 0 ? "Latest Diagnostic" : `Diagnostic ${attempts.length - index}`}</strong>
              <span>${savedAt}</span>
            </div>

            <div>
              <strong>${attempt.percentCorrect}%</strong>
              <span>${correct}/${total} correct · ${totalTime} · ${flagged} flagged</span>
            </div>

            <button
              class="secondary attempt-review-btn"
              type="button"
              data-attempt-id="${record.id}"
              aria-label="Review ${index === 0 ? "latest diagnostic" : `diagnostic ${attempts.length - index}`}"
            >
              Review Diagnostic
            </button>
          </div>
        `;
      })
      .join("");

    historyList.innerHTML = `
      ${summaryHtml}
      <div class="diagnostic-history-divider">Saved Diagnostic Attempts</div>
      <div class="history-scroll-list diagnostic-attempt-scroll-list">
        ${historyHtml}
      </div>
    `;
  },

  renderGrowthInsights() {
    const panel = document.getElementById("growthInsightsPanel");
    if (!panel) return;

    const memory = this.getResidentMemory();
    const attempts = this.getDiagnosticAttempts(memory);

    if (attempts.length < 2) {
      panel.innerHTML = `
        <div class="growth-empty-state">
          <strong>Growth insights unlock after 2 diagnostics.</strong>
          <p>Complete one more diagnostic to compare your score, strengths, and priority review areas over time.</p>
        </div>
      `;
      return;
    }

    const latestAttempt = attempts[0].scoredAttempt;
    const oldestAttempt = attempts[attempts.length - 1].scoredAttempt;

    const latestScore = Number(latestAttempt.percentCorrect || 0);
    const oldestScore = Number(oldestAttempt.percentCorrect || 0);
    const scoreChange = latestScore - oldestScore;

    const directionText =
      scoreChange > 0
        ? `up ${scoreChange} percentage point${scoreChange === 1 ? "" : "s"}`
        : scoreChange < 0
          ? `down ${Math.abs(scoreChange)} percentage point${Math.abs(scoreChange) === 1 ? "" : "s"}`
          : "holding steady";

    const directionClass =
      scoreChange > 0
        ? "growth-positive"
        : scoreChange < 0
          ? "growth-needs-attention"
          : "growth-steady";

    const tagGrowth = this.calculateTagGrowthInsights(attempts);
    const consistentStrengths = tagGrowth.consistentStrengths.slice(0, 3);
    const persistentWeaknesses = tagGrowth.persistentWeaknesses.slice(0, 3);
    const mostImproved = tagGrowth.mostImproved[0];

    panel.innerHTML = `
      <div class="growth-score-summary ${directionClass}">
        <span>Overall Diagnostic Growth</span>
        <strong>${oldestScore}% → ${latestScore}%</strong>
        <p>Your diagnostic score is ${directionText} across your saved attempts.</p>
      </div>

      <div class="growth-insight-grid">
        <div class="growth-insight-box growth-strength-box">
          <strong>Consistent Strengths</strong>
          ${
            consistentStrengths.length
              ? `<ul>${consistentStrengths.map((item) => `
                  <li>${this.formatTagForResident(item.tag)} <span>${item.average}% average</span></li>
                `).join("")}</ul>`
              : `<p>Complete more diagnostics to identify consistent strengths.</p>`
          }
        </div>

        <div class="growth-insight-box growth-priority-box">
          <strong>Persistent Review Areas</strong>
          ${
            persistentWeaknesses.length
              ? `<ul>${persistentWeaknesses.map((item) => `
                  <li>${this.formatTagForResident(item.tag)} <span>${item.average}% average</span></li>
                `).join("")}</ul>`
              : `<p>No repeated weakness pattern is clear yet.</p>`
          }
        </div>

        <div class="growth-insight-box growth-improved-box">
          <strong>Most Improved Area</strong>
          ${
            mostImproved
              ? `<p>${this.formatTagForResident(mostImproved.tag)} improved by <strong>${mostImproved.change} percentage point${mostImproved.change === 1 ? "" : "s"}</strong>.</p>`
              : `<p>Growth by skill will appear after more repeated skill data is available.</p>`
          }
        </div>
      </div>

      <div class="growth-next-step">
        <strong>Recommended Focus</strong>
        <p>${this.getGrowthRecommendation(scoreChange, persistentWeaknesses, consistentStrengths)}</p>
      </div>
    `;
  },

  renderPracticeHistory() {
    const historyList = document.getElementById("residentPracticeHistoryList");
    if (!historyList) return;

    const attempts = this.getPracticeAttempts();

    if (!attempts.length) {
      historyList.innerHTML = `
        <div class="practice-empty-state">
          <strong>Targeted practice will appear here.</strong>
          <p>After a diagnostic, use Suggested Remediation to start a short practice set for a focus area.</p>
        </div>
      `;
      return;
    }

    const latestRecord = attempts[0];
    const latestAttempt = latestRecord.scoredAttempt || {};
    const latestFocusTag = latestRecord.focusTag || latestAttempt.focusTag || "";
    const latestFocusLabel = latestRecord.focusLabel || latestAttempt.focusLabel || "Targeted Practice";
    const latestScore = Number(latestAttempt.percentCorrect || 0);

    const relatedAttempts = attempts.filter((record) =>
      (record.focusTag || record.scoredAttempt?.focusTag) === latestFocusTag
    );

    let trendMessage = "Complete another practice set in this focus area to see a practice trend.";

    if (relatedAttempts.length >= 2) {
      const newest = Number(relatedAttempts[0].scoredAttempt?.percentCorrect || 0);
      const previous = Number(relatedAttempts[1].scoredAttempt?.percentCorrect || 0);
      const change = newest - previous;

      if (change > 0) {
        trendMessage = `You improved by ${change} percentage point${change === 1 ? "" : "s"} compared with your previous ${latestFocusLabel} practice set.`;
      } else if (change < 0) {
        trendMessage = `This focus area still deserves attention. Review your explanations, then try another ${latestFocusLabel} practice set.`;
      } else {
        trendMessage = `Your ${latestFocusLabel} practice score is holding steady. Keep reviewing the rationales to build confidence.`;
      }
    }

    const trendHtml = `
      <div class="practice-history-trend-grid">
        <div class="practice-insight-next-step">
          <strong>Practice Trend</strong>
          <p>${trendMessage}</p>
        </div>
      </div>
    `;

    const historyHtml = attempts
      .slice(0, 5)
      .map((record, index) => {
        const attempt = record.scoredAttempt || {};
        const focusTag = record.focusTag || attempt.focusTag || "";
        const focusLabel = record.focusLabel || attempt.focusLabel || "Targeted Practice";
        const total = attempt.totalQuestions || attempt.results?.length || 0;
        const correct = attempt.results?.filter((result) => result.isCorrect).length || 0;
        const flagged = Object.values(attempt.flaggedQuestions || {}).filter(Boolean).length;
        const totalTime = this.formatSeconds(attempt.totalTimeSeconds || 0);
        const savedAt = record.savedAt ? this.formatDate(record.savedAt) : "Saved practice";

        return `
          <div class="attempt-history-item practice-history-item">
            <div>
              <strong>${index === 0 ? "Latest Practice" : `Practice ${attempts.length - index}`}</strong>
              <span>${focusLabel} · ${savedAt}</span>
            </div>

            <div>
              <strong>${attempt.percentCorrect || 0}%</strong>
              <span>${correct}/${total} correct · ${totalTime} · ${flagged} flagged</span>
            </div>

            <div class="practice-history-actions">
              <button
                class="secondary attempt-review-btn practice-review-btn"
                type="button"
                data-attempt-id="${record.id}"
                aria-label="Review ${focusLabel} practice attempt"
              >
                Review
              </button>

              <button
                class="secondary attempt-review-btn practice-again-btn"
                type="button"
                data-practice-tag="${this.escapeAttribute(focusTag)}"
                data-practice-label="${this.escapeAttribute(focusLabel)}"
                aria-label="Practice ${focusLabel} again"
              >
                Practice Again
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    historyList.innerHTML = `
      ${trendHtml}
      <div class="practice-history-divider">Recent Practice Attempts</div>
      <div class="history-scroll-list practice-attempt-scroll-list">
        ${historyHtml}
      </div>
    `;
  },




  calculateTagGrowthInsights(attemptRecords) {
    const chronologicalAttempts = [...attemptRecords].reverse();
    const tagStats = {};

    chronologicalAttempts.forEach((record, attemptIndex) => {
      const attempt = record.scoredAttempt;
      const attemptTagStats = this.getAttemptTagStats(attempt);

      Object.entries(attemptTagStats).forEach(([tag, stats]) => {
        if (!tagStats[tag]) {
          tagStats[tag] = {
            tag,
            attempts: []
          };
        }

        tagStats[tag].attempts.push({
          attemptIndex,
          correct: stats.correct,
          total: stats.total,
          percent: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
        });
      });
    });

    const analyzed = Object.values(tagStats)
      .filter((item) => item.attempts.length >= 2)
      .map((item) => {
        const percents = item.attempts.map((attempt) => attempt.percent);
        const first = percents[0];
        const latest = percents[percents.length - 1];
        const average = Math.round(
          percents.reduce((sum, value) => sum + value, 0) / percents.length
        );

        return {
          tag: item.tag,
          first,
          latest,
          average,
          change: latest - first,
          attemptCount: item.attempts.length
        };
      });

    return {
      consistentStrengths: analyzed
        .filter((item) => item.average >= 75 && item.latest >= 70)
        .sort((a, b) => b.average - a.average),

      persistentWeaknesses: analyzed
        .filter((item) => item.average < 65 || item.latest < 60)
        .sort((a, b) => a.average - b.average),

      mostImproved: analyzed
        .filter((item) => item.change > 0)
        .sort((a, b) => b.change - a.change)
    };
  },

  getAttemptTagStats(attempt) {
    const stats = {};
    const questions = window.MED_SAMPLE_QUESTIONS || [];
    const results = attempt?.results || [];

    results.forEach((result) => {
      const question = questions.find((q) => q.id === result.questionId);
      if (!question || !question.tags) return;

      const tags = this.flattenQuestionTags(question.tags);

      tags.forEach((tag) => {
        if (!stats[tag]) {
          stats[tag] = {
            correct: 0,
            total: 0
          };
        }

        stats[tag].total += 1;

        if (result.isCorrect) {
          stats[tag].correct += 1;
        }
      });
    });

    return stats;
  },

  flattenQuestionTags(tags) {
    const allTags = [];

    Object.values(tags || {}).forEach((value) => {
      if (Array.isArray(value)) {
        allTags.push(...value);
      } else if (typeof value === "string") {
        allTags.push(value);
      }
    });

    return Array.from(new Set(allTags));
  },

  escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  formatTagForResident(tag) {
    if (!tag) return "";

    const customLabels = {
      riskStratification: "Risk Stratification",
      chronicDiseaseManagement: "Chronic Disease Management",
      emergencyCare: "Emergency Care",
      diagnosis: "Diagnosis",
      pharmacology: "Pharmacology",
      infectiousDisease: "Infectious Disease",
      clinicalReasoning: "Clinical Reasoning",
      initialManagement: "Initial Management",
      nextBestStep: "Next Best Step",
      longTermManagement: "Long-Term Management",
      pharmacotherapy: "Medication Selection",
      treatmentSelection: "Treatment Selection",
      medicationOptimization: "Medication Optimization",
      triageAndDisposition: "Triage & Disposition",
      patientSafety: "Patient Safety",
      patientSafetyDecision: "Patient Safety Decision"
    };

    if (customLabels[tag]) {
      return customLabels[tag];
    }

    const engineLabel =
      window.MED_RESULTS_ENGINE &&
      typeof window.MED_RESULTS_ENGINE.getReadableTagLabel === "function"
        ? window.MED_RESULTS_ENGINE.getReadableTagLabel(tag)
        : tag;

    return String(engineLabel || tag)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  },

  getGrowthRecommendation(scoreChange, persistentWeaknesses, consistentStrengths) {
    if (persistentWeaknesses.length) {
      const topWeakness = this.formatTagForResident(persistentWeaknesses[0].tag);

      if (scoreChange > 0) {
        return `You are showing overall growth. Keep that momentum going by focusing your next review on ${topWeakness}.`;
      }

      return `Your next review should focus on ${topWeakness}. This area is showing up repeatedly across saved diagnostics.`;
    }

    if (scoreChange > 0 && consistentStrengths.length) {
      const topStrength = this.formatTagForResident(consistentStrengths[0].tag);
      return `You are building momentum. ${topStrength} is becoming a consistent strength, so keep reviewing missed and flagged questions to maintain growth.`;
    }

    if (scoreChange < 0) {
      return "Your latest score dipped, but that can happen during growth. Review missed questions carefully and look for patterns before starting another diagnostic.";
    }

    return "Your performance is holding steady. Use missed and flagged questions to decide what to review before your next diagnostic.";
  },

  openSavedAttemptReview(attemptId, filter = "all") {
    const memory = this.getResidentMemory();
    const record = (memory.attempts || []).find((attempt) => attempt.id === attemptId);

    if (!record) {
      alert("That saved attempt could not be found.");
      return;
    }

    window.latestScoredAttempt = record.scoredAttempt;
    window.latestFacultySummary = record.facultySummary;
    window.latestStudentFeedback = record.studentFeedback;

    this.updateReviewNavigationLabels(record);

    if (window.DiagnosticReviewUI) {
      window.DiagnosticReviewUI.render(filter);
      this.showView("diagnosticReviewView");
    }
  },

  updateReviewNavigationLabels(recordOrAttempt = window.latestScoredAttempt) {
    const attemptType =
      recordOrAttempt?.type ||
      recordOrAttempt?.scoredAttempt?.type ||
      "diagnostic";

    const backToResultsBtn = document.getElementById("backToResidentResultsFromReviewBtn");

    if (backToResultsBtn) {
      backToResultsBtn.textContent =
        attemptType === "practice" ? "Back to Practice Results" : "Back to Resident Results";
    }
  },

  formatSeconds(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours} hr ${String(minutes).padStart(2, "0")} min`;
    }

    if (minutes > 0) {
      return `${minutes} min ${String(seconds).padStart(2, "0")} sec`;
    }

    return `${seconds} sec`;
  },

  formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Saved attempt";
    }

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  },

init() {
  this.loadSavedResidentData();
  this.renderResidentHome();

  const startBtn = document.getElementById("startDiagnosticBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      window.ResidentTestUI.start();
    });
  }

  const setupResidentProfileBtn = document.getElementById("setupResidentProfileBtn");
  if (setupResidentProfileBtn) {
    setupResidentProfileBtn.addEventListener("click", () => {
      this.openResidentProfileForm();
    });
  }

  const editResidentProfileBtn = document.getElementById("editResidentProfileBtn");
  if (editResidentProfileBtn) {
    editResidentProfileBtn.addEventListener("click", () => {
      this.openResidentProfileForm();
    });
  }

  const saveResidentProfileBtn = document.getElementById("saveResidentProfileBtn");
  if (saveResidentProfileBtn) {
    saveResidentProfileBtn.addEventListener("click", () => {
      const profileData = this.collectResidentProfileFormData();
      this.saveResidentProfile(profileData);
    });
  }

  const cancelResidentProfileBtn = document.getElementById("cancelResidentProfileBtn");
  if (cancelResidentProfileBtn) {
    cancelResidentProfileBtn.addEventListener("click", () => {
      this.closeResidentProfileForm();
    });
  }

  const nextBtn = document.getElementById("nextQuestionBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      window.ResidentTestUI.next();
    });
  }

  const checkAnswerBtn = document.getElementById("checkAnswerBtn");
  if (checkAnswerBtn) {
    checkAnswerBtn.addEventListener("click", () => {
      window.ResidentTestUI.checkAnswer();
    });
  }

  const viewFacultyBtn = document.getElementById("viewFacultyDashboardBtn");
  if (viewFacultyBtn) {
    viewFacultyBtn.addEventListener("click", () => {
      window.FacultyDashboardUI.render();
      this.showView("facultyDashboardView");
    });
  }

  const viewFacultyFromResultsBtn = document.getElementById("viewFacultyDashboardFromResultsBtn");
  if (viewFacultyFromResultsBtn) {
    viewFacultyFromResultsBtn.addEventListener("click", () => {
      window.FacultyDashboardUI.render();
      this.showView("facultyDashboardView");
    });
  }

  const backToResidentResultsBtn = document.getElementById("backToResidentResultsBtn");
  if (backToResidentResultsBtn) {
    backToResidentResultsBtn.addEventListener("click", () => {
      this.showView("residentResultsView");
    });
  }

  const backToResidentDashboardBtn = document.getElementById("backToResidentDashboardBtn");
if (backToResidentDashboardBtn) {
  backToResidentDashboardBtn.addEventListener("click", () => {
    this.showView("launchView");
  });
}

  const reviewMissedFromDashboardBtn = document.getElementById("reviewMissedFromDashboardBtn");
  if (reviewMissedFromDashboardBtn) {
    reviewMissedFromDashboardBtn.addEventListener("click", () => {
      if (!window.latestScoredAttempt) {
        alert("Complete a diagnostic first before reviewing missed questions.");
        return;
      }

      this.updateReviewNavigationLabels(window.latestScoredAttempt);
      window.DiagnosticReviewUI.render("missed");
      this.showView("diagnosticReviewView");
    });
  }

  const reviewFlaggedFromDashboardBtn = document.getElementById("reviewFlaggedFromDashboardBtn");
  if (reviewFlaggedFromDashboardBtn) {
    reviewFlaggedFromDashboardBtn.addEventListener("click", () => {
      if (!window.latestScoredAttempt) {
        alert("Complete a diagnostic first before reviewing flagged questions.");
        return;
      }

      this.updateReviewNavigationLabels(window.latestScoredAttempt);
      window.DiagnosticReviewUI.render("flagged");
      this.showView("diagnosticReviewView");
    });
  }

  const reviewFullFromDashboardBtn = document.getElementById("reviewFullFromDashboardBtn");
  if (reviewFullFromDashboardBtn) {
    reviewFullFromDashboardBtn.addEventListener("click", () => {
      if (!window.latestScoredAttempt) {
        alert("Complete a diagnostic first before reviewing results.");
        return;
      }

      this.updateReviewNavigationLabels(window.latestScoredAttempt);
      window.DiagnosticReviewUI.render("all");
      this.showView("diagnosticReviewView");
    });
  }

  const attemptHistoryList = document.getElementById("residentAttemptHistoryList");
  if (attemptHistoryList) {
    attemptHistoryList.addEventListener("click", (event) => {
      const reviewBtn = event.target.closest(".attempt-review-btn");
      if (!reviewBtn) return;

      const attemptId = reviewBtn.dataset.attemptId;
      this.openSavedAttemptReview(attemptId, "all");
    });
  }

  const practiceHistoryList = document.getElementById("residentPracticeHistoryList");
  if (practiceHistoryList) {
    practiceHistoryList.addEventListener("click", (event) => {
      const reviewBtn = event.target.closest(".practice-review-btn");
      const practiceAgainBtn = event.target.closest(".practice-again-btn");

      if (reviewBtn) {
        const attemptId = reviewBtn.dataset.attemptId;
        this.openSavedAttemptReview(attemptId, "all");
        return;
      }

      if (practiceAgainBtn) {
        const tag = practiceAgainBtn.dataset.practiceTag;
        const label = practiceAgainBtn.dataset.practiceLabel;

        if (window.ResidentTestUI && typeof window.ResidentTestUI.startPracticeByTag === "function") {
          window.ResidentTestUI.startPracticeByTag(tag, label);
        }
      }
    });
  }

  const remediationList = document.getElementById("remediationList");
  if (remediationList) {
    remediationList.addEventListener("click", (event) => {
      const practiceBtn = event.target.closest(".start-practice-btn");
      if (!practiceBtn) return;

      const tag = practiceBtn.dataset.practiceTag;
      const label = practiceBtn.dataset.practiceLabel;

      if (window.ResidentTestUI && typeof window.ResidentTestUI.startPracticeByTag === "function") {
        window.ResidentTestUI.startPracticeByTag(tag, label);
      }
    });
  }


  const reviewFromResultsBtn = document.getElementById("reviewDiagnosticFromResultsBtn");
  if (reviewFromResultsBtn) {
    reviewFromResultsBtn.addEventListener("click", () => {
      this.updateReviewNavigationLabels(window.latestScoredAttempt);
      window.DiagnosticReviewUI.render("all");
      this.showView("diagnosticReviewView");
    });
  }

  const reviewMissedFromResultsBtn = document.getElementById("reviewMissedFromResultsBtn");
  if (reviewMissedFromResultsBtn) {
    reviewMissedFromResultsBtn.addEventListener("click", () => {
      this.updateReviewNavigationLabels(window.latestScoredAttempt);
      window.DiagnosticReviewUI.render("missed");
      this.showView("diagnosticReviewView");
    });
  }

  const reviewFlaggedFromResultsBtn = document.getElementById("reviewFlaggedFromResultsBtn");
  if (reviewFlaggedFromResultsBtn) {
    reviewFlaggedFromResultsBtn.addEventListener("click", () => {
      this.updateReviewNavigationLabels(window.latestScoredAttempt);
      window.DiagnosticReviewUI.render("flagged");
      this.showView("diagnosticReviewView");
    });
  }

  const viewDiagnosticDetailsBtn = document.getElementById("viewDiagnosticDetailsBtn");
  if (viewDiagnosticDetailsBtn) {
    viewDiagnosticDetailsBtn.addEventListener("click", () => {
      this.updateReviewNavigationLabels(window.latestScoredAttempt);
      window.DiagnosticReviewUI.render();
      this.showView("diagnosticReviewView");
    });
  }

  const backToFacultyDashboardBtn = document.getElementById("backToFacultyDashboardBtn");
  if (backToFacultyDashboardBtn) {
    backToFacultyDashboardBtn.addEventListener("click", () => {
      window.FacultyDashboardUI.render();
      this.showView("facultyDashboardView");
    });
  }

  const backToResidentDashboardFromReviewBtn = document.getElementById("backToResidentDashboardFromReviewBtn");
  if (backToResidentDashboardFromReviewBtn) {
    backToResidentDashboardFromReviewBtn.addEventListener("click", () => {
      this.showView("launchView");
    });
  }

  const backToResidentResultsFromReviewBtn = document.getElementById("backToResidentResultsFromReviewBtn");
  if (backToResidentResultsFromReviewBtn) {
    backToResidentResultsFromReviewBtn.addEventListener("click", () => {
      this.showView("residentResultsView");
    });
  }

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", (event) => {
      document.body.classList.toggle("dark-mode");

      const isActive = document.body.classList.contains("dark-mode");
      event.currentTarget.classList.toggle("active", isActive);
      event.currentTarget.setAttribute("aria-pressed", isActive);
    });
  }

  const fontToggleBtn = document.getElementById("fontToggleBtn");
  if (fontToggleBtn) {
    fontToggleBtn.addEventListener("click", (event) => {
      document.body.classList.toggle("dyslexia-font");

      const isActive = document.body.classList.contains("dyslexia-font");
      event.currentTarget.classList.toggle("active", isActive);
      event.currentTarget.setAttribute("aria-pressed", isActive);
    });
  }

    const homeLink = document.getElementById("doctorDashboardHomeLink");
  if (homeLink) {
    homeLink.addEventListener("click", () => {
      this.showView("launchView");
    });

    homeLink.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.showView("launchView");
      }
    });
  }
}
};

window.addEventListener("DOMContentLoaded", () => {
  window.App.init();
});