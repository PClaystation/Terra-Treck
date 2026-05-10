import {
  GRID_SIZE,
  DEFAULT_STEPS,
  CLOUD_STATE_SCHEMA_VERSION,
  DEMOLISH_REFUND_RATIO,
  STAT_DEFINITIONS,
  BUILDINGS,
  BUILDING_CLASS_NAMES,
  CONTRACT_SLOT_LABELS,
  CONTRACT_METRIC_LABELS,
  safeText,
  normalizeIsoTimestamp as normalizeBaseIsoTimestamp,
  normalizeDayKey,
  createInitialTrees as createBaseInitialTrees,
  createDefaultState as createBaseState,
  normalizeStatePayload as normalizeBaseStatePayload,
  getSerializableState as getBaseSerializableState,
  hasMeaningfulProgress as hasMeaningfulBaseProgress,
  getTimestampValue as getBaseTimestampValue,
  getNextBuildingSequence,
  getBuildingEntries,
  formatEffectList,
  createEmptyCitySummary,
  getBuildingMaxLevel,
  getBuildingLevelMultiplier,
  scaleEffectTotals,
  getUpgradeCost,
  getBuildingTotalInvestment,
  computeCitySummary as computeBaseCitySummary,
  refreshContractsState,
  evaluateContract as evaluateBaseContract,
  isBuildingUnlocked as isBaseBuildingUnlocked,
  getBuildingIndexById as getBaseBuildingIndexById,
  findBuildingById as findBaseBuildingById,
  findBuildingAt as findBaseBuildingAt,
  applyBuildAction,
  applyMoveAction,
  applyUpgradeAction,
  applyDemolishAction,
  applyResetAction,
  claimContractRewardInState,
  applyNativeStepSnapshotToState,
  applyServerStepEntriesToState,
  canPlaceBuilding,
} from "./app/game-engine.mjs";

const STORAGE_KEY = "terraTreckState";
const POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 10000;
const CLOUD_SAVE_DEBOUNCE_MS = 1200;
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
  "http://mpmc.ddns.net:4010",
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
const IOS_APP_CONTENT_MODE =
  safeText(APP_CONTEXT.contentMode).toLowerCase() || (IOS_WEB_AUTH_ENABLED ? "remote" : "bundled");
const NATIVE_BRIDGE_HANDLER = "terraTread";
const STREAK_DAILY_GOAL = 4000;
const STREAK_DAILY_REWARD = 150;
const STREAK_MILESTONE_INTERVAL = 3;
const STREAK_MILESTONE_REWARD = 250;
const MAX_UNDO_ENTRIES = 25;

const TREE_IMAGES = [
  "./images/Tree1-removebg-preview.png",
  "./images/Tree2-removebg-preview.png",
  "./images/Tree3-removebg-preview.png",
];

const grid = document.getElementById("grid");
const stepCount = document.getElementById("step-count");
const buildToggle = document.getElementById("build-toggle");
const buildingOptions = document.getElementById("building-options");
const undoButton = document.getElementById("undo-button");
const resetButton = document.getElementById("reset-button");
const confirmButtons = document.getElementById("confirm-buttons");
const confirmBuildBtn = document.getElementById("confirm-build");
const cancelBuildBtn = document.getElementById("cancel-build");
const authButton = document.getElementById("auth-button");
const playerStatus = document.getElementById("player-status");
const connectionStatus = document.getElementById("connection-status");
const cloudStatus = document.getElementById("cloud-status");
const cityLevel = document.getElementById("city-level");
const cityProsperity = document.getElementById("city-prosperity");
const cityProgressBar = document.getElementById("city-progress-bar");
const nextUnlock = document.getElementById("next-unlock");
const cityStats = document.getElementById("city-stats");
const streakCount = document.getElementById("streak-count");
const streakLabel = document.getElementById("streak-label");
const streakSubtext = document.getElementById("streak-subtext");
const dailyGoalBar = document.getElementById("daily-goal-bar");
const dailyGoalProgress = document.getElementById("daily-goal-progress");
const dailyGoalStatus = document.getElementById("daily-goal-status");
const contractsSummary = document.getElementById("contracts-summary");
const contractsList = document.getElementById("contracts-list");
const buildingInspector = document.getElementById("building-inspector");
const inspectorName = document.getElementById("inspector-name");
const inspectorLevel = document.getElementById("inspector-level");
const inspectorMeta = document.getElementById("inspector-meta");
const inspectorEffects = document.getElementById("inspector-effects");
const upgradeButton = document.getElementById("upgrade-button");
const moveButton = document.getElementById("move-button");
const demolishButton = document.getElementById("demolish-button");
const boardStage = document.querySelector(".board-stage");

let selectedBuilding = null;
let selectedBuildingId = "";
let relocationBuildingId = "";
let buildMode = false;
let previewLocked = false;
let pendingTiles = [];
let lockedPreviewTiles = [];
let pendingAction = null;
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
let currentCitySummary = createEmptyCitySummary();
let streakSummary = createEmptyStreakSummary();
let cloudSaveTimerId = null;
let cloudStateReady = false;
let cloudStateUserId = "";
let cloudSyncInFlight = false;
let cloudSaveInFlight = false;
let confirmButtonsHideTimerId = null;
const undoStack = [];

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
  undoButton.addEventListener("click", undoLastAction);
  resetButton.addEventListener("click", resetCity);
  authButton.addEventListener("click", handleAuthButtonClick);
  buildingOptions.addEventListener("click", handleBuildingOptionClick);
  contractsList.addEventListener("click", handleContractClick);
  upgradeButton.addEventListener("click", handleUpgradeButtonClick);
  moveButton.addEventListener("click", handleMoveButtonClick);
  demolishButton.addEventListener("click", handleDemolishButtonClick);

  confirmBuildBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    confirmPlacement();
  });

  cancelBuildBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    cancelPlacement();
  });
}

