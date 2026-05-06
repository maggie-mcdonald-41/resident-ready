window.DiagnosticReviewUI = {
  activeFilter: "all",

  getAttemptType(attempt = window.latestScoredAttempt) {
    return attempt?.type || "diagnostic";
  },

  getAttemptLabel(attempt = window.latestScoredAttempt) {
    return this.getAttemptType(attempt) === "practice" ? "Practice" : "Diagnostic";
  },

  updateReviewHeader(attempt) {
    const title = document.getElementById("diagnosticReviewTitle");
    const description = document.getElementById("diagnosticReviewDescription");
    const label = this.getAttemptLabel(attempt);
    const focusLabel = attempt?.focusLabel ? `: ${attempt.focusLabel}` : "";

    if (title) {
      title.textContent = `${label} Review${focusLabel}`;
    }

    if (description) {
      description.textContent =
        label === "Practice"
          ? "Review each practice question, your committed answer, the correct answer, and the clinical reasoning takeaway."
          : "Review each diagnostic question, your committed answer, the correct answer, and clinical reasoning insights.";
    }
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

  getQuestionById(questionId) {
    return this.getQuestionBank().find((question) => question.id === questionId) || null;
  },

  render(filter = this.activeFilter || "all") {
    this.activeFilter = filter;

    const attempt = window.latestScoredAttempt;
    if (!attempt) return;

    const container = document.getElementById("diagnosticReviewList");
    if (!container) return;

    this.updateReviewHeader(attempt);

    container.innerHTML = "";

    const controls = this.renderFilterControls(attempt);
    container.appendChild(controls);

    const filteredResults = this.getFilteredResults(attempt, filter);

    if (!filteredResults.length) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "review-empty-message";
      emptyMessage.innerHTML = `
        <h3>No questions found for this review filter.</h3>
        <p>Try switching to Review All.</p>
      `;
      container.appendChild(emptyMessage);
      return;
    }

    filteredResults.forEach((result) => {
      const originalIndex = attempt.results.findIndex(
        (item) => item.questionId === result.questionId
      );

      const question = this.getQuestionById(result.questionId);

      if (!question) return;

      const card = this.renderReviewCard({
        attempt,
        result,
        question,
        questionNumber: originalIndex + 1
      });

      container.appendChild(card);
    });
  },

  renderFilterControls(attempt) {
    const wrapper = document.createElement("div");
    wrapper.className = "review-filter-bar";

    const missedCount = attempt.results.filter((result) => !result.isCorrect).length;
    const flaggedCount = Object.values(attempt.flaggedQuestions || {}).filter(Boolean).length;
    const label = this.getAttemptLabel(attempt);

    wrapper.innerHTML = `
      <button type="button" class="review-filter-btn ${this.activeFilter === "all" ? "active" : ""}" data-filter="all">
        Review All ${label} Questions (${attempt.results.length})
      </button>

      <button type="button" class="review-filter-btn ${this.activeFilter === "missed" ? "active" : ""}" data-filter="missed">
        Missed ${label} Questions (${missedCount})
      </button>

      <button type="button" class="review-filter-btn ${this.activeFilter === "flagged" ? "active" : ""}" data-filter="flagged">
        Flagged ${label} Questions (${flaggedCount})
      </button>
    `;

    wrapper.querySelectorAll(".review-filter-btn").forEach((button) => {
      button.addEventListener("click", () => {
        this.render(button.dataset.filter);
      });
    });

    return wrapper;
  },

  getFilteredResults(attempt, filter) {
    if (filter === "missed") {
      return attempt.results.filter((result) => !result.isCorrect);
    }

    if (filter === "flagged") {
      return attempt.results.filter(
        (result) => attempt.flaggedQuestions?.[result.questionId]
      );
    }

    return attempt.results;
  },

  renderReviewCard({ attempt, result, question, questionNumber }) {
    const isCorrect = result.isCorrect;
    const isFlagged = !!attempt.flaggedQuestions?.[question.id];

    const selectedChoice = this.getChoiceById(question, result.selectedAnswer);
    const correctChoice = this.getChoiceById(question, result.correctAnswer);

    const selectedRationale = result.selectedAnswer
      ? question.choiceRationales?.[result.selectedAnswer]
      : "";

    const correctRationale =
      question.choiceRationales?.[result.correctAnswer] ||
      question.rationale ||
      "Review the explanation for this clinical concept.";

    const timeSpent = this.formatTime(attempt.questionTimeSpent?.[question.id] || 0);
    const residentNotes = attempt.notes?.[question.id] || "";
    const highlightedStem =
      attempt.questionStemHighlights?.[question.id] || this.escapeHTML(question.questionStem);

    const card = document.createElement("div");
    card.className = `review-card ${isCorrect ? "review-correct" : "review-incorrect"}`;

    card.innerHTML = `
      <div class="review-card-header">
        <div>
          <h3>Question ${questionNumber}</h3>
          <p class="review-status ${isCorrect ? "correct" : "incorrect"}">
            ${isCorrect ? "Correct" : "Incorrect"} ${isFlagged ? " · Flagged for Review ⚑" : ""}
          </p>
        </div>

        <div class="review-time-box">
          <span>Time Spent</span>
          <strong>${timeSpent}</strong>
        </div>
      </div>

      <div class="review-stem">${highlightedStem}</div>

      <div class="review-answer-grid">
        <div class="review-answer-box ${isCorrect ? "answer-correct" : "answer-incorrect"}">
          <h4>Your Answer</h4>
          <p>${this.renderAnswerText(result.selectedAnswer, selectedChoice)}</p>
        </div>

        <div class="review-answer-box answer-correct">
          <h4>Correct Answer</h4>
          <p>${this.renderAnswerText(result.correctAnswer, correctChoice)}</p>
        </div>
      </div>

      <div class="review-rationale">
        <h4>Why the Correct Answer Works</h4>
        <p>${correctRationale}</p>
      </div>

      ${
        !isCorrect && selectedRationale
          ? `
            <div class="review-rationale review-selected-rationale">
              <h4>Why Your Answer Was Not the Best Choice</h4>
              <p>${selectedRationale}</p>
            </div>
          `
          : ""
      }

      ${
        question.learningObjective
          ? `
            <div class="review-learning-objective">
              <h4>Learning Objective</h4>
              <p>${question.learningObjective}</p>
            </div>
          `
          : ""
      }

      ${
        question.clinicalSkill
          ? `
            <div class="review-meta">
              <p><strong>Clinical Skill:</strong> ${this.formatTagForResident(question.clinicalSkill)}</p>
            </div>
          `
          : ""
      }

      <div class="review-notes-box">
        <h4>Your Notes</h4>
        ${
          residentNotes.trim()
            ? `<p>${this.escapeHTML(residentNotes)}</p>`
            : `<p class="muted-review-text">No notes saved for this question.</p>`
        }
      </div>

      <div class="review-tags">
        <strong>Clinical Data:</strong>
        <div class="tag-list">
          ${this.renderTagList(question.tags)}
        </div>
      </div>
    `;

    return card;
  },

  getChoiceById(question, choiceId) {
    if (!question || !Array.isArray(question.choices)) return null;

    return question.choices.find((choice) => choice.id === choiceId) || null;
  },

  renderAnswerText(answerId, choice) {
    if (!answerId) return "No answer selected";

    if (!choice) return this.escapeHTML(answerId);

    return `${this.escapeHTML(answerId)}. ${this.escapeHTML(choice.text)}`;
  },

    renderPracticeAgainButton(scoredAttempt) {
    const buttonRow = document.querySelector(".results-button-row");
    if (!buttonRow) return;

    const existingBtn = document.getElementById("practiceAgainFromResultsBtn");
    if (existingBtn) existingBtn.remove();

    if (scoredAttempt.type !== "practice" || !scoredAttempt.focusTag) return;

    const button = document.createElement("button");
    button.id = "practiceAgainFromResultsBtn";
    button.type = "button";
    button.className = "secondary";
    button.textContent = `Practice ${scoredAttempt.focusLabel || "This Focus Area"} Again`;

    button.addEventListener("click", () => {
      this.startPracticeByTag(scoredAttempt.focusTag, scoredAttempt.focusLabel);
    });

    const dashboardBtn = document.getElementById("backToResidentDashboardBtn");
    buttonRow.insertBefore(button, dashboardBtn || null);
  },

  renderTagList(tags) {
    if (!tags) return "";

    let allTags = [];

    Object.values(tags).forEach((value) => {
      if (Array.isArray(value)) {
        allTags.push(...value);
      } else if (typeof value === "string") {
        allTags.push(value);
      }
    });

    return allTags
      .slice(0, 10)
      .map((tag) => `<span class="tag">${this.formatTagForResident(tag)}</span>`)
      .join("");
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
      management: "Management",
      prevention: "Prevention",
      screening: "Screening",
      patientSafety: "Patient Safety",
      ethics: "Ethics",
      communication: "Communication",
      cardiology: "Cardiology",
      pulmonology: "Pulmonology",
      nephrology: "Nephrology",
      gastroenterology: "Gastroenterology",
      endocrinology: "Endocrinology",
      neurology: "Neurology",
      pediatrics: "Pediatrics",
      obstetrics: "Obstetrics",
      gynecology: "Gynecology",
      psychiatry: "Psychiatry",
      surgery: "Surgery"
    };

    if (customLabels[tag]) {
      return customLabels[tag];
    }

    return String(tag)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  },

  formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    if (minutes < 1) {
      return `${seconds} sec`;
    }

    return `${minutes} min ${String(seconds).padStart(2, "0")} sec`;
  },

  escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};