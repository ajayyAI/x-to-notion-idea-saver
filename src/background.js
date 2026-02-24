importScripts("shared-core.js");

const CORE = self.X2NotionCore;

const DEFAULT_SYNC_SETTINGS = {
  [CORE.STORAGE_KEYS.notionDatabaseId]: "",
  [CORE.STORAGE_KEYS.enabledOnX]: true
};

const DEFAULT_LOCAL_SETTINGS = {
  [CORE.STORAGE_KEYS.notionToken]: ""
};

const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_NOTION_RETRIES = 2;
const NOTION_REQUEST_TIMEOUT_MS = 12000;

const inFlightSaves = new Map();
const databaseCache = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  await migrateAndNormalizeSettings();
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse(normalizeError(error)));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "SAVE_POST":
      return handleSavePost(message.payload);
    case "TEST_CONNECTION":
      return handleTestConnection(message.payload);
    case "GET_SETTINGS":
      return { status: "ok", settings: await getSettings() };
    case "OPEN_OPTIONS":
      await chrome.runtime.openOptionsPage();
      return { status: "ok" };
    default:
      return {
        status: "error",
        code: "UNKNOWN_MESSAGE",
        message: "Unsupported message type."
      };
  }
}

async function migrateAndNormalizeSettings() {
  const syncSettings = await chrome.storage.sync.get({
    ...DEFAULT_SYNC_SETTINGS,
    [CORE.STORAGE_KEYS.notionToken]: ""
  });
  const localSettings = await chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS);

  const normalizedDatabaseId = CORE.normalizeDatabaseId(syncSettings[CORE.STORAGE_KEYS.notionDatabaseId]) || "";
  const syncToken = (syncSettings[CORE.STORAGE_KEYS.notionToken] || "").trim();
  const localToken = (localSettings[CORE.STORAGE_KEYS.notionToken] || "").trim();

  await chrome.storage.sync.set({
    [CORE.STORAGE_KEYS.notionDatabaseId]: normalizedDatabaseId,
    [CORE.STORAGE_KEYS.enabledOnX]: syncSettings[CORE.STORAGE_KEYS.enabledOnX] !== false
  });

  if (syncToken && !localToken) {
    await chrome.storage.local.set({
      [CORE.STORAGE_KEYS.notionToken]: syncToken
    });
  }

  if (syncToken) {
    await chrome.storage.sync.remove(CORE.STORAGE_KEYS.notionToken);
  }
}

async function getSettings() {
  const [syncSettings, localSettings] = await Promise.all([
    chrome.storage.sync.get(DEFAULT_SYNC_SETTINGS),
    chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS)
  ]);

  return {
    [CORE.STORAGE_KEYS.notionToken]: (localSettings[CORE.STORAGE_KEYS.notionToken] || "").trim(),
    [CORE.STORAGE_KEYS.notionDatabaseId]: CORE.normalizeDatabaseId(syncSettings[CORE.STORAGE_KEYS.notionDatabaseId]) || "",
    [CORE.STORAGE_KEYS.enabledOnX]: syncSettings[CORE.STORAGE_KEYS.enabledOnX] !== false
  };
}

function validateConfiguration(settings) {
  const notionToken = (settings[CORE.STORAGE_KEYS.notionToken] || "").trim();
  const notionDatabaseId = CORE.normalizeDatabaseId(settings[CORE.STORAGE_KEYS.notionDatabaseId]);

  if (!CORE.isLikelyNotionToken(notionToken) || !notionDatabaseId) {
    return {
      ok: false,
      status: "error",
      code: "NOT_CONFIGURED",
      message: "Notion token or database ID is missing."
    };
  }

  return {
    ok: true,
    notionToken,
    notionDatabaseId
  };
}

function validateIncomingPost(post) {
  const postUrl = CORE.normalizePostUrl(post?.postUrl || "");
  const statusId = CORE.extractStatusIdFromPostUrl(postUrl || "");
  if (!postUrl || !statusId) {
    return {
      ok: false,
      status: "error",
      code: "INVALID_POST_URL",
      message: "Could not parse a valid post URL."
    };
  }

  return {
    ok: true,
    postId: statusId,
    postUrl,
    postedAt: CORE.normalizeISODate(post?.postedAt || ""),
    savedAt: CORE.normalizeISODate(post?.savedAt || "") || new Date().toISOString()
  };
}

async function handleTestConnection(payload) {
  const current = await getSettings();
  const notionToken = (payload?.notionToken || current[CORE.STORAGE_KEYS.notionToken] || "").trim();
  const notionDatabaseId = CORE.normalizeDatabaseId(
    payload?.notionDatabaseId || current[CORE.STORAGE_KEYS.notionDatabaseId] || ""
  );

  if (!CORE.isLikelyNotionToken(notionToken) || !notionDatabaseId) {
    return {
      status: "error",
      code: "INVALID_SETTINGS",
      message: "Please provide a valid Notion token and database ID."
    };
  }

  const database = await getDatabaseDefinition(notionToken, notionDatabaseId, true);
  const databaseTitle = getDatabaseTitle(database);
  const schemaCheck = CORE.evaluateDatabaseSchema(database.properties);

  return {
    status: "ok",
    databaseTitle: databaseTitle || "Untitled database",
    ...schemaCheck
  };
}

async function handleSavePost(postPayload) {
  const settings = await getSettings();
  const config = validateConfiguration(settings);
  if (!config.ok) {
    return config;
  }

  const post = validateIncomingPost(postPayload);
  if (!post.ok) {
    return post;
  }

  const operationKey = `${config.notionDatabaseId}:${post.postId}`;
  if (inFlightSaves.has(operationKey)) {
    return inFlightSaves.get(operationKey);
  }

  const promise = performSavePost(config, post).finally(() => {
    inFlightSaves.delete(operationKey);
  });

  inFlightSaves.set(operationKey, promise);
  return promise;
}

async function performSavePost(config, post) {
  const database = await getDatabaseDefinition(config.notionToken, config.notionDatabaseId, false);
  const schemaCheck = CORE.evaluateDatabaseSchema(database.properties);
  if (!schemaCheck.isWriteSafe) {
    return {
      status: "error",
      code: "SCHEMA_INVALID",
      message: buildSchemaGuidance(schemaCheck)
    };
  }

  const existing = await findExistingByPostUrl(config.notionToken, config.notionDatabaseId, post.postUrl);
  if (existing) {
    return {
      status: "already_saved",
      notionPageId: existing.id || null
    };
  }

  const created = await createPostPage(config.notionToken, config.notionDatabaseId, post, database.properties);
  return {
    status: "saved",
    notionPageId: created.id
  };
}

async function getDatabaseDefinition(notionToken, databaseId, forceRefresh) {
  const cacheKey = `${databaseId}:${notionToken.slice(-8)}`;
  const cached = databaseCache.get(cacheKey);
  const now = Date.now();

  if (!forceRefresh && cached && now - cached.timestamp < SCHEMA_CACHE_TTL_MS) {
    return cached.value;
  }

  const database = await notionFetch(`/databases/${databaseId}`, { method: "GET" }, notionToken);
  databaseCache.set(cacheKey, {
    timestamp: now,
    value: database
  });
  return database;
}

function getDatabaseTitle(database) {
  if (!Array.isArray(database?.title)) {
    return "";
  }
  return database.title.map((part) => part?.plain_text || "").join("").trim();
}

function buildSchemaGuidance(schemaCheck) {
  const requiredMissing = schemaCheck.missingRequired.join(", ");
  const requiredMismatch = schemaCheck.mismatchedRequired
    .map((item) => `${item.name} (${item.actual} -> ${item.expected})`)
    .join(", ");

  if (requiredMissing && requiredMismatch) {
    return `Notion schema invalid. Missing: ${requiredMissing}. Type fixes: ${requiredMismatch}.`;
  }
  if (requiredMissing) {
    return `Notion schema invalid. Missing required properties: ${requiredMissing}.`;
  }
  if (requiredMismatch) {
    return `Notion schema invalid. Fix property types: ${requiredMismatch}.`;
  }
  return "Notion schema invalid. Please verify required property names and types.";
}

async function findExistingByPostUrl(notionToken, databaseId, postUrl) {
  const response = await notionFetch(
    `/databases/${databaseId}/query`,
    {
      method: "POST",
      body: {
        filter: {
          property: "Post URL",
          url: {
            equals: postUrl
          }
        },
        page_size: 1
      }
    },
    notionToken
  );

  if (!Array.isArray(response.results) || response.results.length === 0) {
    return null;
  }

  return response.results[0];
}

async function createPostPage(notionToken, databaseId, post, databaseProperties) {
  const properties = {};

  if (databaseProperties.Title?.type === "title") {
    properties.Title = {
      title: [
        {
          text: {
            content: CORE.buildMinimalTitle(post.postId)
          }
        }
      ]
    };
  }

  if (databaseProperties["Post URL"]?.type === "url") {
    properties["Post URL"] = { url: post.postUrl };
  }

  if (databaseProperties["Saved At"]?.type === "date") {
    properties["Saved At"] = {
      date: {
        start: post.savedAt
      }
    };
  }

  if (post.postedAt && databaseProperties["Posted At"]?.type === "date") {
    properties["Posted At"] = {
      date: {
        start: post.postedAt
      }
    };
  }

  return notionFetch(
    "/pages",
    {
      method: "POST",
      body: {
        parent: {
          database_id: databaseId
        },
        properties
      }
    },
    notionToken
  );
}

async function notionFetch(path, requestOptions, notionToken, attempt) {
  const retryCount = attempt || 0;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), NOTION_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${CORE.NOTION_API_BASE}${path}`, {
      method: requestOptions.method,
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": CORE.NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
      signal: abortController.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await safeReadJson(response);

  if (response.status === 429 && retryCount < MAX_NOTION_RETRIES) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfterHeader) ? retryAfterHeader * 1000 : 900;
    await delay(waitMs);
    return notionFetch(path, requestOptions, notionToken, retryCount + 1);
  }

  if (!response.ok) {
    throw {
      name: "NotionApiError",
      status: response.status,
      notionCode: payload?.code || "",
      message: payload?.message || "Notion request failed."
    };
  }

  return payload || {};
}

async function safeReadJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function normalizeError(error) {
  if (error?.name === "AbortError") {
    return {
      status: "error",
      code: "REQUEST_TIMEOUT",
      message: "Request timed out. Please try again."
    };
  }

  if (error?.name === "NotionApiError") {
    if (error.status === 400) {
      return {
        status: "error",
        code: "NOTION_BAD_REQUEST",
        message: error.message || "Notion rejected this request. Check database schema."
      };
    }
    if (error.status === 401) {
      return {
        status: "error",
        code: "NOTION_UNAUTHORIZED",
        message: "Notion token is invalid."
      };
    }
    if (error.status === 403) {
      return {
        status: "error",
        code: "NOTION_FORBIDDEN",
        message: "Share the database with your Notion integration first."
      };
    }
    if (error.status === 404) {
      return {
        status: "error",
        code: "NOTION_NOT_FOUND",
        message: "Notion database not found. Check the database ID."
      };
    }
    if (error.status === 429) {
      return {
        status: "error",
        code: "NOTION_RATE_LIMITED",
        message: "Notion rate limit reached. Please retry in a moment."
      };
    }
    return {
      status: "error",
      code: "NOTION_API_ERROR",
      message: error.message || "Notion API request failed."
    };
  }

  if (error instanceof TypeError) {
    return {
      status: "error",
      code: "NETWORK_ERROR",
      message: "Network error while contacting Notion."
    };
  }

  if (error && typeof error === "object" && error.status && error.code && error.message) {
    return error;
  }

  return {
    status: "error",
    code: "UNEXPECTED",
    message: error instanceof Error ? error.message : "Unexpected error."
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
