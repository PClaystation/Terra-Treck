const GRID_SIZE = 20;
const STORAGE_KEY = "terraTreckState";
const POLL_INTERVAL_MS = 30000;
const DEFAULT_STEPS = 1000;
const REQUEST_TIMEOUT_MS = 10000;
const AUTH_USER_STORAGE_KEY = "terraTreckAuthUser";
const AUTH_API_BASE_STORAGE_KEY = "continental.authApiBaseUrl";
const GAME_API_BASE_STORAGE_KEY = "terraTreck.gameApiBaseUrl";
const APP_CONTEXT = Object.freeze(window.__TERRA_TREAD_CONTEXT__ || {});
const LOGIN_POPUP_FALLBACK_URL =
  window.__LOGIN_POPUP_URL__ ||
  APP_CONTEXT.loginPopupUrl ||
  "https://login.continental-hub.com/popup.html";
const AUTH_API_FALLBACK_URL =
  window.__API_BASE_URL__ || APP_CONTEXT.authApiBaseUrl || "https://auth.continental-hub.com";
const GAME_API_FALLBACK_URL =
  window.__GAME_API_BASE_URL__ || APP_CONTEXT.gameApiBaseUrl || "";
const TRUSTED_API_ORIGINS = new Set([
  "https://dashboard.continental-hub.com",
  "https://grimoire.continental-hub.com",
  "https://login.continental-hub.com",
  "https://continental-hub.com",
  "https://api.continental-hub.com",
  "https://auth.continental-hub.com",
  "https://id.continental-hub.com",
  "https://backend.continental-hub.com",
  "https://mpmc.ddns.net",
  "https://mpmc.ddns.net:3000",
]);
const TRUSTED_LOGIN_ORIGINS = new Set([
  "https://login.continental-hub.com",
  "https://dashboard.continental-hub.com",
]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const IS_IOS_APP = String(APP_CONTEXT.platform || "").trim().toLowerCase() === "ios-app";
const IOS_WEB_AUTH_ENABLED = IS_IOS_APP && APP_CONTEXT.allowsWebAuth === true;
const NATIVE_BRIDGE_HANDLER = "terraTread";

const BUILDINGS = {
  house: { width: 1, height: 1, cost: 100 },
  shop: { width: 2, height: 1, cost: 200 },
  park: { width: 2, height: 2, cost: 150 },
};

const TREE_IMAGES = [
  "./images/Tree1-removebg-preview.png",
  "./images/Tree2-removebg-preview.png",
  "./images/Tree3-removebg-preview.png",
];

const grid = document.getElementById("grid");
const stepCount = document.getElementById("step-count");
const buildToggle = document.getElementById("build-toggle");
const buildingOptions = document.getElementById("building-options");
const resetButton = document.getElementById("reset-button");
const confirmButtons = document.getElementById("confirm-buttons");
const confirmBuildBtn = document.getElementById("confirm-build");
const cancelBuildBtn = document.getElementById("cancel-build");
const authButton = document.getElementById("auth-button");
const playerStatus = document.getElementById("player-status");
const connectionStatus = document.getElementById("connection-status");

let selectedBuilding = null;
let buildMode = false;
let previewLocked = false;
let pendingTiles = [];
let lockedPreviewTiles = [];
let syncTimerId = null;
let syncInFlight = false;
let authBusy = false;
let authReady = false;
let accessToken = "";
let currentUser = null;
let loginPopupWindow = null;
let loginPopupUrl = LOGIN_POPUP_FALLBACK_URL;
let authApiBaseUrl = "";
let gameApiBaseUrl = "";
let authApiValidated = false;
let gameApiValidated = false;
let authApiResolutionPromise = null;
let gameApiResolutionPromise = null;

const state = loadState();

initializeGrid();
attachEventHandlers();
renderAll();
registerTestingHooks();

if (IS_IOS_APP) {
  initializeEmbeddedApp();
}

if (!IS_IOS_APP || IOS_WEB_AUTH_ENABLED) {
  initializeAuthState();
  syncSessionUI();
  void restoreAuthSession();
} else {
  syncSessionUI();
}

function attachEventHandlers() {
  buildToggle.addEventListener("click", toggleBuildMode);
  resetButton.addEventListener("click", resetCity);
  authButton.addEventListener("click", handleAuthButtonClick);

  document.querySelectorAll(".building-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (!buildMode) {
        return;
      }

      clearSelectedButtons();
      button.classList.add("selected");
      selectedBuilding = button.dataset.name;
      hideConfirmButtons();
    });
  });

  confirmBuildBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    confirmPlacement();
  });

  cancelBuildBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    cancelPlacement();
  });
}

function loadState() {
  const savedState = localStorage.getItem(STORAGE_KEY);
  const legacySteps = parseInt(localStorage.getItem("stepTotal") || "", 10);
  const legacyTimestamp = localStorage.getItem("lastStepTimestamp");

  const fallbackState = {
    availableSteps: Number.isFinite(legacySteps) ? legacySteps : DEFAULT_STEPS,
    lastStepTimestamp: legacyTimestamp || null,
    lastNativeStepDate: null,
    lastNativeStepTotal: 0,
    lastUploadedNativeUserId: null,
    lastUploadedNativeDayKey: null,
    lastUploadedNativeStepTotal: 0,
    buildings: [],
    trees: createInitialTrees(),
  };

  if (!savedState) {
    persistState(fallbackState);
    return fallbackState;
  }

  try {
    const parsed = JSON.parse(savedState);
    return {
      availableSteps: Number.isFinite(parsed.availableSteps)
        ? parsed.availableSteps
        : fallbackState.availableSteps,
      lastStepTimestamp:
        typeof parsed.lastStepTimestamp === "string" ? parsed.lastStepTimestamp : null,
      lastNativeStepDate:
        typeof parsed.lastNativeStepDate === "string" ? parsed.lastNativeStepDate : null,
      lastNativeStepTotal: Number.isFinite(parsed.lastNativeStepTotal)
        ? parsed.lastNativeStepTotal
        : 0,
      lastUploadedNativeUserId:
        typeof parsed.lastUploadedNativeUserId === "string"
          ? parsed.lastUploadedNativeUserId
          : null,
      lastUploadedNativeDayKey:
        typeof parsed.lastUploadedNativeDayKey === "string"
          ? parsed.lastUploadedNativeDayKey
          : null,
      lastUploadedNativeStepTotal: Number.isFinite(parsed.lastUploadedNativeStepTotal)
        ? parsed.lastUploadedNativeStepTotal
        : 0,
      buildings: Array.isArray(parsed.buildings) ? parsed.buildings : [],
      trees: Array.isArray(parsed.trees) && parsed.trees.length ? parsed.trees : fallbackState.trees,
    };
  } catch (error) {
    console.error("Failed to parse saved state:", error);
    persistState(fallbackState);
    return fallbackState;
  }
}

function persistState(nextState = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  localStorage.setItem("stepTotal", String(nextState.availableSteps));

  if (nextState.lastStepTimestamp) {
    localStorage.setItem("lastStepTimestamp", nextState.lastStepTimestamp);
  } else {
    localStorage.removeItem("lastStepTimestamp");
  }
}

function safeText(value) {
  return String(value || "").trim();
}

function trimTrailingSlash(value) {
  return safeText(value).replace(/\/+$/, "");
}

function readStoredAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeUserPayload(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to restore cached Continental ID user:", error);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
}

function writeStoredAuthUser(user) {
  if (!user) {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

function readStoredAuthApiBaseUrl() {
  try {
    return resolveTrustedApiBaseUrl(localStorage.getItem(AUTH_API_BASE_STORAGE_KEY));
  } catch {
    return "";
  }
}

function rememberAuthApiBaseUrl(value) {
  try {
    if (value) {
      localStorage.setItem(AUTH_API_BASE_STORAGE_KEY, trimTrailingSlash(value));
    }
  } catch {
    // Ignore storage issues in restricted browser contexts.
  }
}

function readStoredGameApiBaseUrl() {
  try {
    return resolveTrustedApiBaseUrl(localStorage.getItem(GAME_API_BASE_STORAGE_KEY));
  } catch {
    return "";
  }
}

function rememberGameApiBaseUrl(value) {
  try {
    if (value) {
      localStorage.setItem(GAME_API_BASE_STORAGE_KEY, trimTrailingSlash(value));
    }
  } catch {
    // Ignore storage issues in restricted browser contexts.
  }
}

function normalizeUserPayload(source = {}) {
  return {
    userId: safeText(source.userId || source.continentalId),
    continentalId: safeText(source.continentalId || source.userId),
    username: safeText(source.username),
    displayName: safeText(source.displayName),
    email: safeText(source.email),
  };
}

function initializeAuthState() {
  clearLegacyPlaceholderSession();
  applyIncomingAuthParams();
  currentUser = readStoredAuthUser();
  authApiBaseUrl = getAuthApiBaseCandidates()[0] || "";
  gameApiBaseUrl = getGameApiBaseCandidates()[0] || "";
  window.addEventListener("message", handleLoginMessage);
}

function initializeEmbeddedApp() {
  document.body.dataset.platform = "ios-app";
  document.body.dataset.authMode = IOS_WEB_AUTH_ENABLED ? "web" : "native-only";
  authReady = !IOS_WEB_AUTH_ENABLED;
  authBusy = false;
  stopStepSync();
  clearLegacyPlaceholderSession();
  window.addEventListener("terra-tread-native", (event) => {
    handleNativeBridgeMessage(event.detail || {});
  });
  syncSessionUI();
  requestNativeSteps();
  setConnectionStatus(IOS_WEB_AUTH_ENABLED ? "Hosted app mode" : "Bundled app mode", "online");
}

function clearLegacyPlaceholderSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
}

function applyIncomingAuthParams() {
  const params = new URLSearchParams(window.location.search);
  const incomingAuthApiBaseUrl = resolveTrustedApiBaseUrl(params.get("apiBaseUrl"));
  const incomingGameApiBaseUrl = resolveTrustedApiBaseUrl(params.get("gameApiBaseUrl"));

  if (incomingAuthApiBaseUrl) {
    rememberAuthApiBaseUrl(incomingAuthApiBaseUrl);
    params.delete("apiBaseUrl");
  }

  if (incomingGameApiBaseUrl) {
    rememberGameApiBaseUrl(incomingGameApiBaseUrl);
    params.delete("gameApiBaseUrl");
  }

  if (incomingAuthApiBaseUrl || incomingGameApiBaseUrl) {
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }
}

function cacheCurrentUser(user) {
  currentUser = user ? normalizeUserPayload(user) : null;
  writeStoredAuthUser(currentUser);
}

function clearAuthState() {
  accessToken = "";
  cacheCurrentUser(null);
  authBusy = false;
  stopStepSync();
  syncSessionUI();
}

function setConnectionStatus(text, tone = "muted") {
  if (!connectionStatus) {
    return;
  }

  connectionStatus.textContent = text;
  connectionStatus.dataset.tone = tone;
}

function postMessageToNative(type, payload = {}) {
  if (!IS_IOS_APP) {
    return false;
  }

  try {
    const handler = window.webkit?.messageHandlers?.[NATIVE_BRIDGE_HANDLER];
    if (!handler) {
      return false;
    }

    handler.postMessage({ type, ...payload });
    return true;
  } catch (error) {
    console.warn("Failed to post message to the iOS bridge:", error);
    return false;
  }
}

function requestNativeSteps() {
  postMessageToNative("ready");
  postMessageToNative("requestSteps");
}

function applyNativeStepSync(payload = {}) {
  const normalizedSteps = Math.max(0, Math.floor(Number(payload.todaySteps) || 0));
  const dayKey = safeText(payload.dayKey) || new Date().toISOString().slice(0, 10);
  const lastDayKey = safeText(state.lastNativeStepDate);
  const lastTotal = Number.isFinite(state.lastNativeStepTotal) ? state.lastNativeStepTotal : 0;

  if (lastDayKey !== dayKey) {
    state.availableSteps += normalizedSteps;
  } else if (normalizedSteps > lastTotal) {
    state.availableSteps += normalizedSteps - lastTotal;
  }

  state.lastNativeStepDate = dayKey;
  state.lastNativeStepTotal = normalizedSteps;
  persistState();
  updateStepCount();
  syncSessionUI();
  void syncPendingNativeSteps();
}

function handleNativeBridgeMessage(payload = {}) {
  if (safeText(payload.type) !== "stepSync") {
    return;
  }

  applyNativeStepSync(payload);
}

function isTrustedApiOrigin(origin) {
  if (!origin) {
    return false;
  }

  try {
    const parsed = new URL(origin);
    return LOCAL_HOSTS.has(parsed.hostname) || TRUSTED_API_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function resolveTrustedApiBaseUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const resolved = new URL(value, window.location.origin);
    return isTrustedApiOrigin(resolved.origin) ? trimTrailingSlash(resolved.origin) : "";
  } catch {
    return "";
  }
}

function getAuthApiBaseCandidates() {
  const rawCandidates = [
    authApiBaseUrl,
    window.__API_BASE_URL__,
    APP_CONTEXT.authApiBaseUrl,
    readStoredAuthApiBaseUrl(),
    AUTH_API_FALLBACK_URL,
  ];

  if (LOCAL_HOSTS.has(window.location.hostname)) {
    rawCandidates.push("http://localhost:3000", "http://localhost:5000", "https://auth.continental-hub.com");
  } else {
    rawCandidates.push(
      "https://auth.continental-hub.com",
      "https://api.continental-hub.com",
      "https://id.continental-hub.com",
      "https://backend.continental-hub.com",
      "https://continental-hub.com"
    );
  }

  return dedupeTrustedApiBaseUrls(rawCandidates);
}

function getGameApiBaseCandidates() {
  const rawCandidates = [
    gameApiBaseUrl,
    window.__GAME_API_BASE_URL__,
    APP_CONTEXT.gameApiBaseUrl,
    readStoredGameApiBaseUrl(),
    GAME_API_FALLBACK_URL,
  ];

  if (/^https?:$/.test(window.location.protocol)) {
    rawCandidates.push(window.location.origin);
  }

  if (LOCAL_HOSTS.has(window.location.hostname)) {
    rawCandidates.push("http://localhost:3000", "https://mpmc.ddns.net:3000");
  } else {
    rawCandidates.push(
      "https://mpmc.ddns.net:3000",
      "https://mpmc.ddns.net",
      "https://backend.continental-hub.com"
    );
  }

  return dedupeTrustedApiBaseUrls(rawCandidates);
}

function dedupeTrustedApiBaseUrls(candidates) {
  const uniqueCandidates = [];
  candidates.forEach((candidate) => {
    const resolved = resolveTrustedApiBaseUrl(candidate);
    if (resolved && !uniqueCandidates.includes(resolved)) {
      uniqueCandidates.push(resolved);
    }
  });

  return uniqueCandidates;
}

function getAuthApiBase() {
  return `${authApiBaseUrl}/api/auth`;
}

function getGameApiBase() {
  return `${gameApiBaseUrl}/api/game`;
}

function looksLikeAuthHealthPayload(payload) {
  const status = safeText(payload?.status).toLowerCase();
  const timestamp = safeText(payload?.timestamp);
  if (!timestamp || !["ok", "degraded"].includes(status)) {
    return false;
  }

  const service = safeText(payload?.service).toLowerCase();
  return !service || service.includes("auth") || service.includes("continental") || service.includes("id");
}

function looksLikeGameHealthPayload(payload) {
  const status = safeText(payload?.status).toLowerCase();
  const timestamp = safeText(payload?.timestamp);
  if (!timestamp || !["ok", "degraded"].includes(status)) {
    return false;
  }

  const service = safeText(payload?.service).toLowerCase();
  return service.includes("terra") || service.includes("game") || service.includes("backend");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function probeAuthApiBaseUrl(candidate) {
  try {
    const response = await fetchWithTimeout(`${candidate}/api/health`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    return looksLikeAuthHealthPayload(payload);
  } catch {
    return false;
  }
}

async function probeGameApiBaseUrl(candidate) {
  try {
    const response = await fetchWithTimeout(`${candidate}/api/health`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    return looksLikeGameHealthPayload(payload);
  } catch {
    return false;
  }
}

function applyClientConfig(config = {}, fallbackGameApiBaseUrl = "") {
  const nextAuthApiBaseUrl = resolveTrustedApiBaseUrl(config.authApiBaseUrl);
  const nextGameApiBaseUrl = resolveTrustedApiBaseUrl(
    config.gameApiBaseUrl || fallbackGameApiBaseUrl
  );
  const nextLoginPopupUrl = safeText(config.loginPopupUrl);

  if (nextAuthApiBaseUrl) {
    authApiBaseUrl = nextAuthApiBaseUrl;
    authApiValidated = true;
    rememberAuthApiBaseUrl(nextAuthApiBaseUrl);
  }

  if (nextGameApiBaseUrl) {
    gameApiBaseUrl = nextGameApiBaseUrl;
    gameApiValidated = true;
    rememberGameApiBaseUrl(nextGameApiBaseUrl);
  }

  if (nextLoginPopupUrl) {
    loginPopupUrl = nextLoginPopupUrl;
  }
}

async function fetchClientConfig(candidate) {
  try {
    const response = await fetchWithTimeout(`${candidate}/api/client-config`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function ensureGameApiBaseUrl() {
  if (gameApiValidated && gameApiBaseUrl) {
    return gameApiBaseUrl;
  }

  if (gameApiResolutionPromise) {
    return gameApiResolutionPromise;
  }

  gameApiResolutionPromise = (async () => {
    const candidates = getGameApiBaseCandidates();
    for (const candidate of candidates) {
      const clientConfig = await fetchClientConfig(candidate);
      if (clientConfig) {
        applyClientConfig(clientConfig, candidate);
        setConnectionStatus("Backend connected", "online");
        return gameApiBaseUrl || candidate;
      }

      if (await probeGameApiBaseUrl(candidate)) {
        gameApiBaseUrl = candidate;
        gameApiValidated = true;
        rememberGameApiBaseUrl(candidate);
        setConnectionStatus("Backend connected", "online");
        return candidate;
      }
    }

    setConnectionStatus("Backend unavailable", "offline");
    throw new Error(
      candidates.length
        ? `No reachable Terra Tread backend was found. Checked: ${candidates.join(", ")}.`
        : "No trusted Terra Tread backend was configured."
    );
  })();

  try {
    return await gameApiResolutionPromise;
  } catch (error) {
    gameApiResolutionPromise = null;
    throw error;
  }
}

function isTrustedLoginOrigin(origin) {
  if (!origin) {
    return false;
  }

  try {
    const parsed = new URL(origin);
    if (parsed.origin === window.location.origin) {
      return true;
    }

    if (LOCAL_HOSTS.has(window.location.hostname) && LOCAL_HOSTS.has(parsed.hostname)) {
      return true;
    }

    return TRUSTED_LOGIN_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function getLoginPopupApiBaseUrl() {
  return trimTrailingSlash(
    authApiBaseUrl ||
      window.__API_BASE_URL__ ||
      APP_CONTEXT.authApiBaseUrl ||
      readStoredAuthApiBaseUrl() ||
      AUTH_API_FALLBACK_URL
  );
}

function buildLoginPopupUrl() {
  const popupUrl = new URL(loginPopupUrl || LOGIN_POPUP_FALLBACK_URL, window.location.href);
  popupUrl.searchParams.set("origin", window.location.origin);
  popupUrl.searchParams.set("redirect", window.location.href);

  const apiBaseUrl = resolveTrustedApiBaseUrl(getLoginPopupApiBaseUrl());
  if (apiBaseUrl) {
    popupUrl.searchParams.set("apiBaseUrl", apiBaseUrl);
  }

  const gameBaseUrl = resolveTrustedApiBaseUrl(gameApiBaseUrl || readStoredGameApiBaseUrl());
  if (gameBaseUrl) {
    popupUrl.searchParams.set("gameApiBaseUrl", gameBaseUrl);
  }

  return popupUrl;
}

function openLoginPopup() {
  const width = 860;
  const height = 780;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popupUrl = buildLoginPopupUrl().toString();

  if (loginPopupWindow && !loginPopupWindow.closed) {
    try {
      loginPopupWindow.location.href = popupUrl;
    } catch {
      // Ignore cross-origin navigation access errors.
    }
    loginPopupWindow.focus();
    return loginPopupWindow;
  }

  loginPopupWindow = window.open(
    popupUrl,
    "TerraTreckLogin",
    [
      "popup=yes",
      `width=${width}`,
      `height=${height}`,
      `top=${Math.max(top, 0)}`,
      `left=${Math.max(left, 0)}`,
      "resizable=yes",
      "scrollbars=yes",
    ].join(",")
  );

  return loginPopupWindow;
}

function closeLoginPopup() {
  if (loginPopupWindow && !loginPopupWindow.closed) {
    loginPopupWindow.close();
  }

  loginPopupWindow = null;
}

async function requestAuth(path, { method = "GET", body, includeAuth = true } = {}) {
  await ensureAuthApiBaseUrl();

  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (includeAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetchWithTimeout(`${getAuthApiBase()}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function ensureAuthApiBaseUrl() {
  if (authApiValidated && authApiBaseUrl) {
    return authApiBaseUrl;
  }

  if (authApiResolutionPromise) {
    return authApiResolutionPromise;
  }

  authApiResolutionPromise = (async () => {
    try {
      await ensureGameApiBaseUrl();
    } catch {
      // Auth can still resolve independently when the game backend is unavailable.
    }

    const candidates = getAuthApiBaseCandidates();
    for (const candidate of candidates) {
      if (await probeAuthApiBaseUrl(candidate)) {
        authApiBaseUrl = candidate;
        authApiValidated = true;
        rememberAuthApiBaseUrl(candidate);
        return candidate;
      }
    }

    throw new Error(
      candidates.length
        ? `No reachable Continental ID auth API was found. Checked: ${candidates.join(", ")}.`
        : "No trusted Continental ID auth API was configured."
    );
  })();

  try {
    return await authApiResolutionPromise;
  } catch (error) {
    authApiResolutionPromise = null;
    throw error;
  }
}

async function refreshSession() {
  try {
    const response = await requestAuth("/refresh_token", {
      method: "POST",
      includeAuth: false,
    });
    const payload = await parseResponseBody(response);

    if (!response.ok || payload.authenticated === false) {
      return {
        ok: false,
        message: safeText(payload.message) || `HTTP ${response.status}`,
      };
    }

    const token = safeText(payload.accessToken || payload.token);
    if (!token) {
      return {
        ok: false,
        message: safeText(payload.message) || "The session refresh did not return an access token.",
      };
    }

    accessToken = token;
    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error?.message) || "Could not reach Continental ID.",
    };
  }
}

async function loadCurrentUser() {
  const response = await requestAuth("/me");
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(safeText(payload.message) || `HTTP ${response.status}`);
  }

  const user = normalizeUserPayload(payload.user || payload);
  if (!user.userId) {
    throw new Error("Continental ID did not return a usable player identifier.");
  }

  cacheCurrentUser(user);
  clearLegacyPlaceholderSession();
  return user;
}

async function establishAuthenticatedUser({ accessTokenHint = "" } = {}) {
  if (accessTokenHint) {
    accessToken = safeText(accessTokenHint);
  }

  const refreshed = await refreshSession();
  if (!refreshed.ok && !accessToken) {
    throw new Error(refreshed.message || "Could not establish a Continental ID session.");
  }

  try {
    await loadCurrentUser();
  } catch (error) {
    if (!refreshed.ok) {
      throw error;
    }
    throw error;
  }
}

function describeCurrentUser() {
  const user = currentUser;
  if (!user) {
    return "";
  }

  if (user.displayName) {
    return user.username ? `${user.displayName} (@${user.username})` : user.displayName;
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return user.email || user.userId;
}

async function restoreAuthSession() {
  authBusy = true;
  syncSessionUI();

  try {
    const refreshed = await refreshSession();
    if (!refreshed.ok) {
      clearAuthState();
      return;
    }

    await loadCurrentUser();
    startStepSync();
    void syncPendingNativeSteps();
  } catch (error) {
    console.error("Failed to restore Continental ID session:", error);
    clearAuthState();
  } finally {
    authReady = true;
    authBusy = false;
    syncSessionUI();
  }
}

async function handleLoginMessage(event) {
  if (!isTrustedLoginOrigin(event.origin)) {
    return;
  }

  if (safeText(event.data?.type) !== "LOGIN_SUCCESS") {
    return;
  }

  authBusy = true;
  syncSessionUI();

  try {
    await establishAuthenticatedUser({
      accessTokenHint: safeText(event.data?.accessToken || event.data?.token),
    });
    closeLoginPopup();
    startStepSync();
    void syncPendingNativeSteps();
  } catch (error) {
    console.error("Continental ID sign-in completed, but Terra-Treck could not restore the session:", error);
    clearAuthState();
  } finally {
    authReady = true;
    authBusy = false;
    syncSessionUI();
  }
}

function createInitialTrees() {
  const trees = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (Math.random() < 0.1) {
        trees.push({
          row,
          col,
          imageIndex: Math.floor(Math.random() * TREE_IMAGES.length),
        });
      }
    }
  }

  return trees;
}

function initializeGrid() {
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = String(row);
      tile.dataset.col = String(col);
      tile.style.backgroundColor = createTileColor(row, col);

      tile.addEventListener("mouseenter", () => updateHoverPreview(tile));
      tile.addEventListener("mouseleave", clearHoverPreview);
      tile.addEventListener("click", () => selectPlacement(tile));

      fragment.appendChild(tile);
    }
  }

  grid.appendChild(fragment);
}

function createTileColor(row, col) {
  const variance = ((row * 17 + col * 11) % 9) - 4;
  const lightness = 46 + variance;
  return `hsl(122, 39%, ${lightness}%)`;
}

function renderAll() {
  clearGridDecorations();
  renderTrees();
  renderBuildings();
  updateStepCount();
  updateBuildModeVisuals();
}

function clearGridDecorations() {
  Array.from(grid.children).forEach((tile) => {
    tile.classList.remove("house", "shop", "park", "hovering", "pending");
    tile.dataset.building = "";

    const tree = tile.querySelector("img");
    if (tree) {
      tree.remove();
    }
  });
}

function renderTrees() {
  state.trees.forEach((tree) => {
    const tile = getTileAt(tree.row, tree.col);
    if (!tile || tile.dataset.building) {
      return;
    }

    const treeImg = document.createElement("img");
    treeImg.src = TREE_IMAGES[tree.imageIndex] || TREE_IMAGES[0];
    treeImg.alt = "";
    treeImg.className = "tree";
    treeImg.style.pointerEvents = "none";
    tile.appendChild(treeImg);
  });
}

function renderBuildings() {
  state.buildings.forEach((building) => {
    const tiles = getTilesForPlacement(getTileAt(building.row, building.col), building.type);
    if (!tiles) {
      return;
    }

    tiles.forEach((tile) => {
      const tree = tile.querySelector("img");
      if (tree) {
        tree.remove();
      }

      tile.classList.add(building.type);
      tile.dataset.building = building.type;
    });
  });
}

function updateStepCount() {
  stepCount.textContent = String(state.availableSteps);
}

function toggleBuildMode() {
  if (buildMode) {
    exitBuildMode();
  } else {
    enterBuildMode();
  }
}

function enterBuildMode() {
  buildMode = true;
  selectedBuilding = null;
  clearSelectedButtons();
  updateBuildModeVisuals();
  hideConfirmButtons();
}

function exitBuildMode() {
  buildMode = false;
  selectedBuilding = null;
  previewLocked = false;
  lockedPreviewTiles = [];
  clearSelectedButtons();
  clearHoverPreview();
  hideConfirmButtons();
  updateBuildModeVisuals();
}

function updateBuildModeVisuals() {
  buildToggle.classList.toggle("build-mode-active", buildMode);
  buildingOptions.classList.toggle("hidden", !buildMode);

  Array.from(grid.children).forEach((tile) => {
    tile.classList.toggle("build-mode", buildMode);
  });
}

function clearSelectedButtons() {
  document.querySelectorAll(".building-btn").forEach((button) => {
    button.classList.remove("selected");
  });
}

function updateHoverPreview(tile) {
  if (!buildMode || !selectedBuilding || previewLocked) {
    return;
  }

  clearHoverPreview();

  const tiles = getTilesForPlacement(tile, selectedBuilding);
  if (!tiles) {
    return;
  }

  tiles.forEach((currentTile) => {
    currentTile.classList.add("hovering");
  });
}

function clearHoverPreview() {
  document.querySelectorAll(".tile.hovering").forEach((tile) => {
    tile.classList.remove("hovering");
  });
}

function selectPlacement(tile) {
  if (!buildMode || !selectedBuilding || previewLocked) {
    return;
  }

  const tiles = getTilesForPlacement(tile, selectedBuilding);
  if (!tiles) {
    window.alert("Building is out of bounds.");
    return;
  }

  if (tiles.some((currentTile) => currentTile.dataset.building)) {
    window.alert("Some tiles are already occupied.");
    return;
  }

  const buildingCost = BUILDINGS[selectedBuilding].cost;
  if (state.availableSteps < buildingCost) {
    window.alert("Not enough steps to build.");
    return;
  }

  previewLocked = true;
  lockedPreviewTiles = tiles;
  clearHoverPreview();
  pendingTiles = tiles;
  tiles.forEach((currentTile) => currentTile.classList.add("hovering"));
  positionConfirmButtons(tile);
}

function confirmPlacement() {
  if (!previewLocked || !selectedBuilding || !pendingTiles.length) {
    return;
  }

  const baseTile = pendingTiles[0];
  const row = Number(baseTile.dataset.row);
  const col = Number(baseTile.dataset.col);

  pendingTiles.forEach((tile) => {
    removeTreeAt(Number(tile.dataset.row), Number(tile.dataset.col));
    tile.classList.add(selectedBuilding);
    tile.dataset.building = selectedBuilding;
    const tree = tile.querySelector("img");
    if (tree) {
      tree.remove();
    }
  });

  state.buildings.push({ type: selectedBuilding, row, col });
  state.availableSteps -= BUILDINGS[selectedBuilding].cost;
  persistState();
  updateStepCount();

  previewLocked = false;
  lockedPreviewTiles = [];
  pendingTiles = [];
  hideConfirmButtons();
}

function cancelPlacement() {
  if (!previewLocked) {
    return;
  }

  previewLocked = false;
  lockedPreviewTiles = [];
  pendingTiles = [];
  clearHoverPreview();
  hideConfirmButtons();
}

function hideConfirmButtons() {
  confirmButtons.classList.remove("active");
  window.setTimeout(() => {
    confirmButtons.classList.add("hidden");
    confirmButtons.style.left = "";
    confirmButtons.style.top = "";
  }, 300);
}

function positionConfirmButtons(baseTile) {
  if (!pendingTiles.length) {
    return;
  }

  const tileRect = baseTile.getBoundingClientRect();
  const centerX = tileRect.left + tileRect.width / 2;
  const centerY = tileRect.top + tileRect.height / 2;

  confirmButtons.classList.remove("hidden");
  confirmButtons.style.left = `${centerX - 40}px`;
  confirmButtons.style.top = `${centerY - 10}px`;

  window.setTimeout(() => {
    confirmButtons.classList.add("active");
  }, 10);
}

function resetCity() {
  if (!window.confirm("Are you sure you want to reset your city?")) {
    return;
  }

  const refundedSteps = state.buildings.reduce((total, building) => {
    const buildingDefinition = BUILDINGS[building.type];
    return total + (buildingDefinition ? buildingDefinition.cost : 0);
  }, 0);

  state.availableSteps += refundedSteps;
  state.buildings = [];
  state.trees = createInitialTrees();
  persistState();
  exitBuildMode();
  renderAll();
}

function getTileAt(row, col) {
  if (row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) {
    return null;
  }

  return grid.children[row * GRID_SIZE + col] || null;
}

function getTilesForPlacement(baseTile, buildingType) {
  if (!baseTile || !BUILDINGS[buildingType]) {
    return null;
  }

  const startRow = Number(baseTile.dataset.row);
  const startCol = Number(baseTile.dataset.col);
  const { width, height } = BUILDINGS[buildingType];
  const tiles = [];

  for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
    for (let colOffset = 0; colOffset < width; colOffset += 1) {
      const tile = getTileAt(startRow + rowOffset, startCol + colOffset);
      if (!tile) {
        return null;
      }

      tiles.push(tile);
    }
  }

  return tiles;
}

function removeTreeAt(row, col) {
  state.trees = state.trees.filter((tree) => !(tree.row === row && tree.col === col));
}

function getSession() {
  return {
    token: accessToken,
    userId: safeText(currentUser?.userId || currentUser?.continentalId),
  };
}

function getNativeSyncSummary() {
  const nativeSteps = Number.isFinite(state.lastNativeStepTotal) ? state.lastNativeStepTotal : 0;
  return state.lastNativeStepDate
    ? `HealthKit synced: ${nativeSteps} steps today`
    : "Waiting for HealthKit";
}

function getPendingNativeSyncPayload() {
  if (!IS_IOS_APP || !IOS_WEB_AUTH_ENABLED) {
    return null;
  }

  const { userId } = getSession();
  const dayKey = safeText(state.lastNativeStepDate);
  const totalSteps = Number.isFinite(state.lastNativeStepTotal) ? state.lastNativeStepTotal : 0;

  if (!userId || !dayKey || totalSteps <= 0) {
    return null;
  }

  const sameUser = safeText(state.lastUploadedNativeUserId) === userId;
  const sameDay = safeText(state.lastUploadedNativeDayKey) === dayKey;
  const uploadedTotal =
    sameUser && sameDay && Number.isFinite(state.lastUploadedNativeStepTotal)
      ? state.lastUploadedNativeStepTotal
      : 0;
  const pendingSteps = totalSteps - uploadedTotal;

  if (pendingSteps <= 0) {
    return null;
  }

  return {
    userId,
    dayKey,
    totalSteps,
    body: {
      userId,
      steps: pendingSteps,
      source: "ios-healthkit",
      syncKey: `ios-healthkit:${userId}:${dayKey}:${totalSteps}`,
      deviceDayKey: dayKey,
      metadata: {
        platform: "ios-app",
        totalSteps,
      },
    },
  };
}

async function syncPendingNativeSteps() {
  const pendingPayload = getPendingNativeSyncPayload();
  if (!pendingPayload) {
    return;
  }

  try {
    await ensureGameApiBaseUrl();
    const response = await fetchWithTimeout(`${getGameApiBase()}/steps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pendingPayload.body),
    });

    if (!response.ok) {
      const payload = await parseResponseBody(response);
      throw new Error(safeText(payload.message || payload.error) || `HTTP ${response.status}`);
    }

    state.lastUploadedNativeUserId = pendingPayload.userId;
    state.lastUploadedNativeDayKey = pendingPayload.dayKey;
    state.lastUploadedNativeStepTotal = pendingPayload.totalSteps;
    persistState();
    setConnectionStatus("Backend connected", "online");
  } catch (error) {
    console.error("Failed to sync iOS HealthKit steps to the Terra Tread backend:", error);
    setConnectionStatus("Backend unavailable", "offline");
  }
}

function syncSessionUI() {
  if (IS_IOS_APP && !IOS_WEB_AUTH_ENABLED) {
    playerStatus.textContent = getNativeSyncSummary();
    authButton.hidden = true;
    authButton.disabled = true;
    return;
  }

  const { userId } = getSession();
  const nativeSummaryPrefix = IS_IOS_APP ? `${getNativeSyncSummary()} • ` : "";

  if (userId && !authReady) {
    const label = describeCurrentUser() || userId;
    playerStatus.textContent = `${nativeSummaryPrefix}Restoring Continental ID for ${label}...`;
    authButton.textContent = "Working...";
  } else if (userId) {
    const label = describeCurrentUser() || userId;
    playerStatus.textContent = authBusy
      ? `${nativeSummaryPrefix}Syncing Continental ID for ${label}...`
      : `${nativeSummaryPrefix}Continental ID: ${label}`;
    authButton.textContent = authBusy ? "Working..." : "Logout";
  } else {
    playerStatus.textContent =
      authBusy && !authReady
        ? `${nativeSummaryPrefix}Checking Continental ID...`
        : `${nativeSummaryPrefix}Guest mode`;
    authButton.textContent = authBusy ? "Opening..." : "Login";
  }

  authButton.hidden = false;
  authButton.disabled = authBusy || !authReady;
}

async function handleAuthButtonClick() {
  if (IS_IOS_APP && !IOS_WEB_AUTH_ENABLED) {
    requestNativeSteps();
    return;
  }

  const { userId } = getSession();

  if (userId) {
    authBusy = true;
    syncSessionUI();

    try {
      await requestAuth("/logout", {
        method: "POST",
        includeAuth: false,
      });
    } catch (error) {
      console.error("Continental ID logout failed:", error);
    } finally {
      clearAuthState();
      authReady = true;
      authBusy = false;
      syncSessionUI();
    }

    return;
  }

  authBusy = true;
  syncSessionUI();

  try {
    const popup = openLoginPopup();
    if (!popup) {
      window.location.assign(buildLoginPopupUrl().toString());
      return;
    }
  } finally {
    authBusy = false;
    syncSessionUI();
  }
}

async function fetchStepsFromServer() {
  const { userId } = getSession();

  if (!userId || syncInFlight) {
    return;
  }

  syncInFlight = true;

  try {
    await ensureGameApiBaseUrl();
    const response = await fetchWithTimeout(
      `${getGameApiBase()}/steps/${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    const entries = Array.isArray(payload) ? payload : payload?.entries;
    if (!Array.isArray(entries)) {
      throw new Error("Unexpected step payload");
    }

    const lastKnownTime = state.lastStepTimestamp
      ? new Date(state.lastStepTimestamp).getTime()
      : 0;

    let newestTimestamp = state.lastStepTimestamp;
    let newSteps = 0;

    entries
      .slice()
      .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp))
      .forEach((entry) => {
        const entryTime = new Date(entry.timestamp).getTime();
        const steps = Number(entry.steps);

        if (!Number.isFinite(entryTime) || !Number.isFinite(steps)) {
          return;
        }

        if (entryTime > lastKnownTime && entryTime > new Date(newestTimestamp || 0).getTime()) {
          newSteps += steps;
          newestTimestamp = entry.timestamp;
        }
      });

    if (newSteps > 0) {
      state.availableSteps += newSteps;
      state.lastStepTimestamp = newestTimestamp;
      persistState();
      updateStepCount();
    }
    setConnectionStatus("Backend connected", "online");
  } catch (error) {
    console.error("Error fetching steps:", error);
    setConnectionStatus("Backend unavailable", "offline");
  } finally {
    syncInFlight = false;
  }
}

function startStepSync() {
  stopStepSync();

  // The iOS container already applies native step deltas locally and uploads checkpoints
  // to the backend. Polling the shared step feed here would replay those same grants.
  if (IS_IOS_APP) {
    return;
  }

  const { userId } = getSession();

  if (!userId) {
    return;
  }

  fetchStepsFromServer();
  syncTimerId = window.setInterval(fetchStepsFromServer, POLL_INTERVAL_MS);
}

function stopStepSync() {
  if (syncTimerId) {
    window.clearInterval(syncTimerId);
    syncTimerId = null;
  }
}

function registerTestingHooks() {
  window.advanceTime = async (ms = 0) => {
    if (ms >= POLL_INTERVAL_MS) {
      await fetchStepsFromServer();
    }
  };

  window.render_game_to_text = () =>
    JSON.stringify({
      coordinateSystem: "row/col with origin at the top-left of the 20x20 grid",
      buildMode,
      selectedBuilding,
      availableSteps: state.availableSteps,
      playerStatus: playerStatus.textContent,
      buildings: state.buildings,
      treeCount: state.trees.length,
    });
}
