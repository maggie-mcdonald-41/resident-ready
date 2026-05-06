window.ResidentDashboardUI = {
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
    this.renderRemediation(facultySummary);
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

  renderRemediation(facultySummary) {
    const container = document.getElementById("remediationList");
    if (!container) return;

    const weakestSystems = (facultySummary.bySystem || []).slice(0, 2);
    const weakestClinical = (facultySummary.byClinicalDecision || []).slice(0, 2);

    const recommendations = [
      ...weakestSystems.map((item) => {
        const label = this.getResidentFriendlyLabel(item.tag);
        return {
          tag: item.tag,
          label,
          text: `Review ${label} cases and targeted board-style questions.`
        };
      }),
      ...weakestClinical.map((item) => {
        const label = this.getResidentFriendlyLabel(item.tag);
        return {
          tag: item.tag,
          label,
          text: `Practice clinical reasoning questions focused on ${label}.`
        };
      })
    ].slice(0, 4);

    container.innerHTML = recommendations.length
      ? recommendations.map((item) => `
          <div class="remediation-item">
            <span>${item.text}</span>
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

  escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
};