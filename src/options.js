(function initOptionsPage() {
  const CORE = window.X2NotionCore;
  if (!CORE) {
    return;
  }

  const form = document.getElementById("settingsForm");
  const tokenInput = document.getElementById("notionToken");
  const databaseIdInput = document.getElementById("notionDatabaseId");
  const enabledInput = document.getElementById("enabledOnX");
  const saveButton = document.getElementById("saveButton");
  const testButton = document.getElementById("testConnectionButton");
  const statusMessage = document.getElementById("statusMessage");
  const toggleTokenButton = document.getElementById("toggleTokenVisibility");
  const connectionBadge = document.getElementById("connectionBadge");
  const schemaBadge = document.getElementById("schemaBadge");
  const missingList = document.getElementById("missingList");
  const mismatchList = document.getElementById("mismatchList");

  loadInitialSettings();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings();
  });

  testButton.addEventListener("click", async () => {
    await testConnection();
  });

  toggleTokenButton.addEventListener("click", () => {
    const nextType = tokenInput.type === "password" ? "text" : "password";
    tokenInput.type = nextType;
    toggleTokenButton.textContent = nextType === "password" ? "Show" : "Hide";
  });

  databaseIdInput.addEventListener("blur", () => {
    const normalized = CORE.normalizeDatabaseId(databaseIdInput.value);
    if (normalized) {
      databaseIdInput.value = normalized;
    }
  });

  async function loadInitialSettings() {
    try {
      const response = await sendRuntimeMessage({ type: "GET_SETTINGS" });
      const settings = response?.settings || {};

      tokenInput.value = settings[CORE.STORAGE_KEYS.notionToken] || "";
      databaseIdInput.value = settings[CORE.STORAGE_KEYS.notionDatabaseId] || "";
      enabledInput.checked = settings[CORE.STORAGE_KEYS.enabledOnX] !== false;
      resetDiagnostics();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load settings.", "error");
    }
  }

  async function saveSettings() {
    const notionToken = tokenInput.value.trim();
    const notionDatabaseId = CORE.normalizeDatabaseId(databaseIdInput.value);
    const enabledOnX = enabledInput.checked;

    if (!CORE.isLikelyNotionToken(notionToken)) {
      setStatus("Please paste a valid Notion integration token.", "error");
      return;
    }
    if (!notionDatabaseId) {
      setStatus("Please provide a valid Notion database ID or URL.", "error");
      return;
    }

    saveButton.disabled = true;
    try {
      await Promise.all([
        chrome.storage.local.set({
          [CORE.STORAGE_KEYS.notionToken]: notionToken
        }),
        chrome.storage.sync.set({
          [CORE.STORAGE_KEYS.notionDatabaseId]: notionDatabaseId,
          [CORE.STORAGE_KEYS.enabledOnX]: enabledOnX
        })
      ]);

      databaseIdInput.value = notionDatabaseId;
      setStatus("Settings saved. Run a connection test to verify schema safety.", "success");
      connectionBadge.textContent = "Saved";
      connectionBadge.dataset.tone = "neutral";
      schemaBadge.textContent = "Schema unknown";
      schemaBadge.dataset.tone = "neutral";
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save settings.", "error");
    } finally {
      saveButton.disabled = false;
    }
  }

  async function testConnection() {
    const notionToken = tokenInput.value.trim();
    const notionDatabaseId = CORE.normalizeDatabaseId(databaseIdInput.value);

    if (!CORE.isLikelyNotionToken(notionToken) || !notionDatabaseId) {
      setStatus("Enter a valid token and database ID before testing.", "error");
      return;
    }

    testButton.disabled = true;
    setStatus("Testing Notion connection...", "warning");

    try {
      const response = await sendRuntimeMessage({
        type: "TEST_CONNECTION",
        payload: {
          notionToken,
          notionDatabaseId
        }
      });

      if (response?.status !== "ok") {
        connectionBadge.textContent = "Connection failed";
        connectionBadge.dataset.tone = "error";
        schemaBadge.textContent = "Schema unknown";
        schemaBadge.dataset.tone = "neutral";
        setStatus(response?.message || "Connection test failed.", "error");
        renderDiagnostics([], []);
        return;
      }

      connectionBadge.textContent = "Connected";
      connectionBadge.dataset.tone = "success";

      const missingRequired = Array.isArray(response.missingRequired) ? response.missingRequired : [];
      const missingOptional = Array.isArray(response.missingOptional) ? response.missingOptional : [];
      const mismatchedRequired = Array.isArray(response.mismatchedRequired) ? response.mismatchedRequired : [];
      const mismatchedOptional = Array.isArray(response.mismatchedOptional) ? response.mismatchedOptional : [];

      renderDiagnostics(
        [
          ...missingRequired.map((name) => ({ text: `${name} (required)`, tone: "error" })),
          ...missingOptional.map((name) => ({ text: `${name} (optional)`, tone: "warning" }))
        ],
        [
          ...mismatchedRequired.map((item) => ({
            text: `${item.name}: ${item.actual} -> ${item.expected} (required)`,
            tone: "error"
          })),
          ...mismatchedOptional.map((item) => ({
            text: `${item.name}: ${item.actual} -> ${item.expected} (optional)`,
            tone: "warning"
          }))
        ]
      );

      if (!response.isWriteSafe) {
        schemaBadge.textContent = "Schema blocked";
        schemaBadge.dataset.tone = "error";
        setStatus(
          `Connected to "${response.databaseTitle}". Fix required schema items before saving posts.`,
          "error"
        );
        return;
      }

      if (missingOptional.length > 0 || mismatchedOptional.length > 0) {
        schemaBadge.textContent = "Schema usable";
        schemaBadge.dataset.tone = "warning";
        setStatus(
          `Connected to "${response.databaseTitle}". Saves will work. Add optional Posted At if you want timestamp context.`,
          "warning"
        );
        return;
      }

      schemaBadge.textContent = "Schema healthy";
      schemaBadge.dataset.tone = "success";
      setStatus(`Connected to "${response.databaseTitle}". Schema is production-ready.`, "success");
    } catch (error) {
      connectionBadge.textContent = "Connection failed";
      connectionBadge.dataset.tone = "error";
      schemaBadge.textContent = "Schema unknown";
      schemaBadge.dataset.tone = "neutral";
      setStatus(error instanceof Error ? error.message : "Connection test failed.", "error");
      renderDiagnostics([], []);
    } finally {
      testButton.disabled = false;
    }
  }

  function resetDiagnostics() {
    renderDiagnostics([], []);
    connectionBadge.textContent = "Not tested";
    connectionBadge.dataset.tone = "neutral";
    schemaBadge.textContent = "Schema unknown";
    schemaBadge.dataset.tone = "neutral";
  }

  function renderDiagnostics(missingItems, mismatchItems) {
    renderChipList(missingList, missingItems, "No missing properties.");
    renderChipList(mismatchList, mismatchItems, "No type mismatches.");
  }

  function renderChipList(container, items, emptyLabel) {
    container.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      const placeholder = document.createElement("li");
      placeholder.className = "chip";
      placeholder.textContent = emptyLabel;
      container.appendChild(placeholder);
      return;
    }

    for (const item of items) {
      const chip = document.createElement("li");
      chip.className = "chip";
      if (item.tone) {
        chip.dataset.tone = item.tone;
      }
      chip.textContent = item.text || "";
      container.appendChild(chip);
    }
  }

  function setStatus(message, tone) {
    statusMessage.textContent = message;
    statusMessage.dataset.tone = tone || "neutral";
  }

  function sendRuntimeMessage(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }
})();
