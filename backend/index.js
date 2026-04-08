const express = require("express");
const cors = require("cors");
const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const https = require("https");
const path = require("path");

const app = express();

const PORT = parseInt(process.env.PORT || "3000", 10);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = process.env.TERRA_TREAD_DATA_DIR
  ? path.resolve(process.env.TERRA_TREAD_DATA_DIR)
  : path.join(__dirname, "data");
const STEP_LOG_PATH = process.env.TERRA_TREAD_STEP_LOG_PATH
  ? path.resolve(process.env.TERRA_TREAD_STEP_LOG_PATH)
  : path.join(DATA_DIR, "steps.log");
const WEBSITE_BASE_URL = normalizeBaseUrl(process.env.TERRA_TREAD_WEBSITE_BASE_URL);
const AUTH_API_BASE_URL =
  normalizeBaseUrl(process.env.TERRA_TREAD_AUTH_API_BASE_URL) ||
  "https://auth.continental-hub.com";
const GAME_API_BASE_URL = normalizeBaseUrl(process.env.TERRA_TREAD_GAME_API_BASE_URL);
const LOGIN_POPUP_URL =
  normalizeBaseUrl(process.env.TERRA_TREAD_LOGIN_POPUP_URL) ||
  "https://login.continental-hub.com/popup.html";
let httpsCredentials = null;

app.set("trust proxy", true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  const requestOrigin = getRequestOrigin(req);
  res.json({
    status: "ok",
    service: "terra-tread-backend",
    timestamp: new Date().toISOString(),
    protocol: isHttpsEnabled() ? "https" : "http",
    authApiBaseUrl: AUTH_API_BASE_URL,
    gameApiBaseUrl: GAME_API_BASE_URL || requestOrigin,
    websiteBaseUrl: WEBSITE_BASE_URL || requestOrigin,
    loginPopupUrl: LOGIN_POPUP_URL,
  });
});

app.get("/api/client-config", (req, res) => {
  const requestOrigin = getRequestOrigin(req);
  res.json({
    authApiBaseUrl: AUTH_API_BASE_URL,
    gameApiBaseUrl: GAME_API_BASE_URL || requestOrigin,
    websiteBaseUrl: WEBSITE_BASE_URL || requestOrigin,
    loginPopupUrl: LOGIN_POPUP_URL,
  });
});

app.post("/api/game/steps", handleCreateStepEntry);

app.get("/api/game/steps/:userId", handleReadUserSteps);

// Legacy endpoints retained for older clients.
app.post("/steps", handleCreateStepEntry);

app.get("/steps/:userId", async (req, res) => {
  const result = await getUserStepPayload(req.params.userId);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.json(result.entries);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/login.html", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "login.html"));
});

app.get("/script.js", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "script.js"));
});

app.get("/style.css", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "style.css"));
});

app.use("/images", express.static(path.join(ROOT_DIR, "images")));

async function handleCreateStepEntry(req, res) {
  const validation = validateStepPayload(req.body || {});
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const entry = validation.entry;

  try {
    if (entry.syncKey) {
      const existingEntries = await readStepEntries();
      const duplicate = existingEntries.some(
        (existingEntry) =>
          existingEntry.userId === entry.userId && existingEntry.syncKey === entry.syncKey
      );

      if (duplicate) {
        return res.status(200).json({ success: true, duplicate: true, entry });
      }
    }

    await ensureDataDirectory();
    await fsp.appendFile(STEP_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
    return res.status(200).json({ success: true, entry });
  } catch (error) {
    console.error("Failed to persist step entry:", error);
    return res.status(500).json({ error: "Failed to save step data." });
  }
}

async function handleReadUserSteps(req, res) {
  const result = await getUserStepPayload(req.params.userId);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.json({
    userId: result.userId,
    entries: result.entries,
    summary: result.summary,
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function trimTrailingSlash(value) {
  return normalizeText(value).replace(/\/+$/, "");
}

function normalizeBaseUrl(value) {
  const text = trimTrailingSlash(value);
  if (!text) {
    return "";
  }

  try {
    return new URL(text).toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function getRequestOrigin(req) {
  if (WEBSITE_BASE_URL) {
    return WEBSITE_BASE_URL;
  }

  return `${req.protocol}://${req.get("host")}`;
}

function ensureInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : NaN;
}

function validateStepPayload(body) {
  const userId = normalizeText(body.userId);
  const steps = ensureInteger(body.steps);
  const source = normalizeText(body.source || "unknown");
  const syncKey = normalizeText(body.syncKey);
  const deviceDayKey = normalizeText(body.deviceDayKey);
  const timestamp = normalizeText(body.timestamp) || new Date().toISOString();
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : undefined;

  if (!userId) {
    return { ok: false, error: "Missing userId." };
  }

  if (!Number.isFinite(steps) || steps <= 0) {
    return { ok: false, error: "Steps must be a positive integer." };
  }

  const entry = {
    userId,
    steps,
    source,
    syncKey: syncKey || undefined,
    deviceDayKey: deviceDayKey || undefined,
    timestamp,
  };

  if (metadata) {
    entry.metadata = metadata;
  }

  return { ok: true, entry };
}

async function ensureDataDirectory() {
  await fsp.mkdir(path.dirname(STEP_LOG_PATH), { recursive: true });
}

async function readStepEntries() {
  try {
    const raw = await fsp.readFile(STEP_LOG_PATH, "utf8");
    if (!raw.trim()) {
      return [];
    }

    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.warn("Skipping malformed step log line:", error);
          return null;
        }
      })
      .filter((entry) => {
        const userId = normalizeText(entry?.userId);
        const steps = ensureInteger(entry?.steps);
        return Boolean(userId) && Number.isFinite(steps) && steps > 0;
      })
      .map((entry) => ({
        userId: normalizeText(entry.userId),
        steps: ensureInteger(entry.steps),
        source: normalizeText(entry.source || "unknown"),
        syncKey: normalizeText(entry.syncKey) || undefined,
        deviceDayKey: normalizeText(entry.deviceDayKey) || undefined,
        timestamp: normalizeText(entry.timestamp) || new Date(0).toISOString(),
        metadata:
          entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
            ? entry.metadata
            : undefined,
      }));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function getUserStepPayload(userIdValue) {
  const userId = normalizeText(userIdValue);
  if (!userId) {
    return { ok: false, status: 400, error: "Missing userId." };
  }

  try {
    const entries = (await readStepEntries())
      .filter((entry) => entry.userId === userId)
      .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));

    const totalSteps = entries.reduce((total, entry) => total + entry.steps, 0);
    const latestEntry = entries[entries.length - 1] || null;

    return {
      ok: true,
      userId,
      entries,
      summary: {
        totalSteps,
        entryCount: entries.length,
        latestTimestamp: latestEntry ? latestEntry.timestamp : null,
      },
    };
  } catch (error) {
    console.error("Failed to load step entries:", error);
    return { ok: false, status: 500, error: "Failed to read step data." };
  }
}

function loadHttpsCredentials() {
  const keyPath =
    process.env.SSL_KEY_PATH || "/etc/letsencrypt/live/mpmc.ddns.net/privkey.pem";
  const certPath =
    process.env.SSL_CERT_PATH || "/etc/letsencrypt/live/mpmc.ddns.net/fullchain.pem";

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return null;
  }

  return {
    key: fs.readFileSync(keyPath, "utf8"),
    cert: fs.readFileSync(certPath, "utf8"),
  };
}

function isHttpsEnabled() {
  return Boolean(httpsCredentials);
}

function createServer() {
  httpsCredentials = loadHttpsCredentials();
  if (httpsCredentials) {
    return https.createServer(httpsCredentials, app);
  }

  console.warn(
    "SSL certificates were not found. Starting the Terra Tread backend over HTTP only."
  );
  return http.createServer(app);
}

createServer().listen(PORT, () => {
  console.log(
    `${isHttpsEnabled() ? "HTTPS" : "HTTP"} Terra Tread backend running on port ${PORT}`
  );
});