function handleBuildingOptionClick(event) {
  const button = event.target.closest(".building-btn");
  if (!button || !buildingOptions.contains(button) || previewLocked) {
    return;
  }

  const buildingName = safeText(button.dataset.name);
  if (!isBuildingUnlocked(buildingName)) {
    return;
  }

  buildMode = true;
  selectedBuilding = buildingName;
  selectedBuildingId = "";
  relocationBuildingId = "";
  hideConfirmButtons();
  renderAll();
  focusBoardForMobilePlacement();
}

function handleContractClick(event) {
  const button = event.target.closest(".contract-claim-btn");
  if (!button || !contractsList.contains(button)) {
    return;
  }

  const slot = safeText(button.dataset.slot);
  claimContractReward(slot);
}

function handleUpgradeButtonClick() {
  const building = findBuildingById(selectedBuildingId);
  if (!building) {
    return;
  }

  const upgradeCost = getUpgradeCost(building);
  if (!upgradeCost) {
    return;
  }

  if (state.availableSteps < upgradeCost) {
    window.alert("Not enough steps to upgrade this building.");
    return;
  }

  recordUndoSnapshot();
  const upgrade = applyUpgradeAction(state, building.id);
  if (!upgrade.ok) {
    return;
  }

  persistState();
  renderAll();
}

function handleMoveButtonClick() {
  const building = findBuildingById(selectedBuildingId);
  if (!building) {
    return;
  }

  if (relocationBuildingId === building.id) {
    relocationBuildingId = "";
    pendingAction = null;
    previewLocked = false;
    pendingTiles = [];
    lockedPreviewTiles = [];
    clearHoverPreview();
    hideConfirmButtons();
    renderAll();
    return;
  }

  relocationBuildingId = building.id;
  selectedBuilding = null;
  buildMode = false;
  clearHoverPreview();
  hideConfirmButtons();
  renderAll();
}

function handleDemolishButtonClick() {
  const building = findBuildingById(selectedBuildingId);
  if (!building) {
    return;
  }

  const refundSteps = Math.max(
    0,
    Math.round(getBuildingTotalInvestment(building) * DEMOLISH_REFUND_RATIO)
  );

  if (
    !window.confirm(
      `Demolish this ${BUILDINGS[building.type].label.toLowerCase()} for ${refundSteps} refunded steps?`
    )
  ) {
    return;
  }

  recordUndoSnapshot();
  const demolition = applyDemolishAction(state, building.id);
  if (!demolition.ok) {
    return;
  }

  selectedBuildingId = "";
  relocationBuildingId = "";
  persistState();
  renderAll();
}

function loadState() {
  const savedState = localStorage.getItem(STORAGE_KEY);
  const legacySteps = parseInt(localStorage.getItem("stepTotal") || "", 10);
  const legacyTimestamp = localStorage.getItem("lastStepTimestamp");

  const fallbackState = createDefaultState({
    availableSteps: Number.isFinite(legacySteps) ? legacySteps : DEFAULT_STEPS,
    lastStepTimestamp: legacyTimestamp || null,
  });

  if (!savedState) {
    persistState(fallbackState, { touch: false, skipCloud: true });
    return fallbackState;
  }

  try {
    return normalizeStatePayload(JSON.parse(savedState), fallbackState);
  } catch (error) {
    console.error("Failed to parse saved state:", error);
    persistState(fallbackState, { touch: false, skipCloud: true });
    return fallbackState;
  }
}

function createInitialTrees() {
  return createBaseInitialTrees({ imageCount: TREE_IMAGES.length });
}

function createDefaultState(overrides = {}) {
  return createBaseState(overrides, { treeFactory: createInitialTrees });
}

function normalizeStatePayload(source = {}, fallbackState = createDefaultState()) {
  return normalizeBaseStatePayload(source, fallbackState, {
    treeVariantCount: TREE_IMAGES.length,
  });
}

function getSerializableState(source = state) {
  return getBaseSerializableState(source, {
    treeFactory: createInitialTrees,
    treeVariantCount: TREE_IMAGES.length,
  });
}

function replaceState(nextState, { touch = false, skipCloud = true } = {}) {
  const normalizedState = normalizeStatePayload(nextState, createDefaultState());
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, normalizedState);
  persistState(state, { touch, skipCloud });
}

function hasMeaningfulProgress(source = state) {
  return hasMeaningfulBaseProgress(source);
}

function getTimestampValue(value) {
  return getBaseTimestampValue(value);
}

function persistState(nextState = state, { touch = true, skipCloud = false } = {}) {
  nextState.schemaVersion = CLOUD_STATE_SCHEMA_VERSION;
  nextState.nextBuildingId = Math.max(
    Number.isFinite(nextState.nextBuildingId) ? Math.floor(nextState.nextBuildingId) : 1,
    getNextBuildingSequence(nextState.buildings)
  );
  if (touch) {
    nextState.updatedAt = new Date().toISOString();
  } else if (nextState.updatedAt) {
    nextState.updatedAt = normalizeBaseIsoTimestamp(nextState.updatedAt);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  localStorage.setItem("stepTotal", String(nextState.availableSteps));

  if (nextState.lastStepTimestamp) {
    localStorage.setItem("lastStepTimestamp", nextState.lastStepTimestamp);
  } else {
    localStorage.removeItem("lastStepTimestamp");
  }

  if (!skipCloud) {
    scheduleCloudSave();
  }
}

function trimTrailingSlash(value) {
  return safeText(value).replace(/\/+$/, "");
}

function createEmptyStreakSummary() {
  return {
    dailyGoal: {
      dayKey: "",
      targetSteps: STREAK_DAILY_GOAL,
      currentSteps: 0,
      remainingSteps: STREAK_DAILY_GOAL,
      completed: false,
      rewardSteps: STREAK_DAILY_REWARD,
      rewardClaimed: false,
    },
    streak: {
      current: 0,
      longest: 0,
      milestoneInterval: STREAK_MILESTONE_INTERVAL,
      nextMilestone: STREAK_MILESTONE_INTERVAL,
    },
    rewards: {
      claimable: [],
      dailyGoalRewardSteps: STREAK_DAILY_REWARD,
      streakMilestoneRewardSteps: STREAK_MILESTONE_REWARD,
    },
    recentDailyTotals: [],
  };
}

function normalizeRewardList(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((reward) => {
      const type = safeText(reward?.type);
      const dayKey = normalizeDayKey(reward?.dayKey);
      const steps = Number.isFinite(reward?.steps) ? Math.max(0, Math.floor(reward.steps)) : 0;

      if (!type || !dayKey || steps <= 0) {
        return null;
      }

      return {
        type,
        dayKey,
        steps,
        streakLength: Number.isFinite(reward?.streakLength)
          ? Math.max(0, Math.floor(reward.streakLength))
          : 0,
        label: safeText(reward?.label),
      };
    })
    .filter(Boolean);
}

function normalizeStreakSummary(source = {}) {
  return {
    dailyGoal: {
      dayKey: normalizeDayKey(source?.dailyGoal?.dayKey) || "",
      targetSteps: Number.isFinite(source?.dailyGoal?.targetSteps)
        ? Math.max(0, Math.floor(source.dailyGoal.targetSteps))
        : STREAK_DAILY_GOAL,
      currentSteps: Number.isFinite(source?.dailyGoal?.currentSteps)
        ? Math.max(0, Math.floor(source.dailyGoal.currentSteps))
        : 0,
      remainingSteps: Number.isFinite(source?.dailyGoal?.remainingSteps)
        ? Math.max(0, Math.floor(source.dailyGoal.remainingSteps))
        : STREAK_DAILY_GOAL,
      completed: source?.dailyGoal?.completed === true,
      rewardSteps: Number.isFinite(source?.dailyGoal?.rewardSteps)
        ? Math.max(0, Math.floor(source.dailyGoal.rewardSteps))
        : STREAK_DAILY_REWARD,
      rewardClaimed: source?.dailyGoal?.rewardClaimed === true,
    },
    streak: {
      current: Number.isFinite(source?.streak?.current)
        ? Math.max(0, Math.floor(source.streak.current))
        : 0,
      longest: Number.isFinite(source?.streak?.longest)
        ? Math.max(0, Math.floor(source.streak.longest))
        : 0,
      milestoneInterval: Number.isFinite(source?.streak?.milestoneInterval)
        ? Math.max(1, Math.floor(source.streak.milestoneInterval))
        : STREAK_MILESTONE_INTERVAL,
      nextMilestone: Number.isFinite(source?.streak?.nextMilestone)
        ? Math.max(1, Math.floor(source.streak.nextMilestone))
        : STREAK_MILESTONE_INTERVAL,
    },
    rewards: {
      claimable: normalizeRewardList(source?.rewards?.claimable),
      dailyGoalRewardSteps: Number.isFinite(source?.rewards?.dailyGoalRewardSteps)
        ? Math.max(0, Math.floor(source.rewards.dailyGoalRewardSteps))
        : STREAK_DAILY_REWARD,
      streakMilestoneRewardSteps: Number.isFinite(source?.rewards?.streakMilestoneRewardSteps)
        ? Math.max(0, Math.floor(source.rewards.streakMilestoneRewardSteps))
        : STREAK_MILESTONE_REWARD,
    },
    recentDailyTotals: Array.isArray(source?.recentDailyTotals) ? source.recentDailyTotals : [],
  };
}

function setStreakSummary(summary = {}) {
  streakSummary = normalizeStreakSummary(summary);
  renderStreakOverview(streakSummary);
}

function computeCitySummary(buildings = state.buildings) {
  return computeBaseCitySummary(buildings);
}

function ensureContractsAreCurrent({ persist = true } = {}) {
  const { contracts, changed } = refreshContractsState(state, computeCitySummary());
  state.contracts = contracts;

  if (changed && persist) {
    persistState();
  }

  return changed;
}

function evaluateContract(contract, summary = currentCitySummary) {
  return evaluateBaseContract(contract, state, summary);
}

function isBuildingUnlocked(name, level = currentCitySummary.level) {
  return isBaseBuildingUnlocked(name, level);
}

function getBuildingIndexById(buildingId, buildings = state.buildings) {
  return getBaseBuildingIndexById(buildingId, buildings);
}

function findBuildingById(buildingId, buildings = state.buildings) {
  return findBaseBuildingById(buildingId, buildings);
}

function findBuildingAt(row, col, buildings = state.buildings) {
  return findBaseBuildingAt(row, col, buildings);
}

function renderCityStats(summary = currentCitySummary) {
  if (!cityStats) {
    return;
  }

  cityStats.innerHTML = Object.entries(STAT_DEFINITIONS)
    .map(([stat, definition]) => {
      const value = Number(summary.stats?.[stat]) || 0;
      return `
        <div class="stat-chip">
          <span class="stat-chip-emblem" aria-hidden="true">${definition.icon}</span>
          <span class="stat-chip-copy">
            <span class="stat-chip-label">${definition.label}</span>
            <span class="stat-chip-value">${value}</span>
          </span>
        </div>
      `;
    })
    .join("");
}

function renderCityOverview(summary = currentCitySummary) {
  if (!cityLevel || !cityProsperity || !cityProgressBar || !nextUnlock) {
    return;
  }

  cityLevel.textContent = String(summary.level);
  cityProsperity.textContent = summary.nextLevelThreshold
    ? `${summary.prosperity} / ${summary.nextLevelThreshold} prosperity`
    : `${summary.prosperity} prosperity`;
  cityProgressBar.style.width = `${summary.progressPercent}%`;

  const synergyText = summary.prosperityBonus
    ? ` • Synergy bonus +${summary.prosperityBonus}`
    : "";

  if (summary.nextUnlock) {
    const [, definition] = summary.nextUnlock;
    nextUnlock.textContent = `Next unlock: ${definition.label} at level ${definition.unlockLevel}${synergyText}`;
  } else {
    nextUnlock.textContent = summary.buildingCount
      ? `All buildings unlocked${synergyText}`
      : "Build your first district to start growing the city.";
  }

  renderCityStats(summary);
}

function renderStreakOverview(summary = streakSummary) {
  if (
    !streakCount ||
    !streakLabel ||
    !streakSubtext ||
    !dailyGoalBar ||
    !dailyGoalProgress ||
    !dailyGoalStatus
  ) {
    return;
  }

  const normalizedSummary = normalizeStreakSummary(summary);
  const { userId } = getSession();
  const current = normalizedSummary.streak.current;
  const longest = normalizedSummary.streak.longest;
  const targetSteps = normalizedSummary.dailyGoal.targetSteps || STREAK_DAILY_GOAL;
  const currentSteps = normalizedSummary.dailyGoal.currentSteps;
  const claimableRewards = normalizedSummary.rewards.claimable;
  const progressPercent = Math.max(0, Math.min(100, (currentSteps / targetSteps) * 100));

  streakCount.textContent = String(current);
  streakLabel.textContent =
    current === 1 ? "Current streak" : current > 1 ? "Current streak" : "Days in a row";
  streakSubtext.textContent = userId
    ? longest > 0
      ? `Best run ${longest} days. Next streak bonus at ${normalizedSummary.streak.nextMilestone} days.`
      : "Walk 4,000 steps to start your first streak."
    : "Login to sync streaks and cloud saves across devices.";
  dailyGoalBar.style.width = `${progressPercent}%`;
  dailyGoalProgress.textContent = `${currentSteps.toLocaleString()} / ${targetSteps.toLocaleString()} steps today`;

  if (!userId) {
    dailyGoalStatus.textContent = `Reach ${targetSteps.toLocaleString()} steps for a ${normalizedSummary.dailyGoal.rewardSteps}-step daily bonus.`;
    return;
  }

  const todayGoalReward =
    claimableRewards.find(
      (reward) =>
        reward.type === "daily-goal" && reward.dayKey === normalizedSummary.dailyGoal.dayKey
    ) || claimableRewards.find((reward) => reward.type === "daily-goal");
  const milestoneReward = claimableRewards.find((reward) => reward.type === "streak-milestone");

  if (todayGoalReward) {
    dailyGoalStatus.textContent = `Daily bonus ready: +${todayGoalReward.steps} steps.`;
  } else if (milestoneReward) {
    dailyGoalStatus.textContent = `${milestoneReward.streakLength}-day streak bonus unlocked: +${milestoneReward.steps} steps.`;
  } else if (normalizedSummary.dailyGoal.completed && normalizedSummary.dailyGoal.rewardClaimed) {
    dailyGoalStatus.textContent = "Today's bonus claimed. Keep the streak alive tomorrow.";
  } else if (normalizedSummary.dailyGoal.completed) {
    dailyGoalStatus.textContent = "Goal reached. Processing your reward...";
  } else {
    dailyGoalStatus.textContent = `Need ${normalizedSummary.dailyGoal.remainingSteps.toLocaleString()} more steps for +${normalizedSummary.dailyGoal.rewardSteps}.`;
  }
}

function getBuildingSummaryEntry(buildingId, summary = currentCitySummary) {
  return summary.breakdown.find((entry) => entry.id === safeText(buildingId)) || null;
}

function updateUndoButton() {
  if (!undoButton) {
    return;
  }

  undoButton.disabled = !undoStack.length || previewLocked;
}

function renderContracts(summary = currentCitySummary) {
  if (!contractsList || !contractsSummary) {
    return;
  }

  const evaluations = ["daily", "weekly"].map((slot) =>
    evaluateContract(state.contracts?.[slot], summary)
  );
  const claimableCount = evaluations.filter(
    ({ completed, contract }) => completed && !contract.claimed
  ).length;

  contractsSummary.textContent = claimableCount
    ? `${claimableCount} reward${claimableCount === 1 ? "" : "s"} ready to claim.`
    : "Daily and weekly goals refresh automatically.";

  contractsList.innerHTML = evaluations
    .map(({ contract, progressValue, targetDelta, progressPercent, completed, remaining }) => {
      const metricLabel = CONTRACT_METRIC_LABELS[contract.metricKey] || "progress";
      const buttonLabel = contract.claimed
        ? "Claimed"
        : completed
          ? `Claim +${contract.rewardSteps}`
          : "In progress";
      const statusText = contract.claimed
        ? "Reward claimed."
        : completed
          ? "Objective complete."
          : `${remaining} ${metricLabel} remaining.`;

      return `
        <article class="contract-item${completed ? " contract-item-complete" : ""}${contract.claimed ? " contract-item-claimed" : ""}">
          <div class="contract-row">
            <strong>${contract.title}</strong>
            <span class="contract-badge">${CONTRACT_SLOT_LABELS[contract.slot] || "Contract"}</span>
          </div>
          <p class="contract-copy">${contract.description}</p>
          <div class="contract-track" aria-hidden="true">
            <div class="contract-bar" style="width:${progressPercent}%"></div>
          </div>
          <div class="contract-row contract-meta-row">
            <span>${Math.min(progressValue, targetDelta)} / ${targetDelta} ${metricLabel}</span>
            <span>${contract.rewardSteps} steps</span>
          </div>
          <div class="contract-row contract-meta-row">
            <span class="contract-status">${statusText}</span>
            <button
              type="button"
              class="contract-claim-btn"
              data-slot="${contract.slot}"
              ${completed && !contract.claimed ? "" : "disabled"}
            >
              ${buttonLabel}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBuildingInspector(summary = currentCitySummary) {
  if (
    !buildingInspector ||
    !inspectorName ||
    !inspectorLevel ||
    !inspectorMeta ||
    !inspectorEffects ||
    !upgradeButton ||
    !moveButton ||
    !demolishButton
  ) {
    return;
  }

  if (buildMode && selectedBuilding) {
    buildingInspector.dataset.buildingType = selectedBuilding;
    inspectorName.textContent = `${BUILDINGS[selectedBuilding].label} selected`;
    inspectorLevel.textContent = "Placement";
    inspectorMeta.textContent = "Tap an open plot on the city board to preview this district.";
    inspectorEffects.textContent = `${formatEffectList(BUILDINGS[selectedBuilding].baseEffects)} • ${BUILDINGS[selectedBuilding].synergies
      .map((rule) => rule.label)
      .join(" • ")}`;
    upgradeButton.disabled = true;
    moveButton.disabled = true;
    demolishButton.disabled = true;
    upgradeButton.textContent = "Upgrade";
    moveButton.textContent = "Move";
    demolishButton.textContent = "Demolish";
    buildingInspector.classList.remove("hidden");
    return;
  }

  const building = findBuildingById(selectedBuildingId);
  if (!building) {
    delete buildingInspector.dataset.buildingType;
    upgradeButton.disabled = true;
    moveButton.disabled = true;
    demolishButton.disabled = true;
    inspectorName.textContent = "No district selected";
    inspectorLevel.textContent = "Inspect";
    inspectorMeta.textContent = "Tap a placed building to inspect it, or choose a district from the build palette.";
    inspectorEffects.textContent = "Upgrade, relocation, and demolition controls will appear here for the active plot.";
    upgradeButton.textContent = "Upgrade";
    moveButton.textContent = "Move";
    demolishButton.textContent = "Demolish";
    buildingInspector.classList.remove("hidden");
    return;
  }

  const definition = BUILDINGS[building.type];
  const summaryEntry = getBuildingSummaryEntry(building.id, summary);
  const upgradeCost = getUpgradeCost(building);
  const refundSteps = Math.max(0, Math.round(getBuildingTotalInvestment(building) * DEMOLISH_REFUND_RATIO));
  const moveModeActive = relocationBuildingId === building.id;
  const maxLevel = getBuildingMaxLevel(building.type);
  const synergyCount = summaryEntry?.synergyDetails?.length || 0;

  buildingInspector.dataset.buildingType = building.type;
  inspectorName.textContent = definition.label;
  inspectorLevel.textContent = `Lv ${building.level}/${maxLevel}`;
  inspectorMeta.textContent = moveModeActive
    ? "Move mode active. Tap a free destination, then confirm or cancel."
    : `Plot ${building.row + 1}, ${building.col + 1} • ${definition.width}x${definition.height} footprint • Refund ${refundSteps} steps`;
  inspectorEffects.textContent = `${formatEffectList(summaryEntry?.totalEffects || scaleEffectTotals(definition.baseEffects, getBuildingLevelMultiplier(building.level)))}${
    synergyCount ? ` • ${synergyCount} active synergy${synergyCount === 1 ? "" : "ies"}` : ""
  }`;

  upgradeButton.textContent = upgradeCost
    ? `Upgrade (${upgradeCost})`
    : "Max level";
  moveButton.textContent = moveModeActive ? "Relocating..." : "Move";
  demolishButton.textContent = `Demolish (+${refundSteps})`;
  upgradeButton.disabled = Boolean(
    previewLocked || moveModeActive || !upgradeCost || state.availableSteps < upgradeCost
  );
  moveButton.disabled = previewLocked && !moveModeActive;
  demolishButton.disabled = previewLocked;
  buildingInspector.classList.remove("hidden");
}

function renderBuildingOptions() {
  if (!buildingOptions) {
    return;
  }

  if (selectedBuilding && !isBuildingUnlocked(selectedBuilding)) {
    selectedBuilding = null;
  }

  buildingOptions.innerHTML = getBuildingEntries()
    .map(([name, definition]) => {
      const unlocked = isBuildingUnlocked(name);
      const affordable = state.availableSteps >= definition.cost;
      const selected = selectedBuilding === name;
      const synergySummary = definition.synergies.map((rule) => rule.label).join(" • ");
      const statusText = !unlocked
        ? `Unlocks at City Level ${definition.unlockLevel}`
        : selected && buildMode
          ? "Selected • Tap a tile to place"
          : affordable
            ? "Available now"
            : `Need ${definition.cost - state.availableSteps} more steps`;
      const titleText = `${definition.label}: ${formatEffectList(
        definition.baseEffects
      )}. Synergy: ${definition.synergies.map((rule) => rule.label).join("; ")}.`;

      return `
        <button
          type="button"
          class="building-btn${selected ? " selected" : ""}${unlocked ? "" : " locked"}${affordable ? "" : " unaffordable"}"
          data-name="${name}"
          ${unlocked ? "" : 'disabled aria-disabled="true"'}
          title="${titleText}"
        >
          <span class="building-icon" aria-hidden="true">${definition.icon}</span>
          <span class="building-copy">
            <span class="building-title-row">
              <span class="building-name">${definition.label}</span>
              <span class="building-badge">Lv ${definition.unlockLevel}</span>
            </span>
            <span class="building-meta-row">
              <span class="building-cost">${definition.cost} steps</span>
              <span class="building-effects">${formatEffectList(definition.baseEffects, { short: true })}</span>
            </span>
            <span class="building-synergy">${synergySummary}</span>
            <span class="building-status">${statusText}</span>
          </span>
        </button>
      `;
    })
    .join("");
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
  setConnectionStatus(
    IOS_APP_CONTENT_MODE === "remote" ? "Hosted app mode" : "Bundled app mode",
    "online"
  );
  setCloudStatus(
    IOS_WEB_AUTH_ENABLED
      ? "Login to enable cloud saves and streak sync."
      : "Cloud saves require web login in the iPhone app.",
    "muted"
  );
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
  cloudStateReady = false;
  cloudStateUserId = "";
  if (cloudSaveTimerId) {
    window.clearTimeout(cloudSaveTimerId);
    cloudSaveTimerId = null;
  }
  setStreakSummary(createEmptyStreakSummary());
  setCloudStatus("Cloud saves are available after login.", "muted");
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

function setCloudStatus(text, tone = "muted") {
  if (!cloudStatus) {
    return;
  }

  cloudStatus.textContent = text;
  cloudStatus.dataset.tone = tone;
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
  applyNativeStepSnapshotToState(state, payload);
  persistState();
  updateStepCount();
  renderBuildingOptions();
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
    await syncCloudStateForCurrentUser();
    startStepSync();
    void syncPendingNativeSteps();
    if (IS_IOS_APP) {
      void fetchStepsFromServer({ applyEntryGrants: false });
    }
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
    await syncCloudStateForCurrentUser();
    startStepSync();
    void syncPendingNativeSteps();
    if (IS_IOS_APP) {
      void fetchStepsFromServer({ applyEntryGrants: false });
    }
  } catch (error) {
    console.error("Continental ID sign-in completed, but Terra-Treck could not restore the session:", error);
    clearAuthState();
  } finally {
    authReady = true;
    authBusy = false;
    syncSessionUI();
  }
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
  const contractsChanged = ensureContractsAreCurrent({ persist: false });
  if (selectedBuildingId && getBuildingIndexById(selectedBuildingId) < 0) {
    selectedBuildingId = "";
  }
  if (relocationBuildingId && getBuildingIndexById(relocationBuildingId) < 0) {
    relocationBuildingId = "";
  }
  currentCitySummary = computeCitySummary();
  clearGridDecorations();
  renderTrees();
  renderBuildings();
  renderCityOverview();
  renderStreakOverview();
  renderContracts();
  renderBuildingOptions();
  renderBuildingInspector();
  updateStepCount();
  updateUndoButton();
  updateBuildModeVisuals();

  if (contractsChanged) {
    persistState();
  }
}

function clearGridDecorations() {
  Array.from(grid.children).forEach((tile) => {
    tile.classList.remove(
      ...BUILDING_CLASS_NAMES,
      "hovering",
      "pending",
      "selected-building",
      "moving-origin"
    );
    tile.dataset.building = "";
    tile.dataset.buildingId = "";
    tile.dataset.buildingLevel = "";
    tile.dataset.buildingAnchor = "";

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
      tile.dataset.buildingId = building.id;
      tile.dataset.buildingLevel = String(building.level);
      tile.classList.toggle("selected-building", building.id === selectedBuildingId);
      tile.classList.toggle("moving-origin", building.id === relocationBuildingId);
    });

    const anchorTile = getTileAt(building.row, building.col);
    if (anchorTile) {
      anchorTile.dataset.buildingAnchor = "true";
      anchorTile.dataset.buildingLevel = String(building.level);
    }
  });
}

function updateStepCount() {
  stepCount.textContent = Number(state.availableSteps).toLocaleString();
}

function createStateSnapshot(source = state) {
  return JSON.parse(JSON.stringify(getSerializableState(source)));
}

function recordUndoSnapshot() {
  undoStack.push(createStateSnapshot());
  if (undoStack.length > MAX_UNDO_ENTRIES) {
    undoStack.shift();
  }
  updateUndoButton();
}

function undoLastAction() {
  if (!undoStack.length || previewLocked) {
    return;
  }

  const previousState = undoStack.pop();
  selectedBuilding = null;
  selectedBuildingId = "";
  relocationBuildingId = "";
  previewLocked = false;
  pendingAction = null;
  pendingTiles = [];
  lockedPreviewTiles = [];
  clearHoverPreview();
  hideConfirmButtons();
  replaceState(previousState);
  renderAll();
}

function claimContractReward(slot) {
  const claim = claimContractRewardInState(state, slot, currentCitySummary);
  if (!claim.ok) {
    return;
  }

  persistState();
  renderAll();
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
  selectedBuildingId = "";
  relocationBuildingId = "";
  clearSelectedButtons();
  hideConfirmButtons();
  renderAll();
}

function exitBuildMode() {
  buildMode = false;
  selectedBuilding = null;
  previewLocked = false;
  lockedPreviewTiles = [];
  pendingAction = null;
  clearSelectedButtons();
  clearHoverPreview();
  hideConfirmButtons();
  renderAll();
}

function updateBuildModeVisuals() {
  buildToggle.classList.toggle("build-mode-active", buildMode);
  buildToggle.textContent = buildMode ? "Exit Build Mode" : "Enter Build Mode";
  buildToggle.setAttribute("aria-pressed", buildMode ? "true" : "false");
  buildingOptions.classList.remove("hidden");
  document.body.classList.toggle("build-mode-live", buildMode);

  Array.from(grid.children).forEach((tile) => {
    tile.classList.toggle("build-mode", buildMode);
  });
}

function clearSelectedButtons() {
  selectedBuilding = null;
  renderBuildingOptions();
}

function focusBoardForMobilePlacement() {
  if (
    !boardStage ||
    typeof window.matchMedia !== "function" ||
    !window.matchMedia("(max-width: 760px)").matches
  ) {
    return;
  }

  boardStage.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function getActivePlacementType() {
  if (relocationBuildingId) {
    return findBuildingById(relocationBuildingId)?.type || "";
  }

  return selectedBuilding || "";
}

function lockPendingTiles(action, tiles, baseTile) {
  previewLocked = true;
  pendingAction = action;
  lockedPreviewTiles = tiles;
  pendingTiles = tiles;
  clearHoverPreview();
  tiles.forEach((currentTile) => currentTile.classList.add("hovering"));
  positionConfirmButtons(baseTile);
  renderBuildingInspector();
  updateUndoButton();
}

function updateHoverPreview(tile) {
  const activeBuildingType = getActivePlacementType();
  if ((!buildMode && !relocationBuildingId) || !activeBuildingType || previewLocked) {
    return;
  }

  clearHoverPreview();

  const tiles = getTilesForPlacement(tile, activeBuildingType);
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
  const row = Number(tile.dataset.row);
  const col = Number(tile.dataset.col);
  const occupant = findBuildingAt(row, col);

  if (previewLocked) {
    return;
  }

  if (relocationBuildingId) {
    const movingBuilding = findBuildingById(relocationBuildingId);
    if (!movingBuilding) {
      relocationBuildingId = "";
      renderAll();
      return;
    }

    const tiles = getTilesForPlacement(tile, movingBuilding.type);
    if (!tiles) {
      window.alert("Building is out of bounds.");
      return;
    }

    if (
      movingBuilding.row === row &&
      movingBuilding.col === col
    ) {
      return;
    }

    const placement = canPlaceBuilding(state.buildings, movingBuilding.type, row, col, {
      ignoreBuildingId: relocationBuildingId,
    });
    if (!placement.ok) {
      window.alert(
        placement.reason === "out-of-bounds"
          ? "Building is out of bounds."
          : "Some tiles are already occupied."
      );
      return;
    }

    lockPendingTiles(
      {
        type: "move",
        buildingId: relocationBuildingId,
        buildingType: movingBuilding.type,
        row,
        col,
      },
      tiles,
      tile
    );
    return;
  }

  if (buildMode && selectedBuilding) {
    if (!isBuildingUnlocked(selectedBuilding)) {
      window.alert("That building is still locked.");
      renderBuildingOptions();
      return;
    }

    const tiles = getTilesForPlacement(tile, selectedBuilding);
    if (!tiles) {
      window.alert("Building is out of bounds.");
      return;
    }

    const placement = canPlaceBuilding(state.buildings, selectedBuilding, row, col);
    if (!placement.ok) {
      window.alert(
        placement.reason === "out-of-bounds"
          ? "Building is out of bounds."
          : "Some tiles are already occupied."
      );
      return;
    }

    const buildingCost = BUILDINGS[selectedBuilding].cost;
    if (state.availableSteps < buildingCost) {
      window.alert("Not enough steps to build.");
      return;
    }

    lockPendingTiles(
      {
        type: "build",
        buildingType: selectedBuilding,
        row,
        col,
      },
      tiles,
      tile
    );
    return;
  }

  if (occupant) {
    selectedBuildingId = occupant.id;
    renderAll();
    return;
  }

  if (selectedBuildingId) {
    selectedBuildingId = "";
    renderAll();
  }
}

function confirmPlacement() {
  if (!previewLocked || !pendingAction || !pendingTiles.length) {
    return;
  }

  recordUndoSnapshot();

  if (pendingAction.type === "build") {
    const buildResult = applyBuildAction(state, {
      buildingType: pendingAction.buildingType,
      row: pendingAction.row,
      col: pendingAction.col,
    });
    if (!buildResult.ok) {
      return;
    }
    selectedBuildingId = "";
  } else if (pendingAction.type === "move") {
    const moveResult = applyMoveAction(state, {
      buildingId: pendingAction.buildingId,
      row: pendingAction.row,
      col: pendingAction.col,
    });
    if (moveResult.ok) {
      selectedBuildingId = pendingAction.buildingId;
    }
    relocationBuildingId = "";
  }

  persistState();

  previewLocked = false;
  pendingAction = null;
  lockedPreviewTiles = [];
  pendingTiles = [];
  hideConfirmButtons();
  renderAll();
}

function cancelPlacement() {
  if (!previewLocked) {
    return;
  }

  previewLocked = false;
  pendingAction = null;
  lockedPreviewTiles = [];
  pendingTiles = [];
  clearHoverPreview();
  hideConfirmButtons();
  updateUndoButton();
}

function hideConfirmButtons() {
  confirmButtons.classList.remove("active");
  if (confirmButtonsHideTimerId) {
    window.clearTimeout(confirmButtonsHideTimerId);
  }

  confirmButtonsHideTimerId = window.setTimeout(() => {
    confirmButtons.classList.add("hidden");
    confirmButtons.style.left = "";
    confirmButtons.style.top = "";
    confirmButtonsHideTimerId = null;
  }, 300);
}

function positionConfirmButtons(baseTile) {
  if (!pendingTiles.length) {
    return;
  }

  if (confirmButtonsHideTimerId) {
    window.clearTimeout(confirmButtonsHideTimerId);
    confirmButtonsHideTimerId = null;
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

  recordUndoSnapshot();
  applyResetAction(state, { treeFactory: createInitialTrees });
  selectedBuildingId = "";
  relocationBuildingId = "";
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

function getSession() {
  return {
    token: accessToken,
    userId: safeText(currentUser?.userId || currentUser?.continentalId),
  };
}

function canUseCloudSave() {
  const { userId } = getSession();
  return Boolean(userId) && (!IS_IOS_APP || IOS_WEB_AUTH_ENABLED);
}

function scheduleCloudSave({ immediate = false } = {}) {
  if (!canUseCloudSave() || !cloudStateReady || cloudStateUserId !== getSession().userId) {
    return;
  }

  if (cloudSaveTimerId) {
    window.clearTimeout(cloudSaveTimerId);
    cloudSaveTimerId = null;
  }

  if (immediate) {
    void syncCloudStateToServer();
    return;
  }

  cloudSaveTimerId = window.setTimeout(() => {
    cloudSaveTimerId = null;
    void syncCloudStateToServer();
  }, CLOUD_SAVE_DEBOUNCE_MS);
}

async function syncCloudStateToServer() {
  const { userId } = getSession();
  if (!userId || !cloudStateReady || cloudStateUserId !== userId || cloudSaveInFlight) {
    return;
  }

  cloudSaveInFlight = true;
  setCloudStatus("Saving city to the cloud...", "syncing");

  try {
    await ensureGameApiBaseUrl();
    state.cloudOwnerUserId = userId;

    const response = await fetchWithTimeout(
      `${getGameApiBase()}/state/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: getSerializableState(state),
        }),
      }
    );

    const payload = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(safeText(payload.error || payload.message) || `HTTP ${response.status}`);
    }

    if (payload?.state && typeof payload.state === "object") {
      replaceState(
        {
          ...payload.state,
          updatedAt: payload.updatedAt || payload.state.updatedAt,
          cloudOwnerUserId: userId,
        },
        { touch: false, skipCloud: true }
      );
    } else if (payload?.updatedAt) {
      state.updatedAt = normalizeBaseIsoTimestamp(payload.updatedAt) || state.updatedAt;
      persistState(state, { touch: false, skipCloud: true });
    }

    setCloudStatus("Cloud save synced.", "online");
  } catch (error) {
    console.error("Failed to sync Terra Tread cloud save:", error);
    setCloudStatus("Cloud save pending. Retry when the backend is reachable.", "offline");
  } finally {
    cloudSaveInFlight = false;
  }
}

async function syncCloudStateForCurrentUser() {
  const { userId } = getSession();
  if (!userId) {
    cloudStateReady = false;
    cloudStateUserId = "";
    setCloudStatus("Cloud saves are available after login.", "muted");
    return;
  }

  if (cloudSaveTimerId) {
    window.clearTimeout(cloudSaveTimerId);
    cloudSaveTimerId = null;
  }

  cloudSyncInFlight = true;
  setCloudStatus("Syncing your city from the cloud...", "syncing");

  try {
    await ensureGameApiBaseUrl();
    const response = await fetchWithTimeout(
      `${getGameApiBase()}/state/${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
      }
    );
    const payload = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(safeText(payload.error || payload.message) || `HTTP ${response.status}`);
    }

    const remoteState =
      payload?.state && typeof payload.state === "object"
        ? normalizeStatePayload(payload.state, createDefaultState())
        : null;
    const remoteUpdatedAt =
      normalizeBaseIsoTimestamp(payload?.updatedAt || payload?.state?.updatedAt);
    const localOwnerUserId = safeText(state.cloudOwnerUserId);
    const localOwnedByDifferentUser = Boolean(localOwnerUserId && localOwnerUserId !== userId);
    const shouldUseRemoteState =
      Boolean(remoteState) &&
      (localOwnedByDifferentUser ||
        !hasMeaningfulProgress(state) ||
        getTimestampValue(remoteUpdatedAt || remoteState.updatedAt) >
          getTimestampValue(state.updatedAt));

    if (shouldUseRemoteState && remoteState) {
      replaceState(
        {
          ...remoteState,
          updatedAt: remoteUpdatedAt || remoteState.updatedAt,
          cloudOwnerUserId: userId,
        },
        { touch: false, skipCloud: true }
      );
      renderAll();
    } else if (!remoteState && localOwnedByDifferentUser) {
      replaceState(
        createDefaultState({
          cloudOwnerUserId: userId,
        }),
        { touch: false, skipCloud: true }
      );
      renderAll();
    } else {
      state.cloudOwnerUserId = userId;
      persistState(state, { touch: false, skipCloud: true });
    }

    cloudStateReady = true;
    cloudStateUserId = userId;

    if (!remoteState || !shouldUseRemoteState) {
      await syncCloudStateToServer();
    } else {
      setCloudStatus("Cloud save synced.", "online");
    }
  } catch (error) {
    console.error("Failed to load Terra Tread cloud save:", error);
    cloudStateReady = false;
    cloudStateUserId = "";
    setCloudStatus("Cloud saves are unavailable while the backend is offline.", "offline");
  } finally {
    cloudSyncInFlight = false;
  }
}

async function claimReward(reward) {
  const { userId } = getSession();
  if (!userId || !reward?.type || !reward?.dayKey) {
    return 0;
  }

  const response = await fetchWithTimeout(
    `${getGameApiBase()}/streaks/${encodeURIComponent(userId)}/claim`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: reward.type,
        dayKey: reward.dayKey,
      }),
    }
  );
  const payload = await parseResponseBody(response);

  if (payload?.summary) {
    setStreakSummary(payload.summary);
  }

  if (!response.ok) {
    throw new Error(safeText(payload.error || payload.message) || `HTTP ${response.status}`);
  }

  return Number.isFinite(payload?.reward?.steps) ? Math.max(0, Math.floor(payload.reward.steps)) : 0;
}

async function claimAvailableRewards(claimableRewards = []) {
  if (!Array.isArray(claimableRewards) || !claimableRewards.length) {
    return 0;
  }

  let grantedSteps = 0;

  for (const reward of claimableRewards) {
    try {
      grantedSteps += await claimReward(reward);
    } catch (error) {
      console.error("Failed to claim Terra Tread streak reward:", error);
    }
  }

  if (grantedSteps > 0) {
    state.availableSteps += grantedSteps;
    persistState();
    updateStepCount();
    renderBuildingOptions();
  }

  return grantedSteps;
}

function getNativeSyncSummary() {
  const nativeSteps = Number.isFinite(state.lastNativeStepTotal) ? state.lastNativeStepTotal : 0;
  return state.lastNativeStepDate
    ? `iPhone steps synced: ${nativeSteps} today`
    : "Waiting for iPhone step data";
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
      source: "ios-motion",
      syncKey: `ios-motion:${userId}:${dayKey}:${totalSteps}`,
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
    void fetchStepsFromServer({ applyEntryGrants: false });
  } catch (error) {
    console.error("Failed to sync iOS step data to the Terra Tread backend:", error);
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

async function fetchStepsFromServer({ applyEntryGrants = !IS_IOS_APP } = {}) {
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

    if (applyEntryGrants) {
      const stepSync = applyServerStepEntriesToState(state, entries);
      if (stepSync.grantedSteps > 0) {
        persistState();
        updateStepCount();
        renderBuildingOptions();
      }
    }

    if (payload?.summary && typeof payload.summary === "object") {
      setStreakSummary(payload.summary);
      await claimAvailableRewards(streakSummary.rewards.claimable);
    } else {
      setStreakSummary(createEmptyStreakSummary());
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
      selectedBuildingId,
      relocationBuildingId,
      availableSteps: state.availableSteps,
      cityLevel: currentCitySummary.level,
      prosperity: currentCitySummary.prosperity,
      nextUnlock: currentCitySummary.nextUnlock?.[0] || null,
      cityStats: currentCitySummary.stats,
      prosperityBonus: currentCitySummary.prosperityBonus,
      playerStatus: playerStatus.textContent,
      cloudStatus: cloudStatus?.textContent || "",
      streak: streakSummary.streak,
      dailyGoal: streakSummary.dailyGoal,
      contracts: {
        daily: evaluateContract(state.contracts?.daily, currentCitySummary),
        weekly: evaluateContract(state.contracts?.weekly, currentCitySummary),
      },
      canUndo: undoStack.length > 0,
      buildings: state.buildings.map((building) => ({
        id: building.id,
        type: building.type,
        row: building.row,
        col: building.col,
        level: building.level,
      })),
      treeCount: state.trees.length,
    });
}
