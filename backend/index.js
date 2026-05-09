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
const PROFILE_DIR = path.join(DATA_DIR, "profiles");
const WEBSITE_BASE_URL = normalizeBaseUrl(process.env.TERRA_TREAD_WEBSITE_BASE_URL);
const AUTH_API_BASE_URL =
  normalizeBaseUrl(process.env.TERRA_TREAD_AUTH_API_BASE_URL) ||
  "https://auth.continental-hub.com";
const GAME_API_BASE_URL = normalizeBaseUrl(process.env.TERRA_TREAD_GAME_API_BASE_URL);
const LOGIN_POPUP_URL =
  normalizeBaseUrl(process.env.TERRA_TREAD_LOGIN_POPUP_URL) ||
  "https://login.continental-hub.com/popup.html";

const GRID_SIZE = 20;
const TREE_VARIANT_COUNT = 3;
const CLOUD_STATE_SCHEMA_VERSION = 2;
const DAILY_STEP_GOAL = 4000;
const DAILY_GOAL_REWARD_STEPS = 150;
const STREAK_MILESTONE_INTERVAL = 3;
const STREAK_MILESTONE_REWARD_STEPS = 250;
const BUILDINGS = Object.freeze({
  house: { width: 1, height: 1 },
  park: { width: 2, height: 2 },
  shop: { width: 2, height: 1 },
  plaza: { width: 1, height: 2 },
  orchard: { width: 2, height: 2 },
  school: { width: 2, height: 2 },
  market: { width: 3, height: 1 },
  library: { width: 1, height: 2 },
  workshop: { width: 2, height: 1 },
});

let httpsCredentials = null;
const profileWriteQueues = new Map();

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
app.get("/api/game/state/:userId", handleReadUserState);
app.put("/api/game/state/:userId", handleWriteUserState);
app.post("/api/game/streaks/:userId/claim", handleClaimReward);

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

app.use("/app", express.static(path.join(ROOT_DIR, "app")));
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

async function handleReadUserState(req, res) {
  const userId = normalizeText(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: "Missing userId." });
  }

  try {
    const profile = await readUserProfile(userId);
    return res.json({
      userId,
      state: profile.state,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    console.error("Failed to load user cloud state:", error);
    return res.status(500).json({ error: "Failed to read cloud state." });
  }
}

async function handleWriteUserState(req, res) {
  const userId = normalizeText(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: "Missing userId." });
  }

  const validation = validateStatePayload(req.body?.state ?? req.body, userId);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const payload = await withUserProfileLock(userId, async () => {
      const profile = await readUserProfile(userId);
      profile.state = validation.state;
      profile.updatedAt = validation.state.updatedAt;
      await writeUserProfile(userId, profile);

      return {
        success: true,
        userId,
        state: profile.state,
        updatedAt: profile.updatedAt,
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error("Failed to save cloud state:", error);
    return res.status(500).json({ error: "Failed to save cloud state." });
  }
}

async function handleClaimReward(req, res) {
  const userId = normalizeText(req.params.userId);
  const rewardType = normalizeText(req.body?.type);
  const dayKey = normalizeText(req.body?.dayKey);

  if (!userId) {
    return res.status(400).json({ error: "Missing userId." });
  }

  if (!rewardType || !dayKey) {
    return res.status(400).json({ error: "Both type and dayKey are required." });
  }

  try {
    const result = await withUserProfileLock(userId, async () => {
      const profile = await readUserProfile(userId);
      const entries = await readUserEntries(userId);
      const summary = buildStepSummary(entries, profile.rewards);
      const claimableReward = summary.rewards.claimable.find(
        (reward) => reward.type === rewardType && reward.dayKey === dayKey
      );

      if (!claimableReward) {
        return {
          status: 409,
          payload: {
            error: "That reward is no longer claimable.",
            summary,
          },
        };
      }

      if (rewardType === "daily-goal") {
        profile.rewards.claimedDailyGoalDays = uniqueSortedDayKeys([
          ...profile.rewards.claimedDailyGoalDays,
          dayKey,
        ]);
      } else if (rewardType === "streak-milestone") {
        profile.rewards.claimedMilestoneDays = uniqueSortedDayKeys([
          ...profile.rewards.claimedMilestoneDays,
          dayKey,
        ]);
      } else {
        return {
          status: 400,
          payload: { error: "Unsupported reward type." },
        };
      }

      await writeUserProfile(userId, profile);

      return {
        status: 200,
        payload: {
          success: true,
          reward: claimableReward,
          summary: buildStepSummary(entries, profile.rewards),
        },
      };
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Failed to claim streak reward:", error);
    return res.status(500).json({ error: "Failed to claim streak reward." });
  }
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

function ensureNonNegativeInteger(value, fallback = 0) {
  const parsed = ensureInteger(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeBuildingLevel(value) {
  const parsed = ensureInteger(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(3, parsed));
}

function normalizeCoordinate(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeTimestamp(value, fallback = null) {
  const text = normalizeText(value);
  if (!text) {
    return fallback;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
}

function validateStepPayload(body) {
  const userId = normalizeText(body.userId);
  const steps = ensureInteger(body.steps);
  const source = normalizeText(body.source || "unknown");
  const syncKey = normalizeText(body.syncKey);
  const deviceDayKey = normalizeDayKey(body.deviceDayKey);
  const timestamp = normalizeTimestamp(body.timestamp, new Date().toISOString());
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

function validateStatePayload(source, userId) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { ok: false, error: "Cloud state must be a JSON object." };
  }

  return {
    ok: true,
    state: sanitizeCloudState(source, userId),
  };
}

function sanitizeCloudState(source, userId) {
  const buildings = sanitizeBuildings(source.buildings);
  return {
    schemaVersion: CLOUD_STATE_SCHEMA_VERSION,
    availableSteps: ensureNonNegativeInteger(source.availableSteps, 1000),
    lastStepTimestamp: normalizeTimestamp(source.lastStepTimestamp, null),
    lastNativeStepDate: normalizeDayKey(source.lastNativeStepDate),
    lastNativeStepTotal: ensureNonNegativeInteger(source.lastNativeStepTotal, 0),
    lastUploadedNativeUserId: normalizeText(source.lastUploadedNativeUserId) || null,
    lastUploadedNativeDayKey: normalizeDayKey(source.lastUploadedNativeDayKey),
    lastUploadedNativeStepTotal: ensureNonNegativeInteger(source.lastUploadedNativeStepTotal, 0),
    buildings,
    nextBuildingId: Math.max(
      ensureNonNegativeInteger(source.nextBuildingId, 1),
      getNextBuildingSequence(buildings)
    ),
    trees: sanitizeTrees(source.trees),
    lifetimeStats: sanitizeLifetimeStats(source.lifetimeStats),
    contracts: sanitizeContractsState(source.contracts),
    updatedAt: normalizeTimestamp(source.updatedAt, new Date().toISOString()),
    cloudOwnerUserId: userId,
  };
}

function sanitizeBuildings(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  const usedIds = new Set();

  return source
    .map((building, index) => {
      const type = normalizeText(building?.type);
      const definition = BUILDINGS[type];
      const row = normalizeCoordinate(building?.row);
      const col = normalizeCoordinate(building?.col);
      const level = normalizeBuildingLevel(building?.level);

      if (
        !definition ||
        row === null ||
        col === null ||
        row < 0 ||
        col < 0 ||
        row + definition.height > GRID_SIZE ||
        col + definition.width > GRID_SIZE
      ) {
        return null;
      }

      let id = normalizeText(building?.id) || `legacy-${index + 1}`;
      while (usedIds.has(id)) {
        id = `${id}-${index + 1}`;
      }
      usedIds.add(id);

      return { id, type, row, col, level };
    })
    .filter(Boolean);
}

function getNextBuildingSequence(buildings = []) {
  let highest = 0;

  buildings.forEach((building) => {
    const match = normalizeText(building?.id).match(/^b-(\d+)$/i);
    if (!match) {
      return;
    }

    highest = Math.max(highest, Number(match[1]) || 0);
  });

  return highest + 1;
}

function sanitizeTrees(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((tree) => {
      const row = normalizeCoordinate(tree?.row);
      const col = normalizeCoordinate(tree?.col);
      const imageIndex = normalizeCoordinate(tree?.imageIndex);

      if (
        row === null ||
        col === null ||
        imageIndex === null ||
        row < 0 ||
        col < 0 ||
        row >= GRID_SIZE ||
        col >= GRID_SIZE ||
        imageIndex < 0 ||
        imageIndex >= TREE_VARIANT_COUNT
      ) {
        return null;
      }

      return { row, col, imageIndex };
    })
    .filter(Boolean);
}

function createEmptyLifetimeStats() {
  return {
    built: 0,
    upgraded: 0,
    moved: 0,
    demolished: 0,
  };
}

function sanitizeLifetimeStats(source) {
  const stats = createEmptyLifetimeStats();
  Object.keys(stats).forEach((key) => {
    stats[key] = ensureNonNegativeInteger(source?.[key], 0);
  });
  return stats;
}

function createEmptyContractRecord(slot) {
  return {
    slot,
    cycleKey: "",
    templateId: "",
    title: "",
    description: "",
    metricKey: "",
    rewardSteps: 0,
    startValue: 0,
    targetDelta: 0,
    targetValue: 0,
    claimed: false,
  };
}

function sanitizeContractRecord(source, slot) {
  return {
    slot,
    cycleKey: normalizeText(source?.cycleKey),
    templateId: normalizeText(source?.templateId),
    title: normalizeText(source?.title),
    description: normalizeText(source?.description),
    metricKey: normalizeText(source?.metricKey),
    rewardSteps: ensureNonNegativeInteger(source?.rewardSteps, 0),
    startValue: Number.isFinite(Number(source?.startValue)) ? Number(source.startValue) : 0,
    targetDelta: ensureNonNegativeInteger(source?.targetDelta, 0),
    targetValue: Number.isFinite(Number(source?.targetValue)) ? Number(source.targetValue) : 0,
    claimed: source?.claimed === true,
  };
}

function sanitizeContractsState(source) {
  return {
    daily: sanitizeContractRecord(source?.daily, "daily"),
    weekly: sanitizeContractRecord(source?.weekly, "weekly"),
  };
}

function createEmptyRewards() {
  return {
    claimedDailyGoalDays: [],
    claimedMilestoneDays: [],
  };
}

function normalizeRewards(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return createEmptyRewards();
  }

  return {
    claimedDailyGoalDays: uniqueSortedDayKeys(source.claimedDailyGoalDays),
    claimedMilestoneDays: uniqueSortedDayKeys(source.claimedMilestoneDays),
  };
}

function uniqueSortedDayKeys(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  return Array.from(
    new Set(
      source
        .map((value) => normalizeDayKey(value))
        .filter(Boolean)
    )
  ).sort();
}

function normalizeDayKey(value) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function formatDayKeyUtc(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getAdjacentDayKey(dayKey, deltaDays) {
  const parsed = new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return formatDayKeyUtc(parsed);
}

function getEntryDayKey(entry) {
  return normalizeDayKey(entry.deviceDayKey) || formatDayKeyUtc(entry.timestamp);
}

function getUserProfilePath(userId) {
  return path.join(PROFILE_DIR, `${Buffer.from(userId).toString("base64url")}.json`);
}

function withUserProfileLock(userId, task) {
  const previous = profileWriteQueues.get(userId) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  const settled = next.catch(() => {});
  profileWriteQueues.set(userId, settled);

  return next.finally(() => {
    if (profileWriteQueues.get(userId) === settled) {
      profileWriteQueues.delete(userId);
    }
  });
}

async function ensureDataDirectory() {
  await fsp.mkdir(path.dirname(STEP_LOG_PATH), { recursive: true });
  await fsp.mkdir(PROFILE_DIR, { recursive: true });
}

async function readUserProfile(userId) {
  const profilePath = getUserProfilePath(userId);

  try {
    const raw = await fsp.readFile(profilePath, "utf8");
    const parsed = JSON.parse(raw);
    const state = parsed?.state ? sanitizeCloudState(parsed.state, userId) : null;

    return {
      userId,
      updatedAt: normalizeTimestamp(parsed?.updatedAt || parsed?.state?.updatedAt, null),
      state,
      rewards: normalizeRewards(parsed?.rewards),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        userId,
        updatedAt: null,
        state: null,
        rewards: createEmptyRewards(),
      };
    }

    throw error;
  }
}

async function writeUserProfile(userId, profile) {
  await ensureDataDirectory();

  const normalizedProfile = {
    userId,
    updatedAt: normalizeTimestamp(profile?.updatedAt || profile?.state?.updatedAt, new Date().toISOString()),
    state: profile?.state ? sanitizeCloudState(profile.state, userId) : null,
    rewards: normalizeRewards(profile?.rewards),
  };

  if (normalizedProfile.state && !normalizedProfile.state.updatedAt) {
    normalizedProfile.state.updatedAt = normalizedProfile.updatedAt;
  }

  if (normalizedProfile.state) {
    normalizedProfile.updatedAt = normalizedProfile.state.updatedAt;
  }

  await fsp.writeFile(
    getUserProfilePath(userId),
    `${JSON.stringify(normalizedProfile, null, 2)}\n`,
    "utf8"
  );
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
        deviceDayKey: normalizeDayKey(entry.deviceDayKey) || undefined,
        timestamp: normalizeTimestamp(entry.timestamp, new Date(0).toISOString()),
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

async function readUserEntries(userId) {
  return (await readStepEntries())
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
}

function buildStepSummary(entries, rewards) {
  const totalsByDay = new Map();

  entries.forEach((entry) => {
    const dayKey = getEntryDayKey(entry);
    totalsByDay.set(dayKey, (totalsByDay.get(dayKey) || 0) + entry.steps);
  });

  const sortedDayKeys = Array.from(totalsByDay.keys()).sort();
  const claimedDailyGoalDays = new Set(rewards.claimedDailyGoalDays);
  const claimedMilestoneDays = new Set(rewards.claimedMilestoneDays);
  const streakLengthByDay = new Map();
  let previousQualifiedDayKey = "";
  let longestStreak = 0;

  sortedDayKeys.forEach((dayKey) => {
    const total = totalsByDay.get(dayKey) || 0;
    if (total < DAILY_STEP_GOAL) {
      return;
    }

    const streakLength =
      previousQualifiedDayKey && getAdjacentDayKey(previousQualifiedDayKey, 1) === dayKey
        ? (streakLengthByDay.get(previousQualifiedDayKey) || 0) + 1
        : 1;

    streakLengthByDay.set(dayKey, streakLength);
    previousQualifiedDayKey = dayKey;
    longestStreak = Math.max(longestStreak, streakLength);
  });

  const todayKey = formatDayKeyUtc(new Date());
  const yesterdayKey = getAdjacentDayKey(todayKey, -1);
  const currentStreakAnchor = streakLengthByDay.has(todayKey)
    ? todayKey
    : streakLengthByDay.has(yesterdayKey)
      ? yesterdayKey
      : "";
  const currentStreak = currentStreakAnchor ? streakLengthByDay.get(currentStreakAnchor) || 0 : 0;
  const todaySteps = totalsByDay.get(todayKey) || 0;
  const claimable = [];

  sortedDayKeys.forEach((dayKey) => {
    const steps = totalsByDay.get(dayKey) || 0;
    const streakLength = streakLengthByDay.get(dayKey) || 0;

    if (steps >= DAILY_STEP_GOAL && !claimedDailyGoalDays.has(dayKey)) {
      claimable.push({
        type: "daily-goal",
        dayKey,
        steps: DAILY_GOAL_REWARD_STEPS,
        label: `Daily goal bonus for ${dayKey}`,
      });
    }

    if (
      streakLength > 0 &&
      streakLength % STREAK_MILESTONE_INTERVAL === 0 &&
      !claimedMilestoneDays.has(dayKey)
    ) {
      claimable.push({
        type: "streak-milestone",
        dayKey,
        steps: STREAK_MILESTONE_REWARD_STEPS,
        streakLength,
        label: `${streakLength}-day streak bonus`,
      });
    }
  });

  const nextMilestone =
    currentStreak > 0
      ? currentStreak % STREAK_MILESTONE_INTERVAL === 0
        ? currentStreak + STREAK_MILESTONE_INTERVAL
        : currentStreak + (STREAK_MILESTONE_INTERVAL - (currentStreak % STREAK_MILESTONE_INTERVAL))
      : STREAK_MILESTONE_INTERVAL;

  const recentDailyTotals = sortedDayKeys
    .slice(-14)
    .reverse()
    .map((dayKey) => {
      const steps = totalsByDay.get(dayKey) || 0;
      const streakLength = streakLengthByDay.get(dayKey) || 0;
      return {
        dayKey,
        steps,
        goalReached: steps >= DAILY_STEP_GOAL,
        streakLength,
        rewardClaimed: claimedDailyGoalDays.has(dayKey),
        milestoneClaimed: claimedMilestoneDays.has(dayKey),
      };
    });

  return {
    totalSteps: entries.reduce((total, entry) => total + entry.steps, 0),
    entryCount: entries.length,
    latestTimestamp: entries[entries.length - 1]?.timestamp || null,
    dailyGoal: {
      dayKey: todayKey,
      targetSteps: DAILY_STEP_GOAL,
      currentSteps: todaySteps,
      remainingSteps: Math.max(0, DAILY_STEP_GOAL - todaySteps),
      completed: todaySteps >= DAILY_STEP_GOAL,
      rewardSteps: DAILY_GOAL_REWARD_STEPS,
      rewardClaimed: claimedDailyGoalDays.has(todayKey),
    },
    streak: {
      current: currentStreak,
      longest: longestStreak,
      milestoneInterval: STREAK_MILESTONE_INTERVAL,
      nextMilestone,
    },
    rewards: {
      claimable,
      dailyGoalRewardSteps: DAILY_GOAL_REWARD_STEPS,
      streakMilestoneRewardSteps: STREAK_MILESTONE_REWARD_STEPS,
    },
    recentDailyTotals,
  };
}

async function getUserStepPayload(userIdValue) {
  const userId = normalizeText(userIdValue);
  if (!userId) {
    return { ok: false, status: 400, error: "Missing userId." };
  }

  try {
    const [entries, profile] = await Promise.all([readUserEntries(userId), readUserProfile(userId)]);

    return {
      ok: true,
      userId,
      entries,
      summary: buildStepSummary(entries, profile.rewards),
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
