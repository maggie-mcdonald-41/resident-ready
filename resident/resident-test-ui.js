window.ResidentTestUI = {
  currentQuestionIndex: 0,
  answers: {},
  checkedAnswers: {},
  firstCommittedAnswers: {},
  answerCommittedBy: {},
  crossedOutChoices: {},
  notes: {},
  flaggedQuestions: {},
  questionStemHighlights: {},
  questionTimeSpent: {},
  currentHighlightColor: "yellow",
  diagnosticStartedAt: null,
  diagnosticFinishedAt: null,
  questionStartedAt: null,
  timerInterval: null,
  isTimerVisible: true,
  sessionType: "diagnostic",
  activeQuestions: [],
  focusTag: null,
  focusLabel: null,

  getDefaultQuestionBank() {
    if (window.ResidentQuestionSource && typeof window.ResidentQuestionSource.getAllQuestions === "function") {
      return window.ResidentQuestionSource.getAllQuestions();
    }

    return window.MED_SAMPLE_QUESTIONS || [];
  },

  setActiveQuestions(questions) {
    this.activeQuestions = Array.isArray(questions) ? questions : [];
  },

  getActiveQuestions() {
    if (Array.isArray(this.activeQuestions) && this.activeQuestions.length) {
      return this.activeQuestions;
    }

    return this.getDefaultQuestionBank();
  },

  start(config = {}) {
    const questionBank = Array.isArray(config.questions) && config.questions.length
      ? config.questions
      : this.getDefaultQuestionBank();

    this.sessionType = config.sessionType || "diagnostic";
    this.focusTag = config.focusTag || null;
    this.focusLabel = config.focusLabel || null;
    this.setActiveQuestions(questionBank);
    this.currentQuestionIndex = 0;
    this.answers = {};
    this.checkedAnswers = {};
    this.firstCommittedAnswers = {};
    this.answerCommittedBy = {};
    this.crossedOutChoices = {};
    this.notes = {};
    this.flaggedQuestions = {};
    this.questionStemHighlights = {};
    this.questionTimeSpent = {};
    this.currentHighlightColor = "yellow";
    this.diagnosticStartedAt = Date.now();
    this.diagnosticFinishedAt = null;
    this.questionStartedAt = Date.now();
    this.isTimerVisible = true;

    window.App.showView("testView");

    this.initHighlightToolbar();
    this.initDiagnosticControls();
    this.renderQuestionJumpSelect();
    this.startTimer();
    this.renderQuestion();
  },

  getCurrentQuestion() {
    return this.getActiveQuestions()[this.currentQuestionIndex];
  },

  getSessionLabel() {
    return this.sessionType === "practice" ? "Practice" : "Diagnostic";
  },

  getSubmitButtonLabel() {
    return this.sessionType === "practice" ? "Submit Practice" : "Submit Diagnostic";
  },

  startPracticeByTag(tag, label) {
    const focusTag = tag;
    const focusLabel = label || this.formatTagForResident(tag);

    if (!focusTag) {
      alert("Choose a focus area before starting targeted practice.");
      return;
    }

    const practiceQuestions = this.buildPracticeQuestions(focusTag);

    if (!practiceQuestions.length) {
      alert(`No practice questions are available yet for ${focusLabel}. Try another focus area after more questions are added.`);
      return;
    }

    this.start({
      sessionType: "practice",
      focusTag,
      focusLabel,
      questions: practiceQuestions
    });
  },

  buildPracticeQuestions(focusTag, maxQuestions = 5) {
    const allQuestions = this.getDefaultQuestionBank();

    const exactMatches = allQuestions.filter((question) =>
      this.questionMatchesFocusTag(question, focusTag)
    );

    return exactMatches.slice(0, maxQuestions);
  },

  questionMatchesFocusTag(question, focusTag) {
    if (!question || !focusTag) return false;

    const tagValues = [];

    Object.values(question.tags || {}).forEach((value) => {
      if (Array.isArray(value)) {
        tagValues.push(...value);
      } else if (typeof value === "string") {
        tagValues.push(value);
      }
    });

    return tagValues.includes(focusTag);
  },

  getCurrentQuestionId() {
    return this.getCurrentQuestion()?.id;
  },

  initDiagnosticControls() {
    const jumpSelect = document.getElementById("questionJumpSelect");
    const flagBtn = document.getElementById("flagQuestionBtn");
    const toggleTimerBtn = document.getElementById("toggleTimerBtn");
    const backBtn = document.getElementById("backToMainDashboardFromTestBtn");

    if (jumpSelect && !jumpSelect.dataset.ready) {
      jumpSelect.dataset.ready = "true";

      jumpSelect.addEventListener("change", (event) => {
        const nextIndex = Number(event.target.value);

        if (!Number.isInteger(nextIndex)) return;
        if (nextIndex === this.currentQuestionIndex) return;

        this.saveCurrentQuestionState();
        this.currentQuestionIndex = nextIndex;
        this.questionStartedAt = Date.now();
        this.renderQuestion();
      });
    }

    if (flagBtn && !flagBtn.dataset.ready) {
      flagBtn.dataset.ready = "true";

      flagBtn.addEventListener("click", () => {
        this.toggleFlagForCurrentQuestion();
      });
    }

    if (toggleTimerBtn && !toggleTimerBtn.dataset.ready) {
      toggleTimerBtn.dataset.ready = "true";

      toggleTimerBtn.addEventListener("click", () => {
        this.isTimerVisible = !this.isTimerVisible;
        this.updateTimerDisplay();
      });
    }

    if (backBtn && !backBtn.dataset.ready) {
      backBtn.dataset.ready = "true";

      backBtn.addEventListener("click", () => {
        this.saveCurrentQuestionState();
        window.App.showView("launchView");
      });
    }
  },

  renderQuestionJumpSelect() {
    const jumpSelect = document.getElementById("questionJumpSelect");
    const questions = this.getActiveQuestions();

    if (!jumpSelect || !Array.isArray(questions)) return;

    jumpSelect.innerHTML = "";

    questions.forEach((question, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = this.getQuestionOptionLabel(question, index);
      jumpSelect.appendChild(option);
    });

    jumpSelect.value = String(this.currentQuestionIndex);
  },

  getQuestionOptionLabel(question, index) {
    const questionNumber = index + 1;
    const answeredLabel = this.answers[question.id] ? "Answered" : "Unanswered";
    const checkedLabel = this.firstCommittedAnswers[question.id] ? "Committed" : "Not committed";
    const flaggedLabel = this.flaggedQuestions[question.id] ? " ⚑" : "";

    return `Question ${questionNumber}${flaggedLabel} — ${answeredLabel}, ${checkedLabel}`;
  },

  updateQuestionJumpSelect() {
    const jumpSelect = document.getElementById("questionJumpSelect");
    const questions = this.getActiveQuestions();

    if (!jumpSelect || !Array.isArray(questions)) return;

    Array.from(jumpSelect.options).forEach((option, index) => {
      const question = questions[index];
      option.textContent = this.getQuestionOptionLabel(question, index);
    });

    jumpSelect.value = String(this.currentQuestionIndex);
  },

  toggleFlagForCurrentQuestion() {
    const questionId = this.getCurrentQuestionId();
    if (!questionId) return;

    this.flaggedQuestions[questionId] = !this.flaggedQuestions[questionId];

    this.renderFlagButton();
    this.updateQuestionJumpSelect();
  },

  renderFlagButton() {
    const flagBtn = document.getElementById("flagQuestionBtn");
    const questionId = this.getCurrentQuestionId();

    if (!flagBtn || !questionId) return;

    const isFlagged = !!this.flaggedQuestions[questionId];

    flagBtn.textContent = isFlagged ? "Flagged for Review ⚑" : "Flag for Review";
    flagBtn.classList.toggle("is-flagged", isFlagged);
    flagBtn.setAttribute("aria-pressed", isFlagged ? "true" : "false");
  },

  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  updateTimerDisplay() {
    const timerEl = document.getElementById("diagnosticTimer");
    const labelEl = document.getElementById("diagnosticTimerLabel");
    const toggleBtn = document.getElementById("toggleTimerBtn");

    if (!timerEl || !labelEl || !toggleBtn || !this.diagnosticStartedAt) return;

    const elapsedSeconds = Math.floor((Date.now() - this.diagnosticStartedAt) / 1000);
    const formattedTime = this.formatSeconds(elapsedSeconds);

    if (this.isTimerVisible) {
      labelEl.textContent = "Time:";
      timerEl.textContent = formattedTime;
      timerEl.classList.remove("timer-hidden");
      toggleBtn.textContent = "Hide Timer";
    } else {
      labelEl.textContent = "Timer:";
      timerEl.textContent = "Hidden";
      timerEl.classList.add("timer-hidden");
      toggleBtn.textContent = "Show Timer";
    }
  },

  formatSeconds(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  },

  saveCurrentQuestionState() {
    this.saveCurrentQuestionTime();
    this.saveCurrentQuestionHighlights();
  },

  saveCurrentQuestionTime() {
    const questionId = this.getCurrentQuestionId();

    if (!questionId || !this.questionStartedAt) return;

    const elapsedSeconds = Math.floor((Date.now() - this.questionStartedAt) / 1000);

    if (!this.questionTimeSpent[questionId]) {
      this.questionTimeSpent[questionId] = 0;
    }

    this.questionTimeSpent[questionId] += Math.max(0, elapsedSeconds);
    this.questionStartedAt = Date.now();
  },

  saveCurrentQuestionHighlights() {
    const questionId = this.getCurrentQuestionId();
    const stem = document.getElementById("questionStem");

    if (!questionId || !stem) return;

    this.questionStemHighlights[questionId] = stem.innerHTML;
  },

  initHighlightToolbar() {
    document.querySelectorAll(".hl-color-btn").forEach((btn) => {
      btn.onclick = () => {
        const color = btn.dataset.color;
        if (!color) return;

        this.currentHighlightColor = color;

        document.querySelectorAll(".hl-color-btn").forEach((colorBtn) => {
          colorBtn.classList.toggle("active", colorBtn.dataset.color === color);
        });
      };
    });

    const clearBtn = document.getElementById("clearQuestionHighlightsBtn");
    if (clearBtn) {
      clearBtn.onclick = () => {
        this.clearQuestionHighlights();
      };
    }

    const stem = document.getElementById("questionStem");
    if (stem && !stem.dataset.highlightReady) {
      stem.dataset.highlightReady = "true";

      stem.addEventListener("mouseup", () => {
        this.applySelectionHighlight(stem);
      });
    }
  },

  applySelectionHighlight(containerEl) {
    if (!this.currentHighlightColor || !containerEl) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (
      selection.isCollapsed ||
      !containerEl.contains(range.commonAncestorContainer) ||
      !range.toString().trim()
    ) {
      return;
    }

    const startNode =
      range.startContainer.nodeType === 3
        ? range.startContainer.parentElement
        : range.startContainer;

    const endNode =
      range.endContainer.nodeType === 3
        ? range.endContainer.parentElement
        : range.endContainer;

    const commonNode =
      range.commonAncestorContainer.nodeType === 3
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;

    if (
      startNode?.closest(".q-highlight") ||
      endNode?.closest(".q-highlight") ||
      commonNode?.closest(".q-highlight")
    ) {
      selection.removeAllRanges();
      return;
    }

    const wrapper = document.createElement("span");
    wrapper.classList.add("q-highlight", `q-hl-${this.currentHighlightColor}`);
    wrapper.dataset.highlightColor = this.currentHighlightColor;

    try {
      const contents = range.extractContents();
      wrapper.appendChild(contents);
      range.insertNode(wrapper);

      containerEl.normalize();
      selection.removeAllRanges();
      this.saveCurrentQuestionHighlights();
    } catch (err) {
      console.error("Highlight error:", err);
    }
  },

  unwrapHighlightSpan(span) {
    const parent = span.parentNode;
    if (!parent) return;

    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }

    parent.removeChild(span);
    parent.normalize();
  },

  clearQuestionHighlights() {
    const stem = document.getElementById("questionStem");
    if (!stem) return;

    stem.querySelectorAll(".q-highlight").forEach((span) => {
      this.unwrapHighlightSpan(span);
    });

    stem.normalize();
    this.saveCurrentQuestionHighlights();
  },

  renderQuestion() {
    const questions = this.getActiveQuestions();
    const question = this.getCurrentQuestion();

    if (!question) return;

    const progressText = this.sessionType === "practice" && this.focusLabel
      ? `Targeted Practice: ${this.focusLabel} · Question ${this.currentQuestionIndex + 1} of ${questions.length}`
      : `Question ${this.currentQuestionIndex + 1} of ${questions.length}`;

    document.getElementById("questionProgress").textContent = progressText;

    const questionStem = document.getElementById("questionStem");

    if (this.questionStemHighlights[question.id]) {
      questionStem.innerHTML = this.questionStemHighlights[question.id];
    } else {
      questionStem.textContent = question.questionStem;
      this.questionStemHighlights[question.id] = questionStem.innerHTML;
    }

    const feedbackPanel = document.getElementById("answerFeedbackPanel");
    if (feedbackPanel) {
      feedbackPanel.className = "answer-feedback-panel hidden";
      feedbackPanel.innerHTML = "";
    }

    this.renderChoices(question);
    this.renderNotes(question);
    this.renderFlagButton();
    this.updateQuestionJumpSelect();

    document.getElementById("nextQuestionBtn").textContent =
      this.currentQuestionIndex === questions.length - 1
        ? this.getSubmitButtonLabel()
        : "Next Question";
  },

  renderChoices(question) {
    const choicesContainer = document.getElementById("answerChoices");
    choicesContainer.innerHTML = "";

    const checked = !!this.firstCommittedAnswers[question.id];
    const displayAnswer = this.firstCommittedAnswers[question.id] || this.answers[question.id];

    question.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.className = "answer-choice";
      button.type = "button";
      button.textContent = `${choice.id}. ${choice.text}`;
      button.dataset.choiceId = choice.id;

      if (displayAnswer === choice.id) {
        button.classList.add("selected");
      }

      if (this.crossedOutChoices[question.id]?.has(choice.id)) {
        button.classList.add("crossed-out");
      }

      if (checked && choice.id === question.correctAnswer) {
        button.classList.add("correct-answer-choice");
      }

      if (
        checked &&
        choice.id === displayAnswer &&
        choice.id !== question.correctAnswer
      ) {
        button.classList.add("incorrect-answer-choice");
      }

      button.addEventListener("click", (event) => {
        if (checked) return;

        if (event.shiftKey) {
          event.preventDefault();
          this.toggleCrossOut(question.id, choice.id);
          this.renderChoices(question);
          this.updateQuestionJumpSelect();
          return;
        }

        this.answers[question.id] = choice.id;
        this.renderChoices(question);
        this.updateQuestionJumpSelect();
      });

      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (checked) return;

        this.toggleCrossOut(question.id, choice.id);
        this.renderChoices(question);
      });

      choicesContainer.appendChild(button);
    });
  },

  toggleCrossOut(questionId, choiceId) {
    if (!this.crossedOutChoices[questionId]) {
      this.crossedOutChoices[questionId] = new Set();
    }

    if (this.crossedOutChoices[questionId].has(choiceId)) {
      this.crossedOutChoices[questionId].delete(choiceId);
    } else {
      this.crossedOutChoices[questionId].add(choiceId);
    }
  },

  renderNotes(question) {
    const existingNotes = document.getElementById("questionNotes");
    if (!existingNotes) return;

    existingNotes.value = this.notes[question.id] || "";

    existingNotes.oninput = (event) => {
      this.notes[question.id] = event.target.value;
    };
  },

  commitAnswer(questionId, method = "check") {
    if (!questionId || this.firstCommittedAnswers[questionId]) {
      return;
    }

    const selectedAnswer = this.answers[questionId];

    if (!selectedAnswer) {
      return;
    }

    this.firstCommittedAnswers[questionId] = selectedAnswer;
    this.answerCommittedBy[questionId] = method;
    this.checkedAnswers[questionId] = true;
  },


  checkAnswer() {
    const question = this.getCurrentQuestion();
    const selectedAnswer =
      this.firstCommittedAnswers[question.id] || this.answers[question.id];

    if (!selectedAnswer) {
      alert("Please select an answer before checking.");
      return;
    }

    this.commitAnswer(question.id, "check");

    const committedAnswer = this.firstCommittedAnswers[question.id];
    const isCorrect = committedAnswer === question.correctAnswer;

    const selectedRationale =
      question.choiceRationales?.[committedAnswer] ||
      "Review the explanation below to compare your reasoning with the correct answer.";

    const correctRationale =
      question.choiceRationales?.[question.correctAnswer] ||
      question.rationale ||
      "Review the correct answer and explanation.";

    const feedbackPanel = document.getElementById("answerFeedbackPanel");
    feedbackPanel.className = `answer-feedback-panel ${isCorrect ? "correct-feedback" : "incorrect-feedback"}`;

    feedbackPanel.innerHTML = `
      <h3>${isCorrect ? "Correct!" : "Not quite yet"}</h3>
      <p><strong>Your answer:</strong> ${committedAnswer}</p>
      <p><strong>Correct answer:</strong> ${question.correctAnswer}</p>
      <p><strong>Why:</strong> ${isCorrect ? correctRationale : selectedRationale}</p>
      ${
        isCorrect
          ? ""
          : `<p><strong>Clinical reasoning takeaway:</strong> ${question.rationale}</p>`
      }
      ${
        question.learningObjective
          ? `<p><strong>Learning objective:</strong> ${question.learningObjective}</p>`
          : ""
      }
    `;

    this.renderChoices(question);
    this.updateQuestionJumpSelect();

    if (isCorrect) {
      this.launchConfetti();
    }
  },

  launchConfetti() {
    const confettiCount = 40;

    for (let i = 0; i < confettiCount; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;

      document.body.appendChild(piece);

      setTimeout(() => {
        piece.remove();
      }, 1200);
    }
  },

  next() {
    const questions = this.getActiveQuestions();

    this.saveCurrentQuestionState();

    if (this.currentQuestionIndex < questions.length - 1) {
      this.currentQuestionIndex += 1;
      this.questionStartedAt = Date.now();
      this.renderQuestion();
      return;
    }

    this.submit();
  },

  getUnansweredQuestions() {
    const questions = this.getActiveQuestions() || [];

  return questions.filter(
    (question) => !this.answers[question.id] && !this.firstCommittedAnswers[question.id]
  );
  },

  commitSelectedAnswersOnSubmit() {
    const questions = this.getActiveQuestions() || [];

    questions.forEach((question) => {
      if (this.answers[question.id] && !this.firstCommittedAnswers[question.id]) {
        this.commitAnswer(question.id, "submit");
      }
    });
  },


  serializeCrossedOutChoices() {
    const serialized = {};

    Object.entries(this.crossedOutChoices).forEach(([questionId, choiceSet]) => {
      serialized[questionId] = Array.from(choiceSet);
    });

    return serialized;
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

  cleanResidentFeedbackLine(line) {
    if (!line) return "";

    return String(line)
      .split(/(Your strongest areas were:|Your best areas to review next are:)/)
      .map((part) => {
        if (
          part === "Your strongest areas were:" ||
          part === "Your best areas to review next are:"
        ) {
          return part;
        }

        return part
          .split(",")
          .map((piece) => {
            const trimmed = piece.trim();

            if (!trimmed) return "";

            const endingPunctuation = trimmed.match(/[.!?]$/)?.[0] || "";
            const cleanValue = endingPunctuation
              ? trimmed.slice(0, -1)
              : trimmed;

            return `${this.formatTagForResident(cleanValue)}${endingPunctuation}`;
          })
          .join(", ");
      })
      .join("");
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

  renderResidentResults(scoredAttempt, studentFeedback) {
    const results = scoredAttempt.results || [];
    const totalQuestions = results.length || scoredAttempt.totalQuestions || 0;
    const correctCount = results.filter((result) => result.isCorrect).length;
    const missedCount = Math.max(0, totalQuestions - correctCount);
    const flaggedCount = Object.values(scoredAttempt.flaggedQuestions || {}).filter(Boolean).length;
    const percentCorrect =
      typeof scoredAttempt.percentCorrect === "number"
        ? scoredAttempt.percentCorrect
        : totalQuestions
          ? Math.round((correctCount / totalQuestions) * 100)
          : 0;

    const totalTimeText = this.formatSeconds(scoredAttempt.totalTimeSeconds || 0);

    const resultEyebrow = document.getElementById("residentResultsEyebrow");
    const resultTitle = document.getElementById("residentResultsTitle");

    if (resultEyebrow) {
      resultEyebrow.textContent = scoredAttempt.type === "practice"
        ? "Targeted Practice Complete"
        : "Diagnostic Complete";
    }

    if (resultTitle) {
      resultTitle.textContent = scoredAttempt.type === "practice" && scoredAttempt.focusLabel
        ? `${scoredAttempt.focusLabel} Practice Results`
        : "Resident Results";
    }

    document.getElementById("residentScoreLine").textContent =
      studentFeedback.scoreLine;

    const isPractice = scoredAttempt.type === "practice";

    const reviewMissedBtn = document.getElementById("reviewMissedFromResultsBtn");
    const reviewFlaggedBtn = document.getElementById("reviewFlaggedFromResultsBtn");
    const reviewFullBtn = document.getElementById("reviewDiagnosticFromResultsBtn");

    if (reviewMissedBtn) {
      reviewMissedBtn.textContent = isPractice
        ? "Review Missed Practice Questions"
        : "Review Missed Questions";
    }

    if (reviewFlaggedBtn) {
      reviewFlaggedBtn.textContent = isPractice
        ? "Review Flagged Practice Questions"
        : "Review Flagged Questions";
    }

    if (reviewFullBtn) {
      reviewFullBtn.textContent = isPractice
        ? "Review Full Practice"
        : "Review Full Diagnostic";
    }

    this.renderPracticeAgainButton(scoredAttempt);

    document.getElementById("residentResultsScoreBadge").textContent =
      `${percentCorrect}%`;

    document.getElementById("residentResultsCorrectCount").textContent =
      `${correctCount}/${totalQuestions}`;

    document.getElementById("residentResultsTotalTime").textContent =
      totalTimeText;

    document.getElementById("residentResultsFlaggedCount").textContent =
      flaggedCount;

    document.getElementById("residentResultsMissedCount").textContent =
      missedCount;

    document.getElementById("residentStrengthsLine").textContent =
      typeof this.cleanResidentFeedbackLine === "function"
        ? this.cleanResidentFeedbackLine(studentFeedback.strengthsLine)
        : studentFeedback.strengthsLine;

    document.getElementById("residentWeaknessesLine").textContent =
      typeof this.cleanResidentFeedbackLine === "function"
        ? this.cleanResidentFeedbackLine(studentFeedback.weaknessesLine)
        : studentFeedback.weaknessesLine;

    document.getElementById("residentErrorLine").textContent =
      studentFeedback.errorPatternLine;
  },

  submit() {
    const unansweredQuestions = this.getUnansweredQuestions();

    if (unansweredQuestions.length > 0) {
      const shouldSubmit = window.confirm(
        `You have ${unansweredQuestions.length} unanswered question${unansweredQuestions.length === 1 ? "" : "s"}. Submit anyway?`
      );

      if (!shouldSubmit) return;
    }

    this.commitSelectedAnswersOnSubmit();
    this.saveCurrentQuestionState();
    this.stopTimer();
    this.diagnosticFinishedAt = Date.now();

    const questions = this.getActiveQuestions();
    const scoredAttempt = window.MED_RESULTS_ENGINE.scoreAttempt(
      questions,
      this.firstCommittedAnswers
    );
    const facultySummary = window.MED_RESULTS_ENGINE.generateFacultySummary(scoredAttempt);
    const studentFeedback = window.MED_RESULTS_ENGINE.generateStudentFeedback(scoredAttempt);

    scoredAttempt.type = this.sessionType;
    scoredAttempt.focusTag = this.focusTag;
    scoredAttempt.focusLabel = this.focusLabel;
    scoredAttempt.notes = this.notes;
    scoredAttempt.firstCommittedAnswers = this.firstCommittedAnswers;
    scoredAttempt.answerCommittedBy = this.answerCommittedBy;
    scoredAttempt.flaggedQuestions = this.flaggedQuestions;
    scoredAttempt.questionStemHighlights = this.questionStemHighlights;
    scoredAttempt.crossedOutChoices = this.serializeCrossedOutChoices();
    scoredAttempt.questionTimeSpent = this.questionTimeSpent;
    scoredAttempt.diagnosticStartedAt = this.diagnosticStartedAt;
    scoredAttempt.diagnosticFinishedAt = this.diagnosticFinishedAt;
    scoredAttempt.totalTimeSeconds = Math.floor(
      (this.diagnosticFinishedAt - this.diagnosticStartedAt) / 1000
    );

    window.latestScoredAttempt = scoredAttempt;
    window.latestFacultySummary = facultySummary;
    window.latestStudentFeedback = studentFeedback;

    if (window.App && typeof window.App.saveResidentAttempt === "function") {
      window.App.saveResidentAttempt(scoredAttempt, facultySummary, studentFeedback, {
        type: this.sessionType,
        focusTag: this.focusTag,
        focusLabel: this.focusLabel
      });
    }

    this.renderResidentResults(scoredAttempt, studentFeedback);

    window.App.showView("residentResultsView");
  }
};