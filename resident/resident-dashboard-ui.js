window.ResidentDashboardUI = {
  clear() {
    const systemChart = document.getElementById("systemPerformanceChart");
    const clinicalChart = document.getElementById("clinicalReasoningChart");
    const errorChart = document.getElementById("errorPatternChart");
    const remediationList = document.getElementById("remediationList");

    if (systemChart) {
      systemChart.innerHTML = `<p class="empty-note">Complete a diagnostic to see performance by system.</p>`;
    }

    if (clinicalChart) {
      clinicalChart.innerHTML = `<p class="empty-note">Complete a diagnostic to see your clinical reasoning breakdown.</p>`;
    }

    if (errorChart) {
      errorChart.innerHTML = `<p class="empty-note">Complete a diagnostic to see top error patterns.</p>`;
    }

    if (remediationList) {
      remediationList.innerHTML = `<p class="empty-note">Complete a diagnostic to generate suggested review areas.</p>`;
    }
  },

  getResidentFriendlyLabel(tag) {
    if (!tag) return "";

    const engineLabel =
      window.MED_RESULTS_ENGINE &&
      typeof window.MED_RESULTS_ENGINE.getReadableTagLabel === "function"
        ? window.MED_RESULTS_ENGINE.getReadableTagLabel(tag)
        : tag;

    const rawLabel = engineLabel || tag;

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
      patientSafetyDecision: "Patient Safety Decision",
      genitourinary: "Genitourinary",
      respiratory: "Respiratory",
      musculoskeletal: "Musculoskeletal",
      cardiovascular: "Cardiovascular",
      endocrine: "Endocrine",
      gastrointestinal: "Gastrointestinal",
      infectiousDisease: "Infectious Disease",
      neurology: "Neurology",
      obstetrics: "Obstetrics",
      ent: "ENT",
      osteopathicPrinciples: "Osteopathic Principles",
      osteopathic: "Osteopathic Principles"
    };

    if (customLabels[tag]) {
      return customLabels[tag];
    }

    if (customLabels[rawLabel]) {
      return customLabels[rawLabel];
    }

    return String(rawLabel)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  },

  render(facultySummary, scoredAttempt) {
    if (!facultySummary || !scoredAttempt) return;

    this.renderBarList("systemPerformanceChart", facultySummary.bySystem || []);
    this.renderBarList("clinicalReasoningChart", facultySummary.byClinicalDecision || []);
    this.renderBarList("errorPatternChart", facultySummary.byErrorType || [], true);
    this.renderRemediation(facultySummary, scoredAttempt);
  },

  renderBarList(containerId, dataArray, countOnly = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (!dataArray.length) {
      container.innerHTML = `<p class="empty-note">No data yet.</p>`;
      return;
    }

    dataArray.forEach((item) => {
      const label = this.getResidentFriendlyLabel(item.tag);
      const percent = item.percentCorrect || 0;
      const count = item.total || item.count || 0;

      const row = document.createElement("div");
      row.className = "chart-row";

      row.innerHTML = `
        <div class="chart-row-header">
          <span>${label}</span>
          <strong>${countOnly ? `${count} flagged` : `${percent}%`}</strong>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: ${countOnly ? Math.min(count * 20, 100) : percent}%"></div>
        </div>
      `;

      container.appendChild(row);
    });
  },

  renderRemediation(facultySummary, scoredAttempt) {
    const container = document.getElementById("remediationList");
    if (!container) return;

    const recommendations = this.buildRemediationRecommendations(facultySummary, scoredAttempt);

    container.innerHTML = recommendations.length
      ? recommendations.map((item) => `
          <div class="remediation-item">
            <span>
              <strong>${item.reason}</strong>
              ${item.text}
            </span>
            <button
              class="secondary small-btn start-practice-btn"
              type="button"
              data-practice-tag="${this.escapeAttribute(item.tag)}"
              data-practice-label="${this.escapeAttribute(item.label)}"
            >
              Practice ${item.label}
            </button>
          </div>
        `).join("")
      : `<p class="empty-note">Complete a diagnostic to generate suggested review areas.</p>`;
  },

  buildRemediationRecommendations(facultySummary, scoredAttempt) {
    const recommendations = [];

    const missedFlaggedTags = this.getMissedFlaggedTagRecommendations(scoredAttempt);
    const weakestSystems = (facultySummary.bySystem || []).slice(0, 3);
    const weakestClinical = (facultySummary.byClinicalDecision || []).slice(0, 3);
    const topErrorPatterns = (facultySummary.byErrorType || []).slice(0, 2);

    missedFlaggedTags.forEach((item) => {
      const label = this.getResidentFriendlyLabel(item.tag);

      recommendations.push({
        tag: item.tag,
        label,
        priority: 1,
        reason: "Recommended from your missed or flagged questions.",
        text: ` Focus practice on ${label} to strengthen a pattern from your latest diagnostic.`
      });
    });

    weakestSystems.forEach((item) => {
      const label = this.getResidentFriendlyLabel(item.tag);

      recommendations.push({
        tag: item.tag,
        label,
        priority: 2,
        reason: "Recommended from your system performance.",
        text: ` Review ${label} cases and targeted board-style questions.`
      });
    });

    weakestClinical.forEach((item) => {
      const label = this.getResidentFriendlyLabel(item.tag);

      recommendations.push({
        tag: item.tag,
        label,
        priority: 3,
        reason: "Recommended from your clinical reasoning breakdown.",
        text: ` Practice questions focused on ${label}.`
      });
    });

    topErrorPatterns.forEach((item) => {
      const label = this.getResidentFriendlyLabel(item.tag);

      recommendations.push({
        tag: item.tag,
        label,
        priority: 4,
        reason: "Recommended from your error patterns.",
        text: ` Review explanations connected to ${label} so you can recognize this pattern sooner.`
      });
    });

    return this.dedupeRecommendations(recommendations)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4);
  },

  getMissedFlaggedTagRecommendations(scoredAttempt) {
    const tagCounts = {};
    const questionBank = this.getQuestionBank();
    const flaggedQuestions = scoredAttempt?.flaggedQuestions || {};

    (scoredAttempt?.results || []).forEach((result) => {
      const wasMissed = !result.isCorrect;
      const wasFlagged = !!flaggedQuestions[result.questionId];

      if (!wasMissed && !wasFlagged) return;

      const question = questionBank.find((item) => item.id === result.questionId);
      if (!question?.tags) return;

      const preferredTags = this.getPreferredPracticeTags(question.tags);

      preferredTags.forEach((tag) => {
        if (!tagCounts[tag]) {
          tagCounts[tag] = {
            tag,
            count: 0
          };
        }

        tagCounts[tag].count += wasMissed && wasFlagged ? 2 : 1;
      });
    });

    return Object.values(tagCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  },

  getPreferredPracticeTags(tags) {
    const preferredOrder = [
      "clinicalDecision",
      "clinicalTask",
      "system",
      "topic",
      "subtopic",
      "competency",
      "errorType"
    ];

    const selectedTags = [];

    preferredOrder.forEach((key) => {
      const value = tags[key];

      if (Array.isArray(value)) {
        selectedTags.push(...value);
      } else if (typeof value === "string") {
        selectedTags.push(value);
      }
    });

    return Array.from(new Set(selectedTags)).filter(Boolean).slice(0, 3);
  },

  dedupeRecommendations(recommendations) {
    const seenTags = new Set();

    return recommendations.filter((item) => {
      if (!item.tag || seenTags.has(item.tag)) {
        return false;
      }

      seenTags.add(item.tag);
      return true;
    });
  },

  getQuestionBank() {
    if (window.ResidentQuestionSource && typeof window.ResidentQuestionSource.getAllQuestions === "function") {
      return window.ResidentQuestionSource.getAllQuestions();
    }

    if (window.ResidentTestUI && typeof window.ResidentTestUI.getDefaultQuestionBank === "function") {
      return window.ResidentTestUI.getDefaultQuestionBank();
    }

    return window.MED_SAMPLE_QUESTIONS || [];
  },


  escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
};