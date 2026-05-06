window.FacultyDashboardUI = {
  getLabel(tag) {
    return window.MED_RESULTS_ENGINE.getReadableTagLabel(tag);
  },

  renderTags(containerId, items, className = "") {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if (!items || !items.length) {
      container.innerHTML = `<span class="tag">No clear pattern yet</span>`;
      return;
    }

    items.forEach((item) => {
      const pill = document.createElement("span");
      pill.className = `tag ${className}`;
      pill.textContent = `${this.getLabel(item.tag || item.errorType)} (${item.percentCorrect ?? item.count ?? 0}${item.percentCorrect !== undefined ? "%" : ""})`;
      container.appendChild(pill);
    });
  },

  renderClinicalDecisionTable(items) {
    const tbody = document.getElementById("clinicalDecisionTable");
    tbody.innerHTML = "";

    items.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${this.getLabel(item.tag)}</td>
        <td>${item.correct}</td>
        <td>${item.total}</td>
        <td>${item.percentCorrect}%</td>
      `;
      tbody.appendChild(row);
    });
  },

getRiskLevel(percentCorrect) {
  const score = Number(percentCorrect) || 0;

  if (score >= 80) return "Strong Readiness";
  if (score >= 65) return "Developing Readiness";
  return "Needs Support";
},

  renderRiskAlerts(scoredAttempt) {
    const box = document.getElementById("riskAlerts");
    const risk = this.getRiskLevel(scoredAttempt.percentCorrect);

    let message = "";

if (risk === "Needs Support") {
  message = "Targeted support recommended. This resident may need guided remediation before board-style progression.";
} else if (risk === "Developing Readiness") {
  message = "Moderate support recommended. Review weak clinical decision patterns and high-acuity misses.";
} else {
  message = "Currently showing a strong readiness signal on this short diagnostic.";
}

    box.innerHTML = `
      <div class="risk-box">
        <strong>${risk}</strong>
        <p>${message}</p>
      </div>
    `;
  },

  render() {
    const scoredAttempt = window.latestScoredAttempt;
    const facultySummary = window.latestFacultySummary;
    const studentFeedback = window.latestStudentFeedback;

    if (!scoredAttempt || !facultySummary || !studentFeedback) return;

    document.getElementById("scorePercent").textContent = `${scoredAttempt.percentCorrect}%`;
    document.getElementById("questionCount").textContent = scoredAttempt.totalQuestions;
    document.getElementById("riskLevel").textContent = this.getRiskLevel(scoredAttempt.percentCorrect);

    this.renderTags("strengthTags", studentFeedback.strengths, "strong");
    this.renderTags("weaknessTags", studentFeedback.weaknesses, "weak");
    this.renderTags("errorTags", facultySummary.errorPatterns, "weak");

    this.renderClinicalDecisionTable(facultySummary.byClinicalDecision);
    this.renderRiskAlerts(scoredAttempt);
  }
};