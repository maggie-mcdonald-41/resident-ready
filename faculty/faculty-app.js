window.FacultyApp = {
  GOOGLE_CLIENT_ID: "333668105417-bljp17q4m7ur52pq3hmj1nr4f8r468rn.apps.googleusercontent.com",
  facultyBackendSessionKey: "residentReadyBackendSession_v1",
  googleSignInInitialized: false,
  selectedOrganizationId: "",
  latestOrganizationMemberships: [],
  latestOrganizationCohorts: [],
  latestOrganizationAdultMembers: [],
  latestAllOrganizationCohorts: [],
  selectedCohortId: "all",
  latestFacultyIndexData: null,
  latestCreatedResidentAccessCode: null,

  isGoogleClientConfigured() {
    return !!(
      this.GOOGLE_CLIENT_ID &&
      this.GOOGLE_CLIENT_ID !== "PASTE_YOUR_GOOGLE_WEB_CLIENT_ID_HERE"
    );
  },

  getBackendSession() {
    try {
      const raw = localStorage.getItem(this.facultyBackendSessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not read backend session.", error);
      return null;
    }
  },

  saveBackendSession(sessionData) {
    try {
      localStorage.setItem(
        this.facultyBackendSessionKey,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not save backend session.", error);
    }
  },

  clearBackendSession() {
    try {
      localStorage.removeItem(this.facultyBackendSessionKey);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not clear backend session.", error);
    }
  },

  hasValidBackendSession() {
    const session = this.getBackendSession();

    return !!(
      session &&
      session.sessionToken &&
      session.expiresAt &&
      Number(session.expiresAt) * 1000 > Date.now() + 60000
    );
  },

  async apiFetch(functionName, options = {}) {
    const session = this.getBackendSession();

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

  initGoogleSignIn() {
    if (!this.isGoogleClientConfigured()) {
      this.renderAuthState();
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
    this.renderAuthState();
  },

  renderGoogleSignInButton() {
    const buttonContainer = document.getElementById("facultyGoogleSignInButton");
    if (!buttonContainer) return;

    buttonContainer.innerHTML = "";

    if (this.hasValidBackendSession()) {
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
      console.warn("[Resident Ready Faculty] Could not decode Google credential.", error);
      return null;
    }
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

    try {
      const data = await this.apiFetch("resident-session", {
        method: "POST",
        body: JSON.stringify({
          idToken: response.credential,
          profile: {
            displayName: googleProfile.name || "",
            email: googleProfile.email || "",
            pictureUrl: googleProfile.picture || ""
          }
        })
      });

      this.saveBackendSession({
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt,
        resident: data.resident
      });

      console.log("[Resident Ready Faculty] Backend preview session connected.", data.resident?.email);

      this.renderAuthState();
      await this.refreshOrganizationAccess();
      await this.renderFacultyPreview();
    } catch (error) {
      console.warn("[Resident Ready Faculty] Backend preview session was not created.", error);
      this.renderAccessStatus("Could not connect the faculty preview session. Check the console.");
    }
  },

  signOut() {
    this.clearBackendSession();

    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }

    this.renderAuthState();
    this.renderFacultyPreviewSignedOut();
  },

  renderAuthState() {
    const status = document.getElementById("facultySignInStatus");
    const signOutBtn = document.getElementById("facultySignOutBtn");
    const buttonContainer = document.getElementById("facultyGoogleSignInButton");

    if (!status || !signOutBtn || !buttonContainer) return;

    const session = this.getBackendSession();
    const email = session?.resident?.email;

    if (this.hasValidBackendSession()) {
      status.textContent = email
        ? `Signed in as ${email}.`
        : "Signed in.";

      signOutBtn.classList.remove("hidden");
      buttonContainer.innerHTML = "";
      this.renderAccessStatus("Signed in. Organization role checks are active for organization-scoped faculty data.");
    return;
    }

    status.textContent = this.isGoogleClientConfigured()
      ? "Sign in with Google to load the faculty preview."
      : "Add your Google Web Client ID to enable sign-in.";

    signOutBtn.classList.add("hidden");
    this.renderGoogleSignInButton();
    this.renderAccessStatus("Sign in to load your organization-scoped faculty dashboard.");
  },

  renderAccessStatus(message) {
    const status = document.getElementById("facultyAccessStatus");
    if (status) status.textContent = message;
  },

  async claimDemoOrganizationForTesting(organizationName, setupCode = "RR-DEMO-SETUP") {
    if (!this.hasValidBackendSession()) {
      console.warn("[Resident Ready Faculty] Sign in before claiming an organization.");
      return null;
    }

    const data = await this.apiFetch("claimOrganization", {
      method: "POST",
      body: JSON.stringify({
        organizationName,
        setupCode
      })
    });

    console.log("[Resident Ready Faculty] Claimed organization:", data);

    return data;
  },

  async loadMyOrganizationsForTesting() {
    if (!this.hasValidBackendSession()) {
      console.warn("[Resident Ready Faculty] Sign in before loading organizations.");
      return null;
    }

    const data = await this.apiFetch("getMyOrganizations", {
      method: "GET"
    });

    console.log("[Resident Ready Faculty] My organizations:", data);

    return data;
  },

  async createResidentAccessCodeForTesting(
    organizationId = this.selectedOrganizationId,
    targetCohortId = this.selectedCohortId === "all" ? "unassigned" : this.selectedCohortId
  ) {
    if (!this.hasValidBackendSession()) {
      console.warn("[Resident Ready Faculty] Sign in before creating a resident access code.");
      return null;
    }

    if (!organizationId) {
      console.warn("[Resident Ready Faculty] Select an organization first.");
      return null;
    }

    const data = await this.apiFetch("createResidentAccessCode", {
      method: "POST",
      body: JSON.stringify({
        organizationId,
        targetCohortId,
        label: "Resident Join Code"
      })
    });

    console.log("[Resident Ready Faculty] Resident access code created:", data);

    return data;
  },

  async joinOrganizationWithCodeForTesting(code) {
    if (!this.hasValidBackendSession()) {
      console.warn("[Resident Ready Faculty] Sign in before joining with a code.");
      return null;
    }

    const data = await this.apiFetch("joinOrganizationWithCode", {
      method: "POST",
      body: JSON.stringify({
        code
      })
    });

    console.log("[Resident Ready Faculty] Joined organization with code:", data);

    return data;
  },

  getSelectedCohortLabel() {
    if (this.selectedCohortId === "all") return "All Cohorts";

    const cohort = this.latestOrganizationCohorts.find(
      (item) => item.cohortId === this.selectedCohortId
    );

    return cohort?.label || this.getCohortLabel(this.selectedCohortId);
  },

  async createOrganizationCohortFromUI() {
    const input = document.getElementById("newCohortNameInput");
    const status = document.getElementById("createCohortStatus");
    const createBtn = document.getElementById("createCohortBtn");

    if (!input || !status || !createBtn) return;

    const label = input.value.trim();

    if (!this.hasValidBackendSession()) {
      status.textContent = "Sign in before creating a cohort.";
      status.className = "dashboard-card-note cohort-create-status error";
      return;
    }

    if (!this.isOrgAdmin()) {
      status.textContent = "Admin permission is required to create cohorts.";
      status.className = "dashboard-card-note cohort-create-status error";
      return;
    }

    if (!this.selectedOrganizationId) {
      status.textContent = "Select an organization before creating a cohort.";
      status.className = "dashboard-card-note cohort-create-status error";
      return;
    }

    if (!label) {
      status.textContent = "Enter a cohort name, such as PGY-1 2026.";
      status.className = "dashboard-card-note cohort-create-status error";
      input.focus();
      return;
    }

    status.textContent = "Creating cohort...";
    status.className = "dashboard-card-note cohort-create-status";
    createBtn.disabled = true;

    try {
      const data = await this.apiFetch("createOrganizationCohort", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          label
        })
      });

      input.value = "";
      this.selectedCohortId = data.cohort?.cohortId || "all";
      this.latestCreatedResidentAccessCode = null;
      this.renderCreatedResidentAccessCode(null);

      await this.renderFacultyPreview();

      status.textContent =
        `${data.cohort?.label || label} created. You can now create a resident access code for this cohort.`;
      status.className = "dashboard-card-note cohort-create-status success";

      console.log("[Resident Ready Faculty] Cohort created from UI.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not create cohort.", error);
      status.textContent = error.message || "Could not create cohort.";
      status.className = "dashboard-card-note cohort-create-status error";
    } finally {
      createBtn.disabled = false;
    }
  },


  async loadOrganizationCohorts(organizationId = this.selectedOrganizationId) {
    if (!this.hasValidBackendSession() || !organizationId) {
      return { cohorts: [] };
    }

    const query = new URLSearchParams({ organizationId });

    return this.apiFetch(`getOrganizationCohorts?${query.toString()}`, {
      method: "GET"
    });
  },

  async loadOrganizationCohortsForTesting(organizationId = this.selectedOrganizationId) {
    if (!this.hasValidBackendSession()) {
      console.warn("[Resident Ready Faculty] Sign in before loading organization cohorts.");
      return null;
    }

    if (!organizationId) {
      console.warn("[Resident Ready Faculty] Select an organization first.");
      return null;
    }

    const data = await this.loadOrganizationCohorts(organizationId);

    console.log("[Resident Ready Faculty] Organization cohorts:", data);

    return data;
  },

    getAccessCodeTargetCohortId() {
    const select = document.getElementById("residentAccessCodeCohortSelect");

    if (select?.value) {
      return select.value;
    }

    if (this.selectedCohortId && this.selectedCohortId !== "all") {
      return this.selectedCohortId;
    }

    return "unassigned";
  },

  getAccessCodeTargetCohortLabel(cohortId = "unassigned") {
    const cohort = this.latestOrganizationCohorts.find(
      (item) => item.cohortId === cohortId
    );

    return cohort?.label || this.getCohortLabel(cohortId);
  },

  getResidentCountForCohort(cohortId = "") {
    const rosterResidents = Array.isArray(this.latestFacultyIndexData?.roster?.residents)
      ? this.latestFacultyIndexData.roster.residents
      : [];

    const rosterCount = rosterResidents.filter((resident) =>
      this.getItemCohortId(resident) === cohortId
    ).length;

    if (rosterCount > 0) {
      return rosterCount;
    }

    const cohort = this.latestAllOrganizationCohorts.find(
      (item) => item.cohortId === cohortId
    );

    return Array.isArray(cohort?.residentIds) ? cohort.residentIds.length : 0;
  },


  renderManageCohortsPanel() {
    const panel = document.getElementById("manageCohortsPanel");
    const list = document.getElementById("manageCohortsList");

    if (!panel || !list) return;

    const allCohorts = Array.isArray(this.latestAllOrganizationCohorts)
      ? this.latestAllOrganizationCohorts
      : [];

    if (!allCohorts.length) {
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No cohorts found.</strong>
          <p>Create your first cohort, then it will appear here for management.</p>
        </div>
      `;
      return;
    }

    const activeCohorts = allCohorts.filter((cohort) => cohort.status !== "archived");
    const archivedCohorts = allCohorts.filter((cohort) => cohort.status === "archived");

    const renderRows = (cohorts = [], emptyMessage = "No cohorts in this group.") => {
      if (!cohorts.length) {
        return `
          <div class="diagnostic-history-empty-state">
            <strong>${emptyMessage}</strong>
          </div>
        `;
      }

      return cohorts
        .map((cohort) => {
          const isUnassigned = cohort.cohortId === "unassigned";
          const isArchived = cohort.status === "archived";
          const residentCount = this.getResidentCountForCohort(cohort.cohortId);

          return `
            <div class="manage-cohort-row ${isArchived ? "is-archived" : ""}">
              <div>
                <strong>${this.escapeHtml(cohort.label || this.getCohortLabel(cohort.cohortId))}</strong>
                <span>
                  ${this.escapeHtml(cohort.cohortId)}
                  · ${residentCount} resident${residentCount === 1 ? "" : "s"}
                  · ${isArchived ? "Archived" : "Active"}
                </span>
              </div>

              <label>
                Rename
                <input
                  class="manage-cohort-name-input"
                  data-cohort-id="${this.escapeAttribute(cohort.cohortId)}"
                  type="text"
                  value="${this.escapeAttribute(cohort.label || this.getCohortLabel(cohort.cohortId))}"
                />
              </label>

              <div class="manage-cohort-actions">
                <button
                  class="secondary rename-cohort-btn"
                  type="button"
                  data-cohort-id="${this.escapeAttribute(cohort.cohortId)}"
                >
                  Rename
                </button>

                ${
                  isArchived
                    ? `<button
                        class="secondary restore-cohort-btn"
                        type="button"
                        data-cohort-id="${this.escapeAttribute(cohort.cohortId)}"
                      >
                        Restore
                      </button>`
                    : `<button
                        class="secondary archive-cohort-btn"
                        type="button"
                        data-cohort-id="${this.escapeAttribute(cohort.cohortId)}"
                        ${isUnassigned ? "disabled" : ""}
                        title="${isUnassigned ? "The Unassigned cohort cannot be archived." : "Archive this cohort."}"
                      >
                        Archive
                      </button>`
                }
              </div>
            </div>
          `;
        })
        .join("");
    };

    list.innerHTML = `
      <div class="manage-cohort-group">
        <h4>Active Cohorts</h4>
        ${renderRows(activeCohorts, "No active cohorts yet.")}
      </div>

      <div class="manage-cohort-group">
        <h4>Archived Cohorts</h4>
        ${renderRows(archivedCohorts, "No archived cohorts yet.")}
      </div>
    `;
  },

  toggleManageCohortsPanel() {
    const panel = document.getElementById("manageCohortsPanel");
    if (!panel) return;

    panel.classList.toggle("hidden");
    this.renderManageCohortsPanel();
  },

  getManagedCohortLabelInput(cohortId = "") {
    return document.querySelector(
      `.manage-cohort-name-input[data-cohort-id="${CSS.escape(cohortId)}"]`
    );
  },

  async updateOrganizationCohortFromUI(cohortId = "", action = "rename") {
    const status = document.getElementById("manageCohortsStatus");
    const normalizedAction = String(action || "").trim().toLowerCase();

    if (!status) return;

    if (!this.hasValidBackendSession()) {
      status.textContent = "Sign in before managing cohorts.";
      status.className = "dashboard-card-note manage-cohorts-status error";
      return;
    }

    if (!this.isOrgAdmin()) {
      status.textContent = "Admin permission is required to manage cohorts.";
      status.className = "dashboard-card-note manage-cohorts-status error";
      return;
    }

    if (!this.selectedOrganizationId) {
      status.textContent = "Select an organization before managing cohorts.";
      status.className = "dashboard-card-note manage-cohorts-status error";
      return;
    }

    if (!cohortId) {
      status.textContent = "Could not identify the cohort.";
      status.className = "dashboard-card-note manage-cohorts-status error";
      return;
    }

    const currentCohort = this.latestAllOrganizationCohorts.find(
      (cohort) => cohort.cohortId === cohortId
    );

    if (!currentCohort) {
      status.textContent = "That cohort is not currently loaded.";
      status.className = "dashboard-card-note manage-cohorts-status error";
      return;
    }

    const input = this.getManagedCohortLabelInput(cohortId);
    const label = input?.value?.trim() || "";

    if (normalizedAction === "rename" && !label) {
      status.textContent = "Enter a cohort name before renaming.";
      status.className = "dashboard-card-note manage-cohorts-status error";
      input?.focus();
      return;
    }

    if (normalizedAction === "archive") {
      if (cohortId === "unassigned") {
        status.textContent = "The Unassigned cohort cannot be archived.";
        status.className = "dashboard-card-note manage-cohorts-status error";
        return;
      }

      const confirmed = window.confirm(
        `Archive ${currentCohort.label || this.getCohortLabel(cohortId)}? This will hide it from active cohort selectors but keep its resident history.`
      );

      if (!confirmed) return;
    }

    if (normalizedAction === "restore") {
      const confirmed = window.confirm(
        `Restore ${currentCohort.label || this.getCohortLabel(cohortId)} to active cohort selectors?`
      );

      if (!confirmed) return;
    }

    status.textContent =
      normalizedAction === "archive"
        ? "Archiving cohort..."
        : normalizedAction === "restore"
          ? "Restoring cohort..."
          : "Renaming cohort...";
    status.className = "dashboard-card-note manage-cohorts-status";

    try {
      const data = await this.apiFetch("updateOrganizationCohort", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          cohortId,
          action: normalizedAction,
          label
        })
      });

      if (normalizedAction === "archive" && this.selectedCohortId === cohortId) {
        this.selectedCohortId = "all";
      }

      if (normalizedAction === "restore") {
        this.selectedCohortId = data.cohort?.cohortId || cohortId;
      }

      this.latestCreatedResidentAccessCode = null;
      this.renderCreatedResidentAccessCode(null);

      await this.renderFacultyPreview();
      this.renderManageCohortsPanel();

      status.textContent =
        normalizedAction === "archive"
          ? `${data.cohort?.label || "Cohort"} archived.`
          : normalizedAction === "restore"
            ? `${data.cohort?.label || "Cohort"} restored.`
            : `${data.cohort?.label || label} renamed.`;
      status.className = "dashboard-card-note manage-cohorts-status success";

      console.log("[Resident Ready Faculty] Cohort updated.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not update cohort.", error);
      status.textContent = error.message || "Could not update cohort.";
      status.className = "dashboard-card-note manage-cohorts-status error";
    }
  },

  renderPromoteCohortOptions() {
    const sourceSelect = document.getElementById("promoteSourceCohortSelect");
    const targetSelect = document.getElementById("promoteTargetCohortSelect");

    if (!sourceSelect || !targetSelect) return;

    const cohorts = Array.isArray(this.latestOrganizationCohorts)
      ? this.latestOrganizationCohorts
      : [];

    const promotableCohorts = cohorts.filter((cohort) =>
      cohort.cohortId !== "unassigned"
    );

    if (!promotableCohorts.length) {
      sourceSelect.innerHTML = `<option value="">Create a cohort first</option>`;
      targetSelect.innerHTML = `<option value="">Create a cohort first</option>`;
      return;
    }

    const optionsHtml = promotableCohorts
      .map((cohort) => `
        <option value="${this.escapeAttribute(cohort.cohortId)}">
          ${this.escapeHtml(cohort.label)}
        </option>
      `)
      .join("");

    const previousSourceValue = sourceSelect.value;
    const previousTargetValue = targetSelect.value;

    sourceSelect.innerHTML = `
      <option value="">Select source cohort</option>
      ${optionsHtml}
    `;

    targetSelect.innerHTML = `
      <option value="">Select target cohort</option>
      ${optionsHtml}
    `;

    if (promotableCohorts.some((cohort) => cohort.cohortId === previousSourceValue)) {
      sourceSelect.value = previousSourceValue;
    }

    if (promotableCohorts.some((cohort) => cohort.cohortId === previousTargetValue)) {
      targetSelect.value = previousTargetValue;
    }
  },

  getPromoteCohortLabel(cohortId = "") {
    const cohort = this.latestOrganizationCohorts.find(
      (item) => item.cohortId === cohortId
    );

    return cohort?.label || this.getCohortLabel(cohortId);
  },

  getCurrentResidentCountForCohort(cohortId = "") {
    const rosterResidents = Array.isArray(this.latestFacultyIndexData?.roster?.residents)
      ? this.latestFacultyIndexData.roster.residents
      : [];

    const rosterCount = rosterResidents.filter((resident) =>
      this.getItemCohortId(resident) === cohortId
    ).length;

    if (rosterCount > 0) {
      return rosterCount;
    }

    const cohort = this.latestAllOrganizationCohorts.find(
      (item) => item.cohortId === cohortId
    );

    return Array.isArray(cohort?.residentIds) ? cohort.residentIds.length : 0;
  },

  async promoteCohortFromUI() {
    const sourceSelect = document.getElementById("promoteSourceCohortSelect");
    const targetSelect = document.getElementById("promoteTargetCohortSelect");
    const status = document.getElementById("promoteCohortStatus");
    const button = document.getElementById("promoteCohortBtn");

    if (!sourceSelect || !targetSelect || !status || !button) return;

    const sourceCohortId = sourceSelect.value;
    const targetCohortId = targetSelect.value;

    if (!this.hasValidBackendSession()) {
      status.textContent = "Sign in before promoting residents.";
      status.className = "dashboard-card-note promote-cohort-status error";
      return;
    }

    if (!this.isOrgAdmin()) {
      status.textContent = "Admin permission is required to promote residents.";
      status.className = "dashboard-card-note promote-cohort-status error";
      return;
    }

    if (!this.selectedOrganizationId) {
      status.textContent = "Select an organization before promoting residents.";
      status.className = "dashboard-card-note promote-cohort-status error";
      return;
    }

    if (!sourceCohortId) {
      status.textContent = "Select the cohort residents are moving from.";
      status.className = "dashboard-card-note promote-cohort-status error";
      sourceSelect.focus();
      return;
    }

    if (!targetCohortId) {
      status.textContent = "Select the cohort residents are moving to.";
      status.className = "dashboard-card-note promote-cohort-status error";
      targetSelect.focus();
      return;
    }

    if (sourceCohortId === targetCohortId) {
      status.textContent = "Choose two different cohorts.";
      status.className = "dashboard-card-note promote-cohort-status error";
      return;
    }

    const sourceLabel = this.getPromoteCohortLabel(sourceCohortId);
    const targetLabel = this.getPromoteCohortLabel(targetCohortId);
    const residentCount = this.getCurrentResidentCountForCohort(sourceCohortId);

    const confirmed = window.confirm(
      `Promote ${residentCount || "all"} resident${residentCount === 1 ? "" : "s"} from ${sourceLabel} to ${targetLabel}?`
    );

    if (!confirmed) return;

    status.textContent = `Promoting residents from ${sourceLabel} to ${targetLabel}...`;
    status.className = "dashboard-card-note promote-cohort-status";
    button.disabled = true;

    try {
      const data = await this.apiFetch("promoteCohort", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          sourceCohortId,
          targetCohortId,
          reason: "bulk_cohort_promotion_from_faculty_dashboard"
        })
      });

      this.selectedCohortId = data.targetCohort?.cohortId || targetCohortId;
      this.latestCreatedResidentAccessCode = null;
      this.renderCreatedResidentAccessCode(null);

      await this.renderFacultyPreview();

      status.textContent =
        `${data.movedCount || 0} resident${data.movedCount === 1 ? "" : "s"} promoted from ${data.sourceCohort?.label || sourceLabel} to ${data.targetCohort?.label || targetLabel}.`;
      status.className = "dashboard-card-note promote-cohort-status success";

      console.log("[Resident Ready Faculty] Cohort promoted.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not promote cohort.", error);
      status.textContent = error.message || "Could not promote cohort.";
      status.className = "dashboard-card-note promote-cohort-status error";
    } finally {
      button.disabled = false;
    }
  },


  renderResidentAccessCodeCohortOptions() {
    const select = document.getElementById("residentAccessCodeCohortSelect");
    if (!select) return;

    const cohorts = Array.isArray(this.latestOrganizationCohorts)
      ? this.latestOrganizationCohorts
      : [];

    if (!cohorts.length) {
      select.innerHTML = `<option value="unassigned">Unassigned</option>`;
      return;
    }

    select.innerHTML = cohorts
      .map((cohort) => `
        <option value="${this.escapeAttribute(cohort.cohortId)}">
          ${cohort.label}
        </option>
      `)
      .join("");

    if (this.selectedCohortId && this.selectedCohortId !== "all") {
      select.value = this.selectedCohortId;
    } else if (cohorts.some((cohort) => cohort.cohortId === "unassigned")) {
      select.value = "unassigned";
    }
  },

  renderCreatedResidentAccessCode(data = null) {
    const output = document.getElementById("residentAccessCodeOutput");
    const codeText = document.getElementById("residentAccessCodeText");
    const meta = document.getElementById("residentAccessCodeMeta");
    const copyBtn = document.getElementById("copyResidentAccessCodeBtn");

    if (!output || !codeText || !meta || !copyBtn) return;

    if (!data?.code) {
      output.classList.add("hidden");
      codeText.textContent = "";
      meta.textContent = "";
      copyBtn.disabled = true;
      return;
    }

    const accessCode = data.accessCode || {};
    const expiresAt = accessCode.expiresAt
      ? new Date(accessCode.expiresAt).toLocaleDateString()
      : "one year from creation";

    output.classList.remove("hidden");
    codeText.textContent = data.code;
    meta.textContent =
      `${accessCode.targetCohortLabel || this.getAccessCodeTargetCohortLabel(accessCode.targetCohortId)} · Expires ${expiresAt}`;
    copyBtn.disabled = false;
  },

  async createResidentAccessCodeFromUI() {
    const status = document.getElementById("residentAccessCodeStatus");
    const createBtn = document.getElementById("createResidentAccessCodeBtn");

    if (!status || !createBtn) return;

    if (!this.hasValidBackendSession()) {
      status.textContent = "Sign in before creating a resident access code.";
      status.className = "dashboard-card-note access-code-status error";
      return;
    }

    if (!this.selectedOrganizationId) {
      status.textContent = "Select an organization before creating a resident access code.";
      status.className = "dashboard-card-note access-code-status error";
      return;
    }

    const targetCohortId = this.getAccessCodeTargetCohortId();

    status.textContent = "Creating resident access code...";
    status.className = "dashboard-card-note access-code-status";
    createBtn.disabled = true;

    try {
      const data = await this.apiFetch("createResidentAccessCode", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          targetCohortId,
          label: "Resident Join Code"
        })
      });

      this.latestCreatedResidentAccessCode = data;
      this.renderCreatedResidentAccessCode(data);

      status.textContent =
        `Resident code created for ${data.accessCode?.targetCohortLabel || this.getAccessCodeTargetCohortLabel(targetCohortId)}. Share this code with residents so they can join the institution.`;
      status.className = "dashboard-card-note access-code-status success";

      console.log("[Resident Ready Faculty] Resident access code created from UI.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not create resident access code.", error);
      status.textContent = error.message || "Could not create resident access code.";
      status.className = "dashboard-card-note access-code-status error";
    } finally {
      createBtn.disabled = false;
    }
  },

  async copyLatestResidentAccessCode() {
    const status = document.getElementById("residentAccessCodeStatus");
    const code = this.latestCreatedResidentAccessCode?.code;

    if (!status || !code) return;

    try {
      await navigator.clipboard.writeText(code);
      status.textContent = "Resident access code copied.";
      status.className = "dashboard-card-note access-code-status success";
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not copy resident access code.", error);
      status.textContent = "Could not copy automatically. Highlight the code and copy it manually.";
      status.className = "dashboard-card-note access-code-status error";
    }
  },


  async loadFacultyIndex() {
    const query = new URLSearchParams();

    if (this.selectedOrganizationId) {
      query.set("organizationId", this.selectedOrganizationId);
    }

    if (this.selectedCohortId && this.selectedCohortId !== "all") {
      query.set("cohortId", this.selectedCohortId);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";

    return this.apiFetch(`getFacultyIndex${suffix}`, {
      method: "GET"
    });
  },

  async loadFacultyAttemptDetail(residentId, attemptId, facultyScope = "default") {
    const query = new URLSearchParams({
      residentId,
      attemptId
    });

    if (this.selectedOrganizationId) {
      query.set("organizationId", this.selectedOrganizationId);
    } else {
      query.set("facultyScope", facultyScope);
    }

    return this.apiFetch(`getFacultyAttemptDetail?${query.toString()}`, {
      method: "GET"
    });
  },

  formatDate(value) {
    if (!value) return "No date";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "No date";
    }

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  },

  escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  getScoreClass(percentCorrect) {
    const score = Number(percentCorrect || 0);

    if (score >= 75) return "growth-positive";
    if (score >= 60) return "growth-steady";
    return "growth-needs-attention";
  },

  getRolePriority(role = "") {
    const priorities = {
      primary_admin: 4,
      admin: 3,
      faculty: 2,
      resident: 1
    };

    return priorities[role] || 0;
  },

  getBestMembershipForOrganization(memberships = []) {
    return [...memberships].sort((a, b) =>
      this.getRolePriority(b.role) - this.getRolePriority(a.role)
    )[0] || null;
  },

  getPrimaryOrganizationMembership(memberships = []) {
    const groupedByOrganization = new Map();

    memberships.forEach((membership) => {
      if (!membership?.organizationId) return;

      const existing = groupedByOrganization.get(membership.organizationId);

      if (
        !existing ||
        this.getRolePriority(membership.role) > this.getRolePriority(existing.role)
      ) {
        groupedByOrganization.set(membership.organizationId, membership);
      }
    });

    const bestMemberships = Array.from(groupedByOrganization.values());

    return bestMemberships.find((membership) =>
      ["primary_admin", "admin", "faculty"].includes(membership.role)
    ) || bestMemberships[0] || null;
  },

  getSelectedOrganizationMembership() {
    const matches = this.latestOrganizationMemberships.filter(
      (membership) => membership.organizationId === this.selectedOrganizationId
    );

    return this.getBestMembershipForOrganization(matches);
  },

  async loadMyOrganizations() {
    if (!this.hasValidBackendSession()) {
      return {
        memberships: []
      };
    }

    return this.apiFetch("getMyOrganizations", {
      method: "GET"
    });
  },

  async refreshOrganizationAccess() {
    const select = document.getElementById("facultyOrganizationSelect");
    const status = document.getElementById("facultyPreviewStatus");

    if (!this.hasValidBackendSession()) {
      this.latestOrganizationMemberships = [];
      this.selectedOrganizationId = "";

      if (select) {
        select.innerHTML = `<option value="">Sign in to load organizations</option>`;
      }

      return [];
    }

    try {
      const data = await this.loadMyOrganizations();
      const memberships = Array.isArray(data.memberships)
        ? data.memberships.filter((membership) => membership.status === "active")
        : [];

      this.latestOrganizationMemberships = memberships;

      const hasCurrentOrganization = memberships.some(
        (membership) => membership.organizationId === this.selectedOrganizationId
      );

      if (!hasCurrentOrganization) {
        const primaryMembership = this.getPrimaryOrganizationMembership(memberships);
        this.selectedOrganizationId = primaryMembership?.organizationId || "";
      }

      this.renderOrganizationSelector(memberships);
      this.renderRoleBasedControls();

      if (status && memberships.length) {
        const selected = this.getSelectedOrganizationMembership();
        status.textContent =
          `Organization access loaded for ${selected?.organizationName || "your institution"}.`;
      }

      if (status && !memberships.length) {
        status.textContent =
          "No organization memberships found yet. Use setup/claim flow before loading the faculty dashboard.";
      }

      return memberships;
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not load organization access.", error);

      if (status) {
        status.textContent = "Could not load organization access. Check the console for details.";
      }

      return [];
    }
  },

  renderOrganizationSelector(memberships = []) {
    const select = document.getElementById("facultyOrganizationSelect");
    if (!select) return;

    if (!memberships.length) {
      select.innerHTML = `<option value="">No organizations found</option>`;
      return;
    }

    const groupedByOrganization = new Map();

    memberships.forEach((membership) => {
      if (!membership?.organizationId) return;

      const existing = groupedByOrganization.get(membership.organizationId);

      if (
        !existing ||
        this.getRolePriority(membership.role) > this.getRolePriority(existing.role)
      ) {
        groupedByOrganization.set(membership.organizationId, membership);
      }
    });

    const organizationOptions = Array.from(groupedByOrganization.values())
      .sort((a, b) =>
        String(a.organizationName || a.organizationId || "")
          .localeCompare(String(b.organizationName || b.organizationId || ""))
      );

    select.innerHTML = organizationOptions
      .map((membership) => `
        <option value="${this.escapeAttribute(membership.organizationId)}">
          ${membership.organizationName || membership.organizationId} · ${membership.roleLabel || membership.role}
        </option>
      `)
      .join("");

    const hasSelectedOrganization = organizationOptions.some(
      (membership) => membership.organizationId === this.selectedOrganizationId
    );

    select.value = hasSelectedOrganization
      ? this.selectedOrganizationId
      : organizationOptions[0].organizationId;

    if (!hasSelectedOrganization) {
      this.selectedOrganizationId = organizationOptions[0].organizationId;
    }
  },

  getSelectedOrganizationLabel() {
    const membership = this.getSelectedOrganizationMembership();
    return membership?.organizationName || "No organization selected";
  },

    getCurrentFacultyRole() {
    const membership = this.getSelectedOrganizationMembership();
    return membership?.role || "";
  },

  isPrimaryAdmin() {
    return this.getCurrentFacultyRole() === "primary_admin";
  },

  isOrgAdmin() {
    return ["primary_admin", "admin"].includes(this.getCurrentFacultyRole());
  },

  isFacultyOnly() {
    return this.getCurrentFacultyRole() === "faculty";
  },

  setElementVisibility(elementId, shouldShow) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.toggle("hidden", !shouldShow);
  },

  renderRoleBasedControls() {
    const isAdmin = this.isOrgAdmin();
    const isPrimaryAdmin = this.isPrimaryAdmin();

    this.setElementVisibility("facultyAddAdultPanel", isAdmin);
    this.setElementVisibility("facultyAdminMemberManagementBox", isAdmin);
    this.setElementVisibility("facultyCohortControlPanel", isAdmin);
    this.setElementVisibility("facultyPromoteCohortPanel", isAdmin);

    const addAdultStatus = document.getElementById("addAdultMemberStatus");
    if (addAdultStatus) {
      addAdultStatus.textContent = isPrimaryAdmin
        ? "Primary Admins can add Admins or Faculty."
        : isAdmin
          ? "Admins can add Faculty. Only the Primary Admin can add another Admin."
          : "Faculty can view resident progress and create resident access codes.";
      addAdultStatus.className = "dashboard-card-note add-adult-status";
    }

    const accessCodeStatus = document.getElementById("residentAccessCodeStatus");
    if (accessCodeStatus && this.isFacultyOnly()) {
      accessCodeStatus.textContent =
        "Faculty can create resident access codes for active cohorts.";
      accessCodeStatus.className = "dashboard-card-note access-code-status";
    }

    this.renderAdultMemberRoleOptions();
  },

  async loadFacultyAdminMembers() {
    if (!this.hasValidBackendSession() || !this.selectedOrganizationId || !this.isOrgAdmin()) {
      this.latestOrganizationAdultMembers = [];
      return [];
    }

    const query = new URLSearchParams({
      organizationId: this.selectedOrganizationId
    });

    const data = await this.apiFetch(`getOrganizationAdultMembers?${query.toString()}`, {
      method: "GET"
    });

    this.latestOrganizationAdultMembers = Array.isArray(data.members)
      ? data.members
      : [];

    return this.latestOrganizationAdultMembers;
  },

  getAssignableCohorts() {
    return Array.isArray(this.latestOrganizationCohorts)
      ? this.latestOrganizationCohorts.filter((cohort) =>
          cohort.status !== "archived"
        )
      : [];
  },

  renderFacultyCohortAssignmentControls(member = {}) {
    if (member.role !== "faculty") return "";

    const cohorts = this.getAssignableCohorts();
    const assignedCohortIds = Array.isArray(member.assignedCohortIds)
      ? member.assignedCohortIds
      : [];

    if (!cohorts.length) {
      return `
        <div class="faculty-cohort-assignment-box">
          <strong>Cohort Access</strong>
          <p>Create a cohort before assigning Faculty access.</p>
        </div>
      `;
    }

    return `
      <div class="faculty-cohort-assignment-box">
        <strong>Cohort Access</strong>
        <div class="faculty-cohort-assignment-options">
          ${cohorts.map((cohort) => `
            <label>
              <input
                type="checkbox"
                class="faculty-cohort-assignment-checkbox"
                data-member-email="${this.escapeAttribute(member.email)}"
                value="${this.escapeAttribute(cohort.cohortId)}"
                ${assignedCohortIds.includes(cohort.cohortId) ? "checked" : ""}
              />
              <span>${this.escapeHtml(cohort.label)}</span>
            </label>
          `).join("")}
        </div>

        <button
          class="secondary save-faculty-cohort-access-btn"
          type="button"
          data-member-email="${this.escapeAttribute(member.email)}"
        >
          Save Cohort Access
        </button>
      </div>
    `;
  },

  getSelectedFacultyCohortAssignments(email = "") {
    return Array.from(
      document.querySelectorAll(
        `.faculty-cohort-assignment-checkbox[data-member-email="${CSS.escape(email)}"]:checked`
      )
    ).map((checkbox) => checkbox.value);
  },

  async saveFacultyCohortAssignmentsFromUI(email = "") {
    const status = document.getElementById("addAdultMemberStatus");

    if (!status) return;

    if (!this.isOrgAdmin()) {
      status.textContent = "Admin permission is required to assign Faculty cohorts.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    if (!email) {
      status.textContent = "Could not identify the Faculty member.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    const assignedCohortIds = this.getSelectedFacultyCohortAssignments(email);

    status.textContent = "Saving Faculty cohort access...";
    status.className = "dashboard-card-note add-adult-status";

    try {
      const data = await this.apiFetch("assignFacultyCohorts", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          email,
          assignedCohortIds
        })
      });

      await this.refreshFacultyAdminMembersPanel();

      status.textContent = data.message || "Faculty cohort access saved.";
      status.className = "dashboard-card-note add-adult-status success";

      console.log("[Resident Ready Faculty] Faculty cohort access saved.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not save Faculty cohort access.", error);
      status.textContent = error.message || "Could not save Faculty cohort access.";
      status.className = "dashboard-card-note add-adult-status error";
    }
  },

  renderFacultyAdminMemberList() {
    const list = document.getElementById("facultyAdminMemberList");
    if (!list) return;

    const members = Array.isArray(this.latestOrganizationAdultMembers)
      ? this.latestOrganizationAdultMembers
      : [];

    if (!this.selectedOrganizationId) {
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No organization selected.</strong>
          <p>Select an organization to view Faculty/Admin members.</p>
        </div>
      `;
      return;
    }

    if (!this.isOrgAdmin()) {
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Admin access required.</strong>
          <p>Faculty can view resident progress, but Faculty/Admin member management is admin-only.</p>
        </div>
      `;
      return;
    }

    if (!members.length) {
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No added Faculty/Admin members yet.</strong>
          <p>Add a Faculty/Admin member above. They will appear here after being added.</p>
        </div>
      `;
      return;
    }

    const canUpdateRoles = this.isPrimaryAdmin();

    list.innerHTML = members
      .map((member) => {
        const role = member.role || "faculty";
        const roleLabel = role === "admin" ? "Admin" : "Faculty";
        const assignmentControlsHtml = this.renderFacultyCohortAssignmentControls(member);

        return `
          <div class="faculty-admin-member-row">
            <div>
              <strong>${this.escapeHtml(member.email || "No email")}</strong>
              <span>${roleLabel} · ${this.escapeHtml(member.status || "active")}</span>
            </div>

            <label>
              Role
              <select
                class="faculty-admin-member-role-select"
                data-member-email="${this.escapeAttribute(member.email)}"
                ${canUpdateRoles ? "" : "disabled"}
              >
                <option value="faculty" ${role === "faculty" ? "selected" : ""}>Faculty</option>
                <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
              </select>
            </label>

            <div class="faculty-admin-member-actions">
              <button
                class="secondary update-faculty-admin-member-role-btn"
                type="button"
                data-member-email="${this.escapeAttribute(member.email)}"
                ${canUpdateRoles ? "" : "disabled"}
              >
                Update Role
              </button>

              <button
                class="secondary remove-faculty-admin-member-btn danger-action"
                type="button"
                data-member-email="${this.escapeAttribute(member.email)}"
                ${canUpdateRoles ? "" : "disabled"}
              >
                Remove
              </button>
            </div>

            ${assignmentControlsHtml}
          </div>
        `;
      })
      .join("");
  },

  async refreshFacultyAdminMembersPanel() {
    const list = document.getElementById("facultyAdminMemberList");
    if (!list) return;

    if (!this.hasValidBackendSession() || !this.selectedOrganizationId || !this.isOrgAdmin()) {
      this.latestOrganizationAdultMembers = [];
      const box = document.getElementById("facultyAdminMemberManagementBox");
      if (box) box.classList.add("hidden");
      return;
    }

    try {
      const box = document.getElementById("facultyAdminMemberManagementBox");
      if (box) box.classList.remove("hidden");

      await this.loadFacultyAdminMembers();
      this.renderFacultyAdminMemberList();
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not load Faculty/Admin members.", error);
      list.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Could not load Faculty/Admin members.</strong>
          <p>${this.escapeHtml(error.message || "Check the console for details.")}</p>
        </div>
      `;
    }
  },

    async removeFacultyAdminMemberFromUI(email = "") {
    const status = document.getElementById("addAdultMemberStatus");

    if (!status) return;

    if (!this.isPrimaryAdmin()) {
      status.textContent = "Only the Primary Admin can remove Faculty/Admin members.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    if (!email) {
      status.textContent = "Could not identify the member to remove.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    const confirmed = window.confirm(
      `Remove ${email} from Faculty/Admin access for this organization? They will no longer see this organization after signing in.`
    );

    if (!confirmed) return;

    status.textContent = "Removing Faculty/Admin member...";
    status.className = "dashboard-card-note add-adult-status";

    try {
      const data = await this.apiFetch("removeOrganizationAdultMember", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          email
        })
      });

      await this.refreshOrganizationAccess();
      await this.refreshFacultyAdminMembersPanel();

      status.textContent =
        data.message || `${email} was removed from Faculty/Admin access.`;
      status.className = "dashboard-card-note add-adult-status success";

      console.log("[Resident Ready Faculty] Faculty/Admin member removed.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not remove Faculty/Admin member.", error);
      status.textContent = error.message || "Could not remove Faculty/Admin member.";
      status.className = "dashboard-card-note add-adult-status error";
    }
  },

  async updateFacultyAdminMemberRoleFromUI(email = "") {
    const status = document.getElementById("addAdultMemberStatus");
    const select = document.querySelector(
      `.faculty-admin-member-role-select[data-member-email="${CSS.escape(email)}"]`
    );

    if (!status || !select) return;

    if (!this.isPrimaryAdmin()) {
      status.textContent = "Only the Primary Admin can update Faculty/Admin roles.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    if (!email) {
      status.textContent = "Could not identify the member to update.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    const role = select.value;
    const roleLabel = role === "admin" ? "Admin" : "Faculty";

    const confirmed = window.confirm(
      `Update ${email} to ${roleLabel}?`
    );

    if (!confirmed) return;

    status.textContent = "Updating Faculty/Admin member role...";
    status.className = "dashboard-card-note add-adult-status";

    try {
      const data = await this.apiFetch("updateOrganizationAdultMember", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          email,
          role
        })
      });

      await this.refreshOrganizationAccess();
      await this.refreshFacultyAdminMembersPanel();

      status.textContent = data.message || `${email} is now ${roleLabel}.`;
      status.className = "dashboard-card-note add-adult-status success";

      console.log("[Resident Ready Faculty] Faculty/Admin member role updated.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not update Faculty/Admin member role.", error);
      status.textContent = error.message || "Could not update Faculty/Admin member role.";
      status.className = "dashboard-card-note add-adult-status error";
    }
  },

  renderAdultMemberRoleOptions() {
    const roleSelect = document.getElementById("adultMemberRoleSelect");
    if (!roleSelect) return;

    const currentRole = this.getCurrentFacultyRole();

    if (currentRole === "primary_admin") {
      roleSelect.innerHTML = `
        <option value="faculty">Faculty</option>
        <option value="admin">Admin</option>
      `;
      return;
    }

    roleSelect.innerHTML = `
      <option value="faculty">Faculty</option>
    `;
  },

  async addAdultMemberFromUI() {
    const emailInput = document.getElementById("adultMemberEmailInput");
    const roleSelect = document.getElementById("adultMemberRoleSelect");
    const status = document.getElementById("addAdultMemberStatus");
    const button = document.getElementById("addAdultMemberBtn");

    if (!emailInput || !roleSelect || !status || !button) return;

    const email = emailInput.value.trim().toLowerCase();
    const role = roleSelect.value;

    if (!this.hasValidBackendSession()) {
      status.textContent = "Sign in before adding faculty or admins.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    if (!this.isOrgAdmin()) {
      status.textContent = "Admin permission is required to add faculty or admins.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    if (!this.selectedOrganizationId) {
      status.textContent = "Select an organization before adding faculty or admins.";
      status.className = "dashboard-card-note add-adult-status error";
      return;
    }

    if (!email) {
      status.textContent = "Enter the faculty/admin email address.";
      status.className = "dashboard-card-note add-adult-status error";
      emailInput.focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = "Enter a valid email address.";
      status.className = "dashboard-card-note add-adult-status error";
      emailInput.focus();
      return;
    }

    status.textContent = "Adding faculty/admin member...";
    status.className = "dashboard-card-note add-adult-status";
    button.disabled = true;

    try {
      const data = await this.apiFetch("addOrganizationAdultMember", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          email,
          role
        })
      });

      emailInput.value = "";

      await this.refreshOrganizationAccess();
      this.renderAdultMemberRoleOptions();
      await this.refreshFacultyAdminMembersPanel();

      status.textContent =
        data.message ||
        `${email} was added as ${role === "admin" ? "Admin" : "Faculty"}. They can sign in with Google to access this organization.`;
      status.className = "dashboard-card-note add-adult-status success";

      console.log("[Resident Ready Faculty] Faculty/admin member added.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not add faculty/admin member.", error);
      status.textContent = error.message || "Could not add faculty/admin member.";
      status.className = "dashboard-card-note add-adult-status error";
    } finally {
      button.disabled = false;
    }
  },

    getItemCohortId(item = {}) {
    return item.cohortId || "unassigned";
  },

getCohortLabel(cohortId = "all") {
  if (cohortId === "all") return "All Cohorts";
  if (cohortId === "unassigned") return "Unassigned";

  return String(cohortId)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
},

getAvailableCohorts(residents = [], attempts = []) {
  const cohortMap = new Map();

  [...residents, ...attempts].forEach((item) => {
    const cohortId = this.getItemCohortId(item);
    cohortMap.set(cohortId, {
      cohortId,
      label: this.getCohortLabel(cohortId)
    });
  });

  return Array.from(cohortMap.values())
    .sort((a, b) => a.label.localeCompare(b.label));
},

normalizeAllCohorts(cohorts = []) {
  return cohorts
    .map((cohort) => {
      const cohortId = cohort.cohortId || cohort.id || "";

      return {
        cohortId,
        label: cohort.label || cohort.name || this.getCohortLabel(cohortId),
        status: cohort.status || "active",
        residentIds: Array.isArray(cohort.residentIds) ? cohort.residentIds : [],
        createdAt: cohort.createdAt || null,
        updatedAt: cohort.updatedAt || null,
        archivedAt: cohort.archivedAt || null,
        restoredAt: cohort.restoredAt || null
      };
    })
    .filter((cohort) => cohort.cohortId);
},

normalizeCohorts(cohorts = []) {
  return this.normalizeAllCohorts(cohorts)
    .filter((cohort) => cohort.status !== "archived");
},

mergeCohortLists(primaryCohorts = [], fallbackCohorts = []) {
  const cohortMap = new Map();

  [...primaryCohorts, ...fallbackCohorts].forEach((cohort) => {
    if (!cohort?.cohortId || cohortMap.has(cohort.cohortId)) return;
    cohortMap.set(cohort.cohortId, cohort);
  });

  return Array.from(cohortMap.values())
    .sort((a, b) => {
      if (a.cohortId === "unassigned") return -1;
      if (b.cohortId === "unassigned") return 1;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
},

  filterBySelectedCohort(items = []) {
    if (this.selectedCohortId === "all") return items;

    return items.filter((item) =>
      this.getItemCohortId(item) === this.selectedCohortId
    );
  },

  getLatestAttemptByResident(attempts = []) {
    const latestByResident = new Map();

    attempts.forEach((attempt) => {
      if (!attempt?.residentId) return;

      const existing = latestByResident.get(attempt.residentId);
      const attemptTime = new Date(attempt.savedAt || 0).getTime();
      const existingTime = new Date(existing?.savedAt || 0).getTime();

      if (!existing || attemptTime > existingTime) {
        latestByResident.set(attempt.residentId, attempt);
      }
    });

    return Array.from(latestByResident.values());
  },

  calculateCohortMetrics(residents = [], attempts = []) {
    const latestAttempts = this.getLatestAttemptByResident(attempts);
    const scores = latestAttempts
      .map((attempt) => Number(attempt.percentCorrect))
      .filter((score) => Number.isFinite(score));

    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;

    const needsFollowUp = latestAttempts.filter((attempt) =>
      Number(attempt.percentCorrect || 0) < 60
    ).length;

    return {
      residentCount: residents.length,
      averageScore,
      needsFollowUp,
      recentAttemptCount: attempts.length
    };
  },

  getAttemptFocusLabel(attempt = {}) {
    return (
      attempt.focusLabel ||
      attempt.focusTag ||
      attempt.type ||
      "General Diagnostic"
    );
  },

  calculateCohortHighlights(attempts = []) {
    const grouped = {};

    attempts.forEach((attempt) => {
      const label = this.getAttemptFocusLabel(attempt);
      const score = Number(attempt.percentCorrect);

      if (!Number.isFinite(score)) return;

      if (!grouped[label]) {
        grouped[label] = {
          label,
          scores: [],
          attemptCount: 0
        };
      }

      grouped[label].scores.push(score);
      grouped[label].attemptCount += 1;
    });

    const items = Object.values(grouped).map((item) => {
      const average = Math.round(
        item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length
      );

      return {
        ...item,
        average
      };
    });

    return {
      strengths: items
        .filter((item) => item.average >= 70)
        .sort((a, b) => b.average - a.average)
        .slice(0, 4),

      needs: items
        .filter((item) => item.average < 70)
        .sort((a, b) => a.average - b.average)
        .slice(0, 4),

      chartItems: items
        .sort((a, b) => a.average - b.average)
        .slice(0, 8)
    };
  },

  renderCohortSelector(cohorts = []) {
    const select = document.getElementById("facultyCohortSelect");
    if (!select) return;

    const currentValue = this.selectedCohortId;
    const isFacultyOnly = this.isFacultyOnly();

    if (isFacultyOnly && !cohorts.length) {
      select.innerHTML = `<option value="">No assigned cohorts</option>`;
      this.selectedCohortId = "";
      return;
    }

    if (isFacultyOnly) {
      select.innerHTML = cohorts.map((cohort) => `
        <option value="${this.escapeAttribute(cohort.cohortId)}">
          ${cohort.label}
        </option>
      `).join("");

      const hasCurrentValue = cohorts.some((cohort) => cohort.cohortId === currentValue);
      this.selectedCohortId = hasCurrentValue ? currentValue : cohorts[0].cohortId;
      select.value = this.selectedCohortId;
      return;
    }

    select.innerHTML = `
      <option value="all">All Cohorts</option>
      ${cohorts.map((cohort) => `
        <option value="${this.escapeAttribute(cohort.cohortId)}">
          ${cohort.label}
        </option>
      `).join("")}
    `;

    const hasCurrentValue =
      currentValue === "all" ||
      cohorts.some((cohort) => cohort.cohortId === currentValue);

    select.value = hasCurrentValue ? currentValue : "all";

    if (!hasCurrentValue) {
      this.selectedCohortId = "all";
    }
  },

  renderCohortSummary(residents = [], attempts = []) {
    const selectedLabel = document.getElementById("facultySelectedCohortLabel");
    const averageScore = document.getElementById("facultyAverageScore");
    const needsFollowUp = document.getElementById("facultyNeedsFollowUpCount");
    const recentAttemptCount = document.getElementById("facultyRecentAttemptCount");
    const residentCount = document.getElementById("facultyPreviewResidentCount");

    const metrics = this.calculateCohortMetrics(residents, attempts);

    if (selectedLabel) {
      selectedLabel.textContent = this.getSelectedCohortLabel();
    }

    if (averageScore) {
      averageScore.textContent =
        metrics.averageScore === null ? "--%" : `${metrics.averageScore}%`;
    }

    if (needsFollowUp) {
      needsFollowUp.textContent = metrics.needsFollowUp;
    }

    if (recentAttemptCount) {
      recentAttemptCount.textContent = metrics.recentAttemptCount;
    }

    if (residentCount) {
      residentCount.textContent = metrics.residentCount;
    }
  },

  renderHighlightList(containerId, items = [], emptyMessage = "No pattern is clear yet.") {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>${emptyMessage}</strong>
          <p>More completed attempts will make this insight stronger.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items
      .map((item) => `
        <div class="faculty-highlight-item">
          <div>
            <strong>${item.label}</strong>
            <span>${item.attemptCount} attempt${item.attemptCount === 1 ? "" : "s"}</span>
          </div>
          <strong>${item.average}%</strong>
        </div>
      `)
      .join("");
  },

  renderCohortChart(chartItems = []) {
    const chart = document.getElementById("facultyCohortChart");
    if (!chart) return;

    if (!chartItems.length) {
      chart.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No cohort chart data yet.</strong>
          <p>As more attempts are completed, this will show performance by focus area.</p>
        </div>
      `;
      return;
    }

    chart.innerHTML = chartItems
      .map((item) => {
        const width = Math.max(4, Math.min(100, Number(item.average || 0)));

        return `
          <div class="faculty-chart-row">
            <div class="chart-row-header">
              <span>${item.label}</span>
              <span>${item.average}%</span>
            </div>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="width: ${width}%"></div>
            </div>
          </div>
        `;
      })
      .join("");
  },

  renderCohortHighlights(attempts = []) {
    const highlights = this.calculateCohortHighlights(attempts);

    this.renderHighlightList(
      "facultyCohortStrengthsList",
      highlights.strengths,
      "No clear strength pattern yet."
    );

    this.renderHighlightList(
      "facultyCohortNeedsList",
      highlights.needs,
      "No clear priority-need pattern yet."
    );

    this.renderCohortChart(highlights.chartItems);
  },
  renderFacultyPreviewSignedOut() {
    const status = document.getElementById("facultyPreviewStatus");
    const residentCount = document.getElementById("facultyPreviewResidentCount");
    const rosterList = document.getElementById("facultyRosterList");
    const recentAttemptsList = document.getElementById("facultyRecentAttemptsList");
    const detailPanel = document.getElementById("facultyAttemptDetailPanel");

    if (status) status.textContent = "Sign in with Google to load the faculty dashboard.";
    if (residentCount) residentCount.textContent = "--";
    if (rosterList) {
      rosterList.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Sign in to view residents.</strong>
          <p>Your roster will load after Google sign-in and organization access are confirmed.</p>
        </div>
      `;
    }
    if (recentAttemptsList) {
      recentAttemptsList.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Sign in to view recent attempts.</strong>
          <p>Faculty-safe attempt summaries will load after you select an organization.</p>
        </div>
      `;
    }
    if (detailPanel) {
      detailPanel.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Sign in to review attempts.</strong>
          <p>Question-level faculty-safe reviews will appear here after residents complete work.</p>
        </div>
      `;
    }

    this.latestOrganizationMemberships = [];
    this.latestOrganizationCohorts = [];
    this.latestAllOrganizationCohorts = [];
    this.latestOrganizationAdultMembers = [];
    this.latestCreatedResidentAccessCode = null;
    this.selectedOrganizationId = "";

    this.renderOrganizationSelector([]);
    this.renderRoleBasedControls();
    this.renderFacultyAdminMemberList();
    this.renderResidentAccessCodeCohortOptions();
    this.renderCreatedResidentAccessCode(null);
    this.renderManageCohortsPanel();
    this.renderPromoteCohortOptions();

    this.renderCohortSummary([], []);
    this.renderHighlightList("facultyCohortStrengthsList", [], "Sign in to view cohort strengths.");
    this.renderHighlightList("facultyCohortNeedsList", [], "Sign in to view cohort needs.");
    this.renderCohortChart([]);
  },

  renderFacultyPreviewLoading() {
    const status = document.getElementById("facultyPreviewStatus");
    const rosterList = document.getElementById("facultyRosterList");
    const recentAttemptsList = document.getElementById("facultyRecentAttemptsList");
    const detailPanel = document.getElementById("facultyAttemptDetailPanel");

    if (status) status.textContent = "Loading faculty preview...";
    if (rosterList) rosterList.innerHTML = "Loading roster...";
    if (recentAttemptsList) recentAttemptsList.innerHTML = "Loading recent attempts...";
    if (detailPanel) detailPanel.innerHTML = "Select a recent attempt to preview the faculty-safe review.";

    this.renderHighlightList("facultyCohortStrengthsList", [], "Loading cohort strengths...");
    this.renderHighlightList("facultyCohortNeedsList", [], "Loading cohort needs...");
    this.renderCohortChart([]);
  },

  async renderFacultyPreview() {
    const status = document.getElementById("facultyPreviewStatus");
    const residentCount = document.getElementById("facultyPreviewResidentCount");
    const rosterList = document.getElementById("facultyRosterList");
    const recentAttemptsList = document.getElementById("facultyRecentAttemptsList");
    const detailPanel = document.getElementById("facultyAttemptDetailPanel");

    if (!status || !residentCount || !rosterList || !recentAttemptsList || !detailPanel) {
      return;
    }

    if (!this.hasValidBackendSession()) {
      this.renderFacultyPreviewSignedOut();
      return;
    }

    this.renderFacultyPreviewLoading();

    try {
      const memberships = await this.refreshOrganizationAccess();

      if (!memberships.length || !this.selectedOrganizationId) {
        residentCount.textContent = "--";
        rosterList.innerHTML = `
          <div class="diagnostic-history-empty-state">
            <strong>No organization selected yet.</strong>
            <p>Select or claim an organization before viewing residents.</p>
          </div>
        `;
        recentAttemptsList.innerHTML = `
          <div class="diagnostic-history-empty-state">
            <strong>No organization selected yet.</strong>
            <p>Recent attempts will appear after an organization and cohort are selected.</p>
          </div>
        `;
        detailPanel.innerHTML = `
          <div class="diagnostic-history-empty-state">
            <strong>No faculty-safe review selected.</strong>
            <p>Once residents complete attempts, select Review to open question-level details.</p>
          </div>
        `;
        return;
      }

      const cohortData = await this.loadOrganizationCohorts();
      const allBackendCohorts = this.normalizeAllCohorts(cohortData?.cohorts || []);
      const backendCohorts = allBackendCohorts.filter((cohort) => cohort.status !== "archived");
      this.latestAllOrganizationCohorts = allBackendCohorts;
      this.latestOrganizationCohorts = backendCohorts;

      if (this.isFacultyOnly()) {
        if (!backendCohorts.length) {
          this.selectedCohortId = "";
          this.renderCohortSelector([]);
          this.renderResidentAccessCodeCohortOptions();
          await this.refreshFacultyAdminMembersPanel();

          residentCount.textContent = "0";
          this.renderCohortSummary([], []);
          this.renderCohortHighlights([]);

          status.textContent =
            "No cohorts are assigned to your Faculty account yet. Ask an Admin to assign cohort access.";
          rosterList.innerHTML = `
            <div class="diagnostic-history-empty-state">
              <strong>No assigned cohorts yet.</strong>
              <p>Your Faculty dashboard will load after an Admin assigns you to one or more cohorts.</p>
            </div>
          `;
          recentAttemptsList.innerHTML = `
            <div class="diagnostic-history-empty-state">
              <strong>No assigned cohorts yet.</strong>
              <p>Recent attempts will appear after cohort access is assigned.</p>
            </div>
          `;
          detailPanel.innerHTML = `
            <div class="diagnostic-history-empty-state">
              <strong>No faculty-safe review available yet.</strong>
              <p>Faculty-safe reviews require assigned cohort access.</p>
            </div>
          `;
          return;
        }

        const selectedStillAllowed = backendCohorts.some((cohort) =>
          cohort.cohortId === this.selectedCohortId
        );

        if (!selectedStillAllowed) {
          this.selectedCohortId = backendCohorts[0].cohortId;
        }
      }

      const data = await this.loadFacultyIndex();

      const residents = Array.isArray(data?.roster?.residents)
        ? data.roster.residents
        : [];

      const attempts = Array.isArray(data?.recentAttempts?.attempts)
        ? data.recentAttempts.attempts
        : [];

      this.latestFacultyIndexData = data;

      const observedCohorts = this.getAvailableCohorts(residents, attempts);
      const cohorts = this.mergeCohortLists(backendCohorts, observedCohorts);
      this.latestOrganizationCohorts = cohorts;
      this.renderCohortSelector(cohorts);
      this.renderResidentAccessCodeCohortOptions();
      this.renderManageCohortsPanel();
      this.renderPromoteCohortOptions();
      await this.refreshFacultyAdminMembersPanel();

      const filteredResidents = residents;
      const filteredAttempts = attempts;

      this.renderCohortSummary(filteredResidents, filteredAttempts);
      this.renderCohortHighlights(filteredAttempts);

      status.textContent =
        `Loaded ${filteredResidents.length} resident${filteredResidents.length === 1 ? "" : "s"} and ${filteredAttempts.length} recent attempt${filteredAttempts.length === 1 ? "" : "s"} for ${this.getCohortLabel(this.selectedCohortId)} in ${this.getSelectedOrganizationLabel()}.`;

      this.renderFacultyRoster(filteredResidents);
      this.renderFacultyRecentAttempts(filteredAttempts);
      detailPanel.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Select a recent attempt to open the faculty-safe review.</strong>
          <p>The review will show the stem, answer choices, selected answer, correct answer, rationale, and tags while keeping resident notes and testing tools private.</p>
        </div>
      `;
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not render faculty preview.", error);

      status.textContent = "Could not load faculty preview. Check the console for details.";
      residentCount.textContent = "--";
      rosterList.innerHTML = "Faculty roster failed to load.";
      recentAttemptsList.innerHTML = "Recent attempts failed to load.";
      detailPanel.innerHTML = "Faculty-safe review failed to load.";
    }
  },

  renderMoveResidentCohortOptions(currentCohortId = "unassigned") {
    const cohorts = Array.isArray(this.latestOrganizationCohorts)
      ? this.latestOrganizationCohorts
      : [];

    if (!cohorts.length) {
      return `<option value="unassigned">Unassigned</option>`;
    }

    return cohorts
      .map((cohort) => `
        <option
          value="${this.escapeAttribute(cohort.cohortId)}"
          ${cohort.cohortId === currentCohortId ? "selected" : ""}
        >
          ${this.escapeHtml(cohort.label)}
        </option>
      `)
      .join("");
  },

  async moveResidentToCohortFromUI(residentId = "") {
    const status = document.getElementById("facultyRosterActionStatus");
    const select = document.querySelector(
      `.faculty-move-resident-select[data-resident-id="${CSS.escape(residentId)}"]`
    );
    const button = document.querySelector(
      `.faculty-move-resident-btn[data-resident-id="${CSS.escape(residentId)}"]`
    );

    if (!status || !select || !button) return;

    const targetCohortId = select.value;

    if (!this.hasValidBackendSession()) {
      status.textContent = "Sign in before moving a resident.";
      status.className = "dashboard-card-note roster-action-status error";
      return;
    }

    if (!this.isOrgAdmin()) {
      status.textContent = "Admin permission is required to move residents between cohorts.";
      status.className = "dashboard-card-note roster-action-status error";
      return;
    }

    if (!this.selectedOrganizationId) {
      status.textContent = "Select an organization before moving a resident.";
      status.className = "dashboard-card-note roster-action-status error";
      return;
    }

    if (!residentId) {
      status.textContent = "Could not identify the resident to move.";
      status.className = "dashboard-card-note roster-action-status error";
      return;
    }

    if (!targetCohortId) {
      status.textContent = "Select a target cohort before moving the resident.";
      status.className = "dashboard-card-note roster-action-status error";
      return;
    }

    const targetLabel = this.getAccessCodeTargetCohortLabel(targetCohortId);

    const confirmed = window.confirm(
      `Move this resident to ${targetLabel}? New attempts will save under the new cohort.`
    );

    if (!confirmed) return;

    status.textContent = `Moving resident to ${targetLabel}...`;
    status.className = "dashboard-card-note roster-action-status";
    button.disabled = true;

    try {
      const data = await this.apiFetch("moveResidentToCohort", {
        method: "POST",
        body: JSON.stringify({
          organizationId: this.selectedOrganizationId,
          residentId,
          targetCohortId,
          reason: "manual_move_from_faculty_dashboard"
        })
      });

      this.selectedCohortId = data.targetCohort?.cohortId || targetCohortId;
      this.latestCreatedResidentAccessCode = null;
      this.renderCreatedResidentAccessCode(null);

      await this.renderFacultyPreview();

      status.textContent =
        `Resident moved to ${data.targetCohort?.label || targetLabel}.`;
      status.className = "dashboard-card-note roster-action-status success";

      console.log("[Resident Ready Faculty] Resident moved to cohort.", data);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not move resident.", error);
      status.textContent = error.message || "Could not move resident to cohort.";
      status.className = "dashboard-card-note roster-action-status error";
    } finally {
      button.disabled = false;
    }
  },


  renderFacultyRoster(residents = []) {
    const rosterList = document.getElementById("facultyRosterList");
    if (!rosterList) return;

    if (!residents.length) {
      rosterList.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No residents in this cohort yet.</strong>
          <p>Create a resident access code for this cohort, then share it with residents. Once they join, they will appear here.</p>
        </div>
      `;
      return;
    }

    rosterList.innerHTML = residents
      .map((resident) => {
        const currentCohortId = resident.cohortId || "unassigned";
        const moveControlsHtml = this.isOrgAdmin()
          ? `
            <div class="faculty-roster-move-controls">
              <label>
                Move to
                <select
                  class="faculty-move-resident-select"
                  data-resident-id="${this.escapeAttribute(resident.residentId)}"
                >
                  ${this.renderMoveResidentCohortOptions(currentCohortId)}
                </select>
              </label>

              <button
                class="secondary faculty-move-resident-btn"
                type="button"
                data-resident-id="${this.escapeAttribute(resident.residentId)}"
              >
                Move
              </button>
            </div>
          `
          : "";

        return `
          <div class="attempt-history-item faculty-roster-item ${this.isOrgAdmin() ? "" : "faculty-roster-readonly"}">
            <div>
              <strong>${this.escapeHtml(resident.residentName || resident.displayName || resident.residentEmail || "Unnamed Resident")}</strong>
              <span>${this.escapeHtml(resident.residentEmail || "No email")} · ${this.escapeHtml(resident.cohortLabel || currentCohortId)}</span>
            </div>

            <div>
              <strong>${resident.latestPercentCorrect ?? "--"}%</strong>
              <span>${this.escapeHtml(resident.programYear || "No year")} · ${this.escapeHtml(resident.specialtyTrack || "No specialty")}</span>
            </div>

            ${moveControlsHtml}
          </div>
        `;
      })
      .join("");
  },

  renderFacultyRecentAttempts(attempts = []) {
    const recentAttemptsList = document.getElementById("facultyRecentAttemptsList");
    if (!recentAttemptsList) return;

    if (!attempts.length) {
      recentAttemptsList.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No recent attempts for this cohort yet.</strong>
          <p>After residents join and complete diagnostics or practice, their faculty-safe attempt summaries will appear here.</p>
        </div>
      `;
      return;
    }

    recentAttemptsList.innerHTML = attempts
      .slice(0, 25)
      .map((attempt) => {
        const scoreClass = this.getScoreClass(attempt.percentCorrect);

        return `
          <div class="attempt-history-item faculty-attempt-item">
            <div>
              <strong>${attempt.residentName || attempt.residentEmail || "Unnamed Resident"}</strong>
              <span>${attempt.type || "attempt"} · ${this.formatDate(attempt.savedAt)}</span>
            </div>

            <div>
              <strong class="${scoreClass}">${attempt.percentCorrect ?? "--"}%</strong>
              <span>${attempt.correctCount ?? "--"}/${attempt.totalQuestions ?? "--"} correct · ${attempt.flaggedCount ?? 0} flagged</span>
            </div>

            <button
              class="secondary faculty-review-attempt-btn"
              type="button"
              data-resident-id="${this.escapeAttribute(attempt.residentId)}"
              data-attempt-id="${this.escapeAttribute(attempt.id)}"
              data-faculty-scope="${this.escapeAttribute(attempt.facultyScope || "default")}"
            >
              Review
            </button>
          </div>
        `;
      })
      .join("");
  },

  async openFacultyAttemptDetail(residentId, attemptId, facultyScope = "default") {
    const detailPanel = document.getElementById("facultyAttemptDetailPanel");
    if (!detailPanel) return;

    detailPanel.innerHTML = "Loading faculty-safe attempt review...";

    try {
      const data = await this.loadFacultyAttemptDetail(residentId, attemptId, facultyScope);
      this.renderFacultyAttemptDetail(data.detail);
    } catch (error) {
      console.warn("[Resident Ready Faculty] Could not load faculty-safe attempt detail.", error);
      detailPanel.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>Faculty-safe review could not load.</strong>
          <p>This may be an older attempt saved before faculty-safe detail was added.</p>
        </div>
      `;
    }
  },

  renderFacultyAttemptDetail(detail = {}) {
    const detailPanel = document.getElementById("facultyAttemptDetailPanel");
    if (!detailPanel) return;

    const reviewItems = Array.isArray(detail.reviewItems) ? detail.reviewItems : [];

    if (!reviewItems.length) {
      detailPanel.innerHTML = `
        <div class="diagnostic-history-empty-state">
          <strong>No faculty-safe question detail found.</strong>
          <p>This attempt may not have review items available.</p>
        </div>
      `;
      return;
    }

    const summaryHtml = `
      <div class="diagnostic-history-summary">
        <div>
          <strong>${detail.residentName || detail.residentEmail || "Resident Attempt"}</strong>
          <p>
            ${detail.type || "Attempt"} · ${detail.percentCorrect ?? "--"}% ·
            ${detail.correctCount ?? "--"}/${detail.totalQuestions ?? "--"} correct ·
            ${this.formatDate(detail.savedAt)}
          </p>
        </div>

        <div class="diagnostic-history-mini-metrics">
          <span><strong>${detail.missedCount ?? "--"}</strong> missed</span>
          <span><strong>${detail.flaggedCount ?? 0}</strong> flagged</span>
        </div>
      </div>
    `;

    const reviewHtml = reviewItems
      .map((item) => {
        const selectedLabel = item.selectedAnswer || "No answer";
        const correctLabel = item.correctAnswer || "Not available";
        const resultClass = item.isCorrect ? "growth-positive" : "growth-needs-attention";

        const choicesHtml = (item.answerChoices || [])
          .map((choice) => {
            const isSelected = choice.id === item.selectedAnswer || choice.label === item.selectedAnswer;
            const isCorrect = choice.id === item.correctAnswer || choice.label === item.correctAnswer;

        return `
          <li class="${isSelected ? "faculty-selected-answer" : ""} ${isCorrect ? "faculty-correct-answer" : ""}">
            <div class="faculty-answer-choice-content">
              <span class="faculty-answer-choice-text">
                <strong>${choice.label || choice.id}.</strong> ${choice.text || ""}
              </span>

              ${
                isSelected || isCorrect
                  ? `<span class="faculty-answer-badge-row">
                      ${isSelected ? `<span class="faculty-answer-badge selected">Resident selected</span>` : ""}
                      ${isCorrect ? `<span class="faculty-answer-badge correct">Correct answer</span>` : ""}
                    </span>`
                  : ""
              }
            </div>
          </li>
        `;
          })
          .join("");

        return `
          <article class="faculty-review-question">
            <div class="faculty-review-question-header">
              <strong>Question ${item.questionNumber || ""}</strong>
              <span class="${resultClass}">${item.isCorrect ? "Correct" : "Incorrect"}</span>
            </div>

            <p>${item.stem || "Question stem unavailable."}</p>

            <ul class="faculty-answer-choice-list">
              ${choicesHtml}
            </ul>

            <div class="faculty-review-answer-row">
              <span><strong>Resident selected:</strong> ${selectedLabel}</span>
              <span><strong>Correct answer:</strong> ${correctLabel}</span>
            </div>

            ${
              item.rationale
                ? `<p class="dashboard-card-note"><strong>Rationale:</strong> ${item.rationale}</p>`
                : ""
            }

            ${
              item.clinicalReasoningTakeaway
                ? `<p class="dashboard-card-note"><strong>Clinical reasoning takeaway:</strong> ${item.clinicalReasoningTakeaway}</p>`
                : ""
            }
          </article>
        `;
      })
      .join("");

    detailPanel.innerHTML = `
      ${summaryHtml}
      <div class="history-scroll-list diagnostic-attempt-scroll-list">
        ${reviewHtml}
      </div>
    `;
  },

  init() {
    this.initGoogleSignIn();
    this.renderAuthState();

    if (this.hasValidBackendSession()) {
      this.renderFacultyPreview();
    } else {
      this.renderFacultyPreviewSignedOut();
    }

    const refreshBtn = document.getElementById("refreshFacultyPreviewBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.renderFacultyPreview();
      });
    }

    const organizationSelect = document.getElementById("facultyOrganizationSelect");
    if (organizationSelect) {
      organizationSelect.addEventListener("change", (event) => {
        this.selectedOrganizationId = event.target.value || "";
        this.selectedCohortId = "all";
        this.latestCreatedResidentAccessCode = null;
        this.renderCreatedResidentAccessCode(null);
        this.renderRoleBasedControls();
        this.refreshFacultyAdminMembersPanel();
        this.renderFacultyPreview();
      });
    }

    const refreshOrganizationsBtn = document.getElementById("refreshOrganizationsBtn");
    if (refreshOrganizationsBtn) {
      refreshOrganizationsBtn.addEventListener("click", () => {
        this.refreshOrganizationAccess();
      });
    }

    const cohortSelect = document.getElementById("facultyCohortSelect");
    if (cohortSelect) {
      cohortSelect.addEventListener("change", (event) => {
        this.selectedCohortId = event.target.value || "all";
        this.renderFacultyPreview();
      });
    }

        const addAdultMemberBtn = document.getElementById("addAdultMemberBtn");
    if (addAdultMemberBtn) {
      addAdultMemberBtn.addEventListener("click", () => {
        this.addAdultMemberFromUI();
      });
    }

    const adultMemberEmailInput = document.getElementById("adultMemberEmailInput");
    if (adultMemberEmailInput) {
      adultMemberEmailInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this.addAdultMemberFromUI();
      });
    }

    const facultyAdminMemberList = document.getElementById("facultyAdminMemberList");
    if (facultyAdminMemberList) {
      facultyAdminMemberList.addEventListener("click", (event) => {
        const updateBtn = event.target.closest(".update-faculty-admin-member-role-btn");
        const removeBtn = event.target.closest(".remove-faculty-admin-member-btn");
        const saveCohortAccessBtn = event.target.closest(".save-faculty-cohort-access-btn");

        if (saveCohortAccessBtn) {
          this.saveFacultyCohortAssignmentsFromUI(
            saveCohortAccessBtn.dataset.memberEmail || ""
          );
          return;
        }

        if (updateBtn) {
          this.updateFacultyAdminMemberRoleFromUI(updateBtn.dataset.memberEmail || "");
          return;
        }

        if (removeBtn) {
          this.removeFacultyAdminMemberFromUI(removeBtn.dataset.memberEmail || "");
        }
      });
    }

    const createCohortBtn = document.getElementById("createCohortBtn");
    if (createCohortBtn) {
      createCohortBtn.addEventListener("click", () => {
        this.createOrganizationCohortFromUI();
      });
    }

    const newCohortNameInput = document.getElementById("newCohortNameInput");
    if (newCohortNameInput) {
      newCohortNameInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this.createOrganizationCohortFromUI();
      });
    }

    const manageCohortsBtn = document.getElementById("manageCohortsBtn");
    if (manageCohortsBtn) {
      manageCohortsBtn.addEventListener("click", () => {
        this.toggleManageCohortsPanel();
      });
    }

    const manageCohortsList = document.getElementById("manageCohortsList");
    if (manageCohortsList) {
      manageCohortsList.addEventListener("click", (event) => {
        const renameBtn = event.target.closest(".rename-cohort-btn");
        const archiveBtn = event.target.closest(".archive-cohort-btn");
        const restoreBtn = event.target.closest(".restore-cohort-btn");

        if (renameBtn) {
          this.updateOrganizationCohortFromUI(
            renameBtn.dataset.cohortId || "",
            "rename"
          );
          return;
        }

        if (archiveBtn) {
          this.updateOrganizationCohortFromUI(
            archiveBtn.dataset.cohortId || "",
            "archive"
          );
          return;
        }

        if (restoreBtn) {
          this.updateOrganizationCohortFromUI(
            restoreBtn.dataset.cohortId || "",
            "restore"
          );
        }
      });
    }

    const promoteCohortBtn = document.getElementById("promoteCohortBtn");
    if (promoteCohortBtn) {
      promoteCohortBtn.addEventListener("click", () => {
        this.promoteCohortFromUI();
      });
    }

    const createResidentAccessCodeBtn = document.getElementById("createResidentAccessCodeBtn");
    if (createResidentAccessCodeBtn) {
      createResidentAccessCodeBtn.addEventListener("click", () => {
        this.createResidentAccessCodeFromUI();
      });
    }

    const copyResidentAccessCodeBtn = document.getElementById("copyResidentAccessCodeBtn");
    if (copyResidentAccessCodeBtn) {
      copyResidentAccessCodeBtn.addEventListener("click", () => {
        this.copyLatestResidentAccessCode();
      });
    }

    const signOutBtn = document.getElementById("facultySignOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", () => {
        const shouldSignOut = window.confirm(
          "Sign out of the faculty dashboard on this device?"
        );

        if (!shouldSignOut) return;

        this.signOut();
      });
    }

    const rosterList = document.getElementById("facultyRosterList");
    if (rosterList) {
      rosterList.addEventListener("click", (event) => {
        const moveBtn = event.target.closest(".faculty-move-resident-btn");
        if (!moveBtn) return;

        this.moveResidentToCohortFromUI(moveBtn.dataset.residentId || "");
      });
    }

    const recentAttemptsList = document.getElementById("facultyRecentAttemptsList");
    if (recentAttemptsList) {
      recentAttemptsList.addEventListener("click", (event) => {
        const reviewBtn = event.target.closest(".faculty-review-attempt-btn");
        if (!reviewBtn) return;

        this.openFacultyAttemptDetail(
          reviewBtn.dataset.residentId,
          reviewBtn.dataset.attemptId,
          reviewBtn.dataset.facultyScope || "default"
        );
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
  }
};

window.addEventListener("DOMContentLoaded", () => {
  window.FacultyApp.init();
});