//app.js

window.App = {
  GOOGLE_CLIENT_ID: "333668105417-bljp17q4m7ur52pq3hmj1nr4f8r468rn.apps.googleusercontent.com",
  residentBackendSessionKey: "residentReadyBackendSession_v1",
  googleSignInInitialized: false,
  latestResidentOrganizationMemberships: [],
  latestResidentAssignments: [],
  activeAssignmentContext: null,
  showView(viewId) {
    document.querySelectorAll(".app-view").forEach((view) => {
      view.classList.remove("active-view");
    });

    document.getElementById(viewId).classList.add("active-view");

    if (viewId === "launchView") {
      this.loadSavedResidentData();
      this.renderResidentHome();
      this.renderCloudSaveState("Sign in with Google to save your profile and attempts across devices.");
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
    this.renderResidentInstitutionPanel();

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

      this.renderGrowthInsights();

      if (window.ResidentDashboardUI && typeof window.ResidentDashboardUI.clear === "function") {
        window.ResidentDashboardUI.clear();
      }

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

  clearResidentMemory() {
    try {
      localStorage.removeItem(this.getStorageKey());
    } catch (error) {
      console.warn("[Doctor Dashboard] Could not clear resident memory.", error);
    }
  },

  clearResidentRuntimeState() {
    window.latestScoredAttempt = null;
    window.latestFacultySummary = null;
    window.latestStudentFeedback = null;
    window.latestResidentReadySaveResponse = null;

    this.latestResidentOrganizationMemberships = [];
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

  saveResidentProfile(profileData, options = {}) {
    const shouldSyncToBackend = options.syncToBackend !== false;
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
      pictureUrl: existingProfile.pictureUrl || null,
      googleName: existingProfile.googleName || null,
      googleCredentialSavedAt: existingProfile.googleCredentialSavedAt || null,
      updatedAt: new Date().toISOString()
    };

    this.saveResidentMemory(memory);
    this.renderResidentHome();

    if (shouldSyncToBackend) {
      this.saveResidentProfileToBackend(memory.profile).catch((error) => {
        console.warn("[Resident Ready] Could not save resident profile to backend.", error);
      });
    }
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

      this.renderGoogleSignInState();
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

    this.renderGoogleSignInState();
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

    if (profile.authProvider === "google" && profile.email) {
      chips.push("Google connected");
    }

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


  isGoogleClientConfigured() {
    return !!(
      this.GOOGLE_CLIENT_ID &&
      this.GOOGLE_CLIENT_ID !== "PASTE_YOUR_GOOGLE_WEB_CLIENT_ID_HERE"
    );
  },

  initGoogleSignIn() {
    if (!this.isGoogleClientConfigured()) {
      this.renderGoogleSignInState();
      return;
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      setTimeout(() => this.initGoogleSignIn(), 300);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: this.GOOGLE_CLIENT_ID,
      callback: (response) => this.handleGoogleCredentialResponse(response)
    });

    this.googleSignInInitialized = true;
    this.renderGoogleSignInButton();
    this.renderGoogleSignInState();
  },

  renderGoogleSignInButton() {
    const buttonContainer = document.getElementById("googleSignInButton");
    if (!buttonContainer) return;

    buttonContainer.innerHTML = "";

    const profile = this.getResidentProfile();

    if (profile?.authProvider === "google" && profile?.email) {
      return;
    }

    if (!this.isGoogleClientConfigured()) {
      buttonContainer.innerHTML = `
        <p class="google-auth-placeholder">
          Add your Google Web Client ID in <code>app.js</code> to enable sign-in.
        </p>
      `;
      return;
    }

  if (
  !window.google ||
  !window.google.accounts ||
  !window.google.accounts.id ||
  !this.googleSignInInitialized
) {
  buttonContainer.innerHTML = `
    <p class="google-auth-placeholder">Loading Google sign-in...</p>
  `;
  return;
}

    window.google.accounts.id.renderButton(buttonContainer, {
      theme: "outline",
      size: "large",
      type: "standard",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left"
    });
  },

  async handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      alert("Google sign-in did not return a credential. Please try again.");
      return;
    }

    const googleProfile = this.decodeGoogleCredential(response.credential);

    if (!googleProfile || !googleProfile.sub) {
      alert("Resident Ready could not read your Google profile. Please try again.");
      return;
    }

    this.clearResidentMemory();
    this.clearResidentRuntimeState();
    this.saveGoogleIdentityToProfile(googleProfile);

    try {
      await this.connectResidentBackendSession(response.credential, googleProfile);
      await this.loadResidentProfileFromBackend();
      await this.loadResidentOrganizations();
      await this.loadResidentAttemptsFromBackend();
    } catch (error) {
      console.warn("[Resident Ready] Backend resident session was not created.", error);
    }

    this.renderCloudSaveState("Cloud save connected. Profile and attempts are saving to Resident Ready.");
    console.log("[Resident Ready] Backend sign-in connected. Cloud save is active.");
  },

  decodeGoogleCredential(credential) {
    try {
      const payload = credential.split(".")[1];
      const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
      const decodedPayload = decodeURIComponent(
        atob(normalizedPayload)
          .split("")
          .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join("")
      );

      return JSON.parse(decodedPayload);
    } catch (error) {
      console.warn("[Resident Ready] Could not decode Google credential.", error);
      return null;
    }
  },

  getResidentBackendSession() {
    try {
      const raw = localStorage.getItem(this.residentBackendSessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("[Resident Ready] Could not read backend session.", error);
      return null;
    }
  },

  saveResidentBackendSession(sessionData) {
    try {
      localStorage.setItem(
        this.residentBackendSessionKey,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.warn("[Resident Ready] Could not save backend session.", error);
    }
  },

  clearResidentBackendSession() {
    try {
      localStorage.removeItem(this.residentBackendSessionKey);
    } catch (error) {
      console.warn("[Resident Ready] Could not clear backend session.", error);
    }
  },

  hasValidResidentBackendSession() {
    const session = this.getResidentBackendSession();

    return !!(
      session &&
      session.sessionToken &&
      session.expiresAt &&
      Number(session.expiresAt) * 1000 > Date.now() + 60000
    );
  },

  async residentApiFetch(functionName, options = {}) {
    const session = this.getResidentBackendSession();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (session?.sessionToken) {
      headers.Authorization = `Bearer ${session.sessionToken}`;
    }

    const response = await fetch(`/.netlify/functions/${functionName}`, {
      ...options,
      headers
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = { success: false, error: text || "Invalid JSON response." };
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || `Request failed: ${functionName}`);
    }

    return data;
  },

  async connectResidentBackendSession(idToken, googleProfile = {}) {
    const data = await this.residentApiFetch("resident-session", {
      method: "POST",
      body: JSON.stringify({
        idToken,
        profile: {
          displayName: googleProfile.name || "",
          email: googleProfile.email || "",
          pictureUrl: googleProfile.picture || ""
        }
      })
    });

    this.saveResidentBackendSession({
      sessionToken: data.sessionToken,
      expiresAt: data.expiresAt,
      resident: data.resident
    });

    console.log("[Resident Ready] Backend session connected.", data.resident?.email);

    return data;
  },

  async loadResidentProfileFromBackend() {
    if (!this.hasValidResidentBackendSession()) {
      return null;
    }

    const data = await this.residentApiFetch("getResidentProfile", {
      method: "GET"
    });

    if (!data.profile) {
      return null;
    }

    const memory = this.getResidentMemory();

    memory.profile = {
      ...data.profile,
      authProvider: data.profile.authProvider || "google",
      userId: data.profile.userId || null,
      email: data.profile.email || null,
      pictureUrl: data.profile.pictureUrl || null,
      googleName: data.profile.googleName || null,
      updatedAt: data.profile.updatedAt || new Date().toISOString()
    };

    this.saveResidentMemory(memory);
    this.renderResidentHome();

    console.log("[Resident Ready] Loaded resident profile from backend.", memory.profile.email);

    return memory.profile;
  },

  async saveResidentProfileToBackend(profile = this.getResidentProfile()) {
    if (!this.hasValidResidentBackendSession()) {
      return null;
    }

    const data = await this.residentApiFetch("saveResidentProfile", {
      method: "POST",
      body: JSON.stringify({
        profile
      })
    });

    console.log("[Resident Ready] Saved resident profile to backend.", data.profile?.email);

    return data.profile;
  },

    mergeAttemptRecords(localAttempts = [], backendAttempts = []) {
    const byId = new Map();

    [...localAttempts, ...backendAttempts].forEach((record) => {
      if (!record || !record.id) return;

      const existing = byId.get(record.id);

      if (!existing) {
        byId.set(record.id, record);
        return;
      }

      const existingTime = new Date(existing.savedAt || 0).getTime();
      const recordTime = new Date(record.savedAt || 0).getTime();

      byId.set(record.id, recordTime >= existingTime ? record : existing);
    });

    return Array.from(byId.values())
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
      .slice(0, 50);
  },

  async loadResidentAttemptsFromBackend() {
    if (!this.hasValidResidentBackendSession()) {
      return [];
    }

    const data = await this.residentApiFetch("getResidentAttempts", {
      method: "GET"
    });

    const backendAttempts = Array.isArray(data.attempts) ? data.attempts : [];

    if (!backendAttempts.length) {
      return [];
    }

    const memory = this.getResidentMemory();

    memory.attempts = backendAttempts;
    this.saveResidentMemory(memory);

    this.loadSavedResidentData();

    const activeView = document.querySelector(".app-view.active-view");

    if (!activeView || activeView.id === "launchView") {
      this.renderResidentHome();
    }

    this.renderCloudSaveState("Cloud save connected. Profile and attempts are saving to Resident Ready.");

    console.log("[Resident Ready] Loaded resident attempts from backend.", mergedAttempts.length);

    return mergedAttempts;
  },

  async saveResidentAttemptToBackend(record) {
    if (!this.hasValidResidentBackendSession()) {
      return null;
    }

    const data = await this.residentApiFetch("saveResidentAttempt", {
      method: "POST",
      body: JSON.stringify({
        record
      })
    });

    window.latestResidentReadySaveResponse = data;

    console.log("[Resident Ready] Saved resident attempt to backend.", data.record?.id);
    console.log("[Resident Ready] Full save response:", data);
    console.log("[Resident Ready] Faculty index save info:", data.facultyIndex);

    return data.record;
  },


  saveGoogleIdentityToProfile(googleProfile) {
    const memory = this.getResidentMemory();
    const existingProfile = memory.profile || {};

    memory.profile = {
      ...existingProfile,
      displayName: existingProfile.displayName || googleProfile.name || "",
      authProvider: "google",
      userId: googleProfile.sub || null,
      email: googleProfile.email || null,
      pictureUrl: googleProfile.picture || null,
      googleName: googleProfile.name || null,
      googleCredentialSavedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveResidentMemory(memory);
    this.renderResidentHome();
  },

  signOutGoogleIdentity() {
    this.clearResidentBackendSession();
    this.clearResidentMemory();
    this.clearResidentRuntimeState();

    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }

    this.renderResidentHome();

    this.renderGrowthInsights();

    if (window.ResidentDashboardUI && typeof window.ResidentDashboardUI.clear === "function") {
      window.ResidentDashboardUI.clear();
    }

    this.renderCloudSaveState("Signed out. Sign in with Google to load your Resident Ready data.");
  },

  async loadResidentOrganizations() {
    if (!this.hasValidResidentBackendSession()) {
      this.latestResidentOrganizationMemberships = [];
      this.renderResidentInstitutionPanel();
      return [];
    }

    const data = await this.residentApiFetch("getMyOrganizations", {
      method: "GET"
    });

    this.latestResidentOrganizationMemberships = Array.isArray(data.memberships)
      ? data.memberships
      : [];

    this.renderResidentInstitutionPanel();

    console.log(
      "[Resident Ready] Loaded resident organization memberships.",
      this.latestResidentOrganizationMemberships
    );

    return this.latestResidentOrganizationMemberships;
  },

  getActiveResidentMembership() {
    const memberships = Array.isArray(this.latestResidentOrganizationMemberships)
      ? this.latestResidentOrganizationMemberships
      : [];

    return (
      memberships.find((membership) =>
        membership &&
        membership.status === "active" &&
        membership.role === "resident" &&
        membership.organizationId
      ) ||
      memberships.find((membership) =>
        membership &&
        membership.status === "active" &&
        membership.organizationId
      ) ||
      null
    );
  },

  renderResidentInstitutionPanel() {
    const title = document.getElementById("residentInstitutionTitle");
    const description = document.getElementById("residentInstitutionDescription");
    const chips = document.getElementById("residentInstitutionChips");
    const form = document.getElementById("residentJoinInstitutionForm");
    const status = document.getElementById("residentJoinInstitutionStatus");

    if (!title || !description || !chips || !form || !status) return;

    if (!this.hasValidResidentBackendSession()) {
      title.textContent = "Join your institution";
      description.textContent =
        "Sign in with Google, then enter the access code your program or faculty member shared with you.";
      chips.innerHTML = `
        <span>Google sign-in required</span>
        <span>Resident access code</span>
      `;
      form.classList.add("hidden");
      status.textContent =
        "Sign in first to connect your Resident Ready account to an institution.";
      status.className = "resident-join-status";
      return;
    }

    const activeMembership = this.getActiveResidentMembership();

    if (activeMembership) {
      title.textContent = activeMembership.organizationName || "Institution connected";
      description.textContent =
        `You are connected as ${activeMembership.roleLabel || activeMembership.role || "Resident"}${activeMembership.activeCohortLabel ? ` in ${activeMembership.activeCohortLabel}` : ""}. New attempts will save to this organization for faculty-safe review.`;

      chips.innerHTML = `
        <span>${activeMembership.organizationName || "Institution connected"}</span>
        <span>${activeMembership.activeCohortLabel || activeMembership.activeCohortId || "Unassigned"}</span>
        <span>${activeMembership.roleLabel || activeMembership.role || "Resident"}</span>
      `;

      form.classList.add("hidden");
      status.textContent = "Institution connection active.";
      status.className = "resident-join-status success";
      return;
    }

    title.textContent = "Join your institution";
    description.textContent =
      "Enter the resident access code shared by your program, faculty member, or administrator.";
    chips.innerHTML = `
      <span>Signed in</span>
      <span>Ready for access code</span>
    `;
    form.classList.remove("hidden");
    status.textContent =
      "No institution connected yet. Enter your code to join your program cohort.";
    status.className = "resident-join-status";
  },

    async loadResidentAssignments() {
    if (!this.hasValidResidentBackendSession()) {
      this.latestResidentAssignments = [];
      this.renderResidentAssignedWork();
      return [];
    }

    const data = await this.residentApiFetch("getResidentAssignments", {
      method: "GET"
    });

    this.latestResidentAssignments = Array.isArray(data.assignments)
      ? data.assignments
      : [];

    this.renderResidentAssignedWork();

    console.log("[Resident Ready] Loaded assigned work.", this.latestResidentAssignments);

    return this.latestResidentAssignments;
  },

  formatAssignmentDueDate(value) {
    if (!value) return "No due date";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No due date";

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  },

  renderResidentAssignedWork() {
    const list = document.getElementById("residentAssignedWorkList");
    if (!list) return;

    if (!this.hasValidResidentBackendSession()) {
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Sign in to load assigned work.</strong>
          <p>Your assignments will appear after you connect your Resident Ready account.</p>
        </div>
      `;
      return;
    }

    const activeMembership = this.getActiveResidentMembership();

    if (!activeMembership) {
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No institution connected yet.</strong>
          <p>Join your institution with an access code to receive assigned work.</p>
        </div>
      `;
      return;
    }

    const assignments = Array.isArray(this.latestResidentAssignments)
      ? this.latestResidentAssignments
      : [];

    if (!assignments.length) {
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No assigned work yet.</strong>
          <p>Your faculty or program can assign diagnostics after you join a cohort.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = assignments
      .map((assignment) => `
        <div class="resident-assignment-card">
          <div>
            <strong>${assignment.title || "Assigned Diagnostic"}</strong>
            <span>${assignment.cohortLabel || assignment.cohortId || "Cohort"} · Due ${this.formatAssignmentDueDate(assignment.dueDate)}</span>
            ${
              assignment.instructions
                ? `<p>${assignment.instructions}</p>`
                : ""
            }
          </div>

          <button
            class="secondary start-assignment-btn"
            type="button"
            data-assignment-id="${assignment.assignmentId}"
          >
            Start Diagnostic
          </button>
        </div>
      `)
      .join("");
  },

  startAssignedDiagnostic(assignmentId = "") {
    const assignment = this.latestResidentAssignments.find(
      (item) => item.assignmentId === assignmentId
    );

    if (!assignment) {
      alert("This assignment could not be found. Refresh assigned work and try again.");
      return;
    }

    this.activeAssignmentContext = {
      assignmentId: assignment.assignmentId,
      assignmentTitle: assignment.title,
      activityType: assignment.activityType || "diagnostic",
      organizationId: assignment.organizationId,
      organizationName: assignment.organizationName,
      cohortId: assignment.cohortId,
      cohortLabel: assignment.cohortLabel,
      dueDate: assignment.dueDate || null
    };

    window.ResidentTestUI.start();
  },


  async joinOrganizationWithCode() {
    const input = document.getElementById("residentAccessCodeInput");
    const status = document.getElementById("residentJoinInstitutionStatus");

    if (!input || !status) return;

    const code = input.value.trim();

    if (!this.hasValidResidentBackendSession()) {
      status.textContent = "Please sign in with Google before entering an institution code.";
      status.className = "resident-join-status error";
      return;
    }

    if (!code) {
      status.textContent = "Enter the access code your program shared with you.";
      status.className = "resident-join-status error";
      input.focus();
      return;
    }

    status.textContent = "Checking access code...";
    status.className = "resident-join-status";

    try {
      const data = await this.residentApiFetch("joinOrganizationWithCode", {
        method: "POST",
        body: JSON.stringify({ code })
      });

      input.value = "";

      await this.loadResidentOrganizations();
      await this.loadResidentAssignments();

      status.textContent =
        `Connected to ${data.organization?.organizationName || "your institution"}${data.cohort?.label ? ` · ${data.cohort.label}` : ""}.`;
      status.className = "resident-join-status success";

      this.renderCloudSaveState("Institution connected. New attempts will save to your organization.");
      this.renderResidentHome();

      console.log("[Resident Ready] Resident joined organization.", data);
    } catch (error) {
      console.warn("[Resident Ready] Could not join organization.", error);
      status.textContent = error.message || "Could not join institution with that access code.";
      status.className = "resident-join-status error";
    }
  },


  renderCloudSaveState(customMessage = "") {
    const status = document.getElementById("cloudSaveStatus");
    if (!status) return;

    const profile = this.getResidentProfile();

    if (!profile?.authProvider || profile.authProvider !== "google" || !profile.email) {
      status.textContent = customMessage || "Sign in with Google to save your profile and attempts across devices.";
      return;
    }

    if (this.hasValidResidentBackendSession()) {
      status.textContent = customMessage || "Cloud save connected. Profile and attempts are saving to Resident Ready.";
      return;
    }

    status.textContent = customMessage || "Google connected. Cloud save will finish connecting after sign-in.";
  },

  renderGoogleSignInState() {
    const status = document.getElementById("googleSignInStatus");
    const signOutBtn = document.getElementById("googleSignOutBtn");
    const buttonContainer = document.getElementById("googleSignInButton");

    if (!status || !signOutBtn || !buttonContainer) return;

    const profile = this.getResidentProfile();

    if (profile?.authProvider === "google" && profile?.email) {
      status.textContent =
        `Signed in as ${profile.email}.`;

      signOutBtn.classList.remove("hidden");
      buttonContainer.innerHTML = "";
      this.renderCloudSaveState();
      return;
    }

    status.textContent = this.isGoogleClientConfigured()
      ? "Sign in with Google to connect this device."
      : "Add your Google Web Client ID in app.js to enable sign-in.";

    signOutBtn.classList.add("hidden");
    this.renderGoogleSignInButton();
    this.renderCloudSaveState();
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

    if (!latestRecord) {
      window.latestScoredAttempt = null;
      window.latestFacultySummary = null;
      window.latestStudentFeedback = null;
      return;
    }

    window.latestScoredAttempt = latestRecord.scoredAttempt;
    window.latestFacultySummary = latestRecord.facultySummary;
    window.latestStudentFeedback = latestRecord.studentFeedback;
  },

  getQuestionById(questionId) {
    const questions = window.MED_SAMPLE_QUESTIONS || [];
    return questions.find((question) => question.id === questionId) || null;
  },

  normalizeAnswerChoices(question = {}) {
    const rawChoices =
      question.answerChoices ||
      question.choices ||
      question.options ||
      [];

    if (!Array.isArray(rawChoices)) return [];

    return rawChoices.map((choice, index) => {
      if (typeof choice === "string") {
        return {
          id: String.fromCharCode(65 + index),
          label: String.fromCharCode(65 + index),
          text: choice
        };
      }

      return {
        id: choice.id || choice.value || choice.label || String.fromCharCode(65 + index),
        label: choice.label || choice.id || choice.value || String.fromCharCode(65 + index),
        text: choice.text || choice.answer || choice.content || ""
      };
    });
  },

  getQuestionCorrectAnswer(question = {}, result = {}) {
    return (
      result.correctAnswer ||
      result.correctChoice ||
      result.correctOption ||
      question.correctAnswer ||
      question.correctChoice ||
      question.correctOption ||
      question.answer ||
      null
    );
  },

  getQuestionRationale(question = {}, result = {}) {
    return (
      result.rationale ||
      result.explanation ||
      question.rationale ||
      question.explanation ||
      question.correctRationale ||
      ""
    );
  },

  buildFacultySafeReviewSnapshot(scoredAttempt = {}) {
    const results = Array.isArray(scoredAttempt.results) ? scoredAttempt.results : [];

    return {
      version: 1,
      createdAt: new Date().toISOString(),
      reviewItems: results.map((result, index) => {
        const question = this.getQuestionById(result.questionId);
        const answerChoices = this.normalizeAnswerChoices(question || {});
        const correctAnswer = this.getQuestionCorrectAnswer(question || {}, result);
        const selectedAnswer =
          result.selectedAnswer ||
          result.selectedChoice ||
          result.selectedOption ||
          result.answer ||
          null;

        return {
          questionNumber: index + 1,
          questionId: result.questionId || null,
          stem:
            question?.stem ||
            question?.questionStem ||
            question?.question ||
            result.stem ||
            "",
          answerChoices,
          selectedAnswer,
          correctAnswer,
          isCorrect: !!result.isCorrect,
          rationale: this.getQuestionRationale(question || {}, result),
          clinicalReasoningTakeaway:
            question?.clinicalReasoningTakeaway ||
            question?.takeaway ||
            result.clinicalReasoningTakeaway ||
            "",
          tags: question?.tags || result.tags || {},
          system:
            question?.system ||
            question?.tags?.system ||
            result.system ||
            null,
          clinicalTask:
            question?.clinicalTask ||
            question?.tags?.clinicalTask ||
            result.clinicalTask ||
            null,
          errorPattern:
            result.errorPattern ||
            result.errorTag ||
            null
        };
      })
    };
  },

  saveResidentAttempt(scoredAttempt, facultySummary, studentFeedback, metadata = {}) {
    const memory = this.getResidentMemory();
    const type = metadata.type || scoredAttempt?.type || "diagnostic";
    const focusTag = metadata.focusTag || scoredAttempt?.focusTag || null;
    const focusLabel = metadata.focusLabel || scoredAttempt?.focusLabel || null;

    const profile = this.getResidentProfile() || {};

    const attemptId = `attempt-${Date.now()}`;

      const record = {
        id: attemptId,
        savedAt: new Date().toISOString(),
        type,
        focusTag,
        focusLabel,
        assignmentContext: metadata.assignmentContext || this.activeAssignmentContext || null,
        facultyReviewSnapshot: this.buildFacultySafeReviewSnapshot(scoredAttempt),
        residentProfileSnapshot: {
        displayName: profile.displayName || "",
        specialtyTrack: profile.specialtyTrack || "",
        programYear: profile.programYear || "",
        boardGoal: profile.boardGoal || "",
        preferredStudyStyle: profile.preferredStudyStyle || "",
        email: profile.email || null,
        googleName: profile.googleName || null
      },
      scoredAttempt: {
        ...scoredAttempt,
        type,
        focusTag,
        focusLabel
      },
      facultySummary,
      studentFeedback
    };

    memory.attempts = [record, ...(memory.attempts || [])].slice(0, 50);

    this.saveResidentMemory(memory);

    this.activeAssignmentContext = null;

    if (this.hasValidResidentBackendSession()) {
      this.saveResidentAttemptToBackend(record).catch((error) => {
        console.warn("[Resident Ready] Could not save resident attempt to backend.", error);
      });
    }
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

    if (!window.latestScoredAttempt) {
      panel.innerHTML = `
        <div class="growth-empty-state">
          <strong>Growth insights unlock after 2 diagnostics.</strong>
          <p>Sign in and complete diagnostics to compare your score, strengths, and priority review areas over time.</p>
        </div>
      `;
      return;
    }

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
  if (this.hasValidResidentBackendSession()) {
    this.loadSavedResidentData();
  } else {
    this.clearResidentRuntimeState();
  }

  this.renderResidentHome();
  this.initGoogleSignIn();

  this.loadResidentProfileFromBackend()
    .then(() => this.loadResidentOrganizations())
    .then(() => this.loadResidentAssignments())
    .then(() => this.loadResidentAttemptsFromBackend())
    .catch((error) => {
      console.warn("[Resident Ready] Could not load backend resident data on startup.", error);
      this.renderResidentInstitutionPanel();
    });

  const startBtn = document.getElementById("startDiagnosticBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      this.activeAssignmentContext = null;
      window.ResidentTestUI.start();
    });
  }

  const residentAssignedWorkList = document.getElementById("residentAssignedWorkList");
  if (residentAssignedWorkList) {
    residentAssignedWorkList.addEventListener("click", (event) => {
      const startAssignmentBtn = event.target.closest(".start-assignment-btn");
      if (!startAssignmentBtn) return;

      this.startAssignedDiagnostic(startAssignmentBtn.dataset.assignmentId || "");
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

  const joinInstitutionBtn = document.getElementById("joinInstitutionBtn");
  if (joinInstitutionBtn) {
    joinInstitutionBtn.addEventListener("click", () => {
      this.joinOrganizationWithCode();
    });
  }

  const residentAccessCodeInput = document.getElementById("residentAccessCodeInput");
  if (residentAccessCodeInput) {
    residentAccessCodeInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.joinOrganizationWithCode();
    });
  }

  const googleSignOutBtn = document.getElementById("googleSignOutBtn");
  if (googleSignOutBtn) {
    googleSignOutBtn.addEventListener("click", () => {
      const shouldSignOut = window.confirm(
        "Sign out of Google on this device? This will clear resident data from this browser until someone signs in again."
      );

      if (!shouldSignOut) return;

      this.signOutGoogleIdentity();
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