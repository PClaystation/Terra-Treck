export const GRID_SIZE = 20;
export const DEFAULT_STEPS = 1000;
export const CLOUD_STATE_SCHEMA_VERSION = 2;
export const MAX_BUILDING_LEVEL = 3;
export const BUILDING_LEVEL_STEP = 0.5;
export const DEMOLISH_REFUND_RATIO = 0.7;
export const TREE_VARIANT_COUNT = 3;
export const TREE_SPAWN_CHANCE = 0.1;

export const LEVEL_THRESHOLDS = [0, 18, 42, 74, 114, 162, 218, 282, 354];
export const PROSPERITY_WEIGHTS = Object.freeze({
  population: 1,
  commerce: 2,
  happiness: 1,
  ecology: 1,
});

export const STAT_DEFINITIONS = Object.freeze({
  population: { label: "Population", shortLabel: "Pop", icon: "👥" },
  commerce: { label: "Commerce", shortLabel: "Trade", icon: "💰" },
  happiness: { label: "Happiness", shortLabel: "Joy", icon: "😊" },
  ecology: { label: "Ecology", shortLabel: "Green", icon: "🌿" },
});

export const BUILDINGS = Object.freeze({
  house: {
    label: "House",
    icon: "🏠",
    width: 1,
    height: 1,
    cost: 100,
    unlockLevel: 1,
    baseEffects: { population: 6, happiness: 1 },
    synergies: [
      {
        with: "park",
        effects: { happiness: 2 },
        label: "+2 Joy next to Parks",
      },
      {
        with: "shop",
        effects: { commerce: 1 },
        label: "+1 Trade next to Shops",
      },
    ],
  },
  park: {
    label: "Park",
    icon: "🌳",
    width: 2,
    height: 2,
    cost: 150,
    unlockLevel: 2,
    baseEffects: { happiness: 5, ecology: 4 },
    synergies: [
      {
        with: "house",
        effects: { happiness: 1, ecology: 1 },
        label: "+1 Joy and +1 Green next to Houses",
      },
      {
        with: "plaza",
        effects: { commerce: 1 },
        label: "+1 Trade next to Plazas",
      },
    ],
  },
  shop: {
    label: "Shop",
    icon: "🏪",
    width: 2,
    height: 1,
    cost: 200,
    unlockLevel: 3,
    baseEffects: { commerce: 6, population: 1 },
    synergies: [
      {
        with: "house",
        effects: { commerce: 2 },
        label: "+2 Trade next to Houses",
      },
      {
        with: "plaza",
        effects: { commerce: 1, happiness: 1 },
        label: "+1 Trade and +1 Joy next to Plazas",
      },
    ],
  },
  plaza: {
    label: "Plaza",
    icon: "🏛️",
    width: 1,
    height: 2,
    cost: 260,
    unlockLevel: 4,
    baseEffects: { happiness: 4, commerce: 2 },
    synergies: [
      {
        with: "house",
        effects: { happiness: 2 },
        label: "+2 Joy next to Houses",
      },
      {
        with: "park",
        effects: { happiness: 1, ecology: 1 },
        label: "+1 Joy and +1 Green next to Parks",
      },
    ],
  },
  orchard: {
    label: "Orchard",
    icon: "🍊",
    width: 2,
    height: 2,
    cost: 240,
    unlockLevel: 5,
    baseEffects: { population: 1, happiness: 2, ecology: 6 },
    synergies: [
      {
        with: "house",
        effects: { happiness: 1 },
        label: "+1 Joy next to Houses",
      },
      {
        with: "market",
        effects: { commerce: 2 },
        label: "+2 Trade next to Markets",
      },
      {
        with: "park",
        effects: { ecology: 1 },
        label: "+1 Green next to Parks",
      },
    ],
  },
  school: {
    label: "School",
    icon: "🏫",
    width: 2,
    height: 2,
    cost: 300,
    unlockLevel: 5,
    baseEffects: { population: 4, happiness: 3 },
    synergies: [
      {
        with: "house",
        effects: { population: 1, happiness: 1 },
        label: "+1 Pop and +1 Joy next to Houses",
      },
      {
        with: "library",
        effects: { happiness: 2 },
        label: "+2 Joy next to Libraries",
      },
      {
        with: "plaza",
        effects: { commerce: 1 },
        label: "+1 Trade next to Plazas",
      },
    ],
  },
  market: {
    label: "Market",
    icon: "🧺",
    width: 3,
    height: 1,
    cost: 340,
    unlockLevel: 6,
    baseEffects: { commerce: 8, happiness: 2 },
    synergies: [
      {
        with: "shop",
        effects: { commerce: 2 },
        label: "+2 Trade next to Shops",
      },
      {
        with: "orchard",
        effects: { commerce: 2, happiness: 1 },
        label: "+2 Trade and +1 Joy next to Orchards",
      },
      {
        with: "plaza",
        effects: { happiness: 1 },
        label: "+1 Joy next to Plazas",
      },
    ],
  },
  library: {
    label: "Library",
    icon: "📚",
    width: 1,
    height: 2,
    cost: 280,
    unlockLevel: 7,
    baseEffects: { population: 2, happiness: 5 },
    synergies: [
      {
        with: "school",
        effects: { population: 2 },
        label: "+2 Pop next to Schools",
      },
      {
        with: "house",
        effects: { happiness: 1 },
        label: "+1 Joy next to Houses",
      },
      {
        with: "park",
        effects: { ecology: 1 },
        label: "+1 Green next to Parks",
      },
    ],
  },
  workshop: {
    label: "Workshop",
    icon: "⚙️",
    width: 2,
    height: 1,
    cost: 380,
    unlockLevel: 8,
    baseEffects: { population: 3, commerce: 5 },
    synergies: [
      {
        with: "shop",
        effects: { commerce: 2 },
        label: "+2 Trade next to Shops",
      },
      {
        with: "market",
        effects: { commerce: 1 },
        label: "+1 Trade next to Markets",
      },
      {
        with: "school",
        effects: { population: 1 },
        label: "+1 Pop next to Schools",
      },
    ],
  },
});

export const BUILDING_CLASS_NAMES = Object.keys(BUILDINGS);

export const CONTRACT_SLOT_LABELS = Object.freeze({
  daily: "Daily",
  weekly: "Weekly",
});

export const CONTRACT_METRIC_LABELS = Object.freeze({
  built: "buildings",
  upgraded: "upgrades",
  moved: "moves",
  prosperity: "prosperity",
  commerce: "trade",
  happiness: "joy",
  ecology: "green",
  cityLevel: "levels",
});

const DAILY_CONTRACT_TEMPLATES = Object.freeze([
  {
    id: "builder-sprint",
    title: "Builder Sprint",
    isAvailable: ({ hasOpenPlot }) => hasOpenPlot,
    create: ({ summary }) => {
      const targetDelta = summary.level >= 5 ? 3 : 2;
      return {
        metricKey: "built",
        targetDelta,
        rewardSteps: 150 + Math.max(0, summary.level - 1) * 10,
        description: `Place ${targetDelta} new buildings today.`,
      };
    },
  },
  {
    id: "upgrade-push",
    title: "Upgrade Push",
    isAvailable: ({ summary }) => summary.buildingCount > 0,
    create: ({ summary }) => ({
      metricKey: "upgraded",
      targetDelta: 1,
      rewardSteps: 165 + Math.max(0, summary.level - 1) * 8,
      description: "Upgrade 1 building today.",
    }),
  },
  {
    id: "joy-drive",
    title: "Joy Drive",
    isAvailable: () => true,
    create: ({ summary }) => {
      const targetDelta = summary.level >= 4 ? 8 : 6;
      return {
        metricKey: "happiness",
        targetDelta,
        rewardSteps: 170,
        description: `Gain ${targetDelta} Happiness today.`,
      };
    },
  },
  {
    id: "green-sweep",
    title: "Green Sweep",
    isAvailable: () => true,
    create: ({ summary }) => {
      const targetDelta = summary.level >= 4 ? 10 : 7;
      return {
        metricKey: "ecology",
        targetDelta,
        rewardSteps: 170,
        description: `Gain ${targetDelta} Ecology today.`,
      };
    },
  },
  {
    id: "reshuffle",
    title: "Reshuffle",
    isAvailable: ({ summary }) => summary.buildingCount > 0,
    create: ({ summary }) => ({
      metricKey: "moved",
      targetDelta: 1,
      rewardSteps: 145 + Math.max(0, summary.level - 1) * 6,
      description: "Move 1 building to a better plot.",
    }),
  },
]);

const WEEKLY_CONTRACT_TEMPLATES = Object.freeze([
  {
    id: "district-plan",
    title: "District Plan",
    isAvailable: ({ hasOpenPlot }) => hasOpenPlot,
    create: ({ summary }) => {
      const targetDelta = summary.level >= 6 ? 7 : 5;
      return {
        metricKey: "built",
        targetDelta,
        rewardSteps: 420 + Math.max(0, summary.level - 1) * 20,
        description: `Place ${targetDelta} new buildings this week.`,
      };
    },
  },
  {
    id: "renovation-week",
    title: "Renovation Week",
    isAvailable: ({ summary }) => summary.buildingCount > 0,
    create: ({ summary }) => {
      const targetDelta = summary.level >= 6 ? 4 : 3;
      return {
        metricKey: "upgraded",
        targetDelta,
        rewardSteps: 470 + Math.max(0, summary.level - 1) * 18,
        description: `Upgrade ${targetDelta} buildings this week.`,
      };
    },
  },
  {
    id: "prosperity-drive",
    title: "Prosperity Drive",
    isAvailable: () => true,
    create: ({ summary }) => {
      const targetDelta = summary.level >= 6 ? 55 : 38;
      return {
        metricKey: "prosperity",
        targetDelta,
        rewardSteps: 520,
        description: `Grow city prosperity by ${targetDelta} this week.`,
      };
    },
  },
  {
    id: "trade-wave",
    title: "Trade Wave",
    isAvailable: () => true,
    create: ({ summary }) => {
      const targetDelta = summary.level >= 6 ? 24 : 16;
      return {
        metricKey: "commerce",
        targetDelta,
        rewardSteps: 480,
        description: `Gain ${targetDelta} Commerce this week.`,
      };
    },
  },
  {
    id: "city-lift",
    title: "City Lift",
    isAvailable: ({ summary }) => summary.level < LEVEL_THRESHOLDS.length,
    create: ({ summary }) => ({
      metricKey: "cityLevel",
      targetDelta: 1,
      rewardSteps: 560 + Math.max(0, summary.level - 1) * 20,
      description: "Reach the next city level this week.",
    }),
  },
]);

export function safeText(value) {
  return String(value || "").trim();
}

export function normalizeIsoTimestamp(value) {
  const text = safeText(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeDayKey(value) {
  const text = safeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function normalizeCoordinate(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function normalizeBuildingLevel(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_BUILDING_LEVEL, Math.floor(parsed)));
}

export function createInitialTrees({
  gridSize = GRID_SIZE,
  imageCount = TREE_VARIANT_COUNT,
  treeChance = TREE_SPAWN_CHANCE,
  random = Math.random,
} = {}) {
  const trees = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (random() < treeChance) {
        trees.push({
          row,
          col,
          imageIndex: Math.floor(random() * imageCount),
        });
      }
    }
  }

  return trees;
}

export function createDefaultLifetimeStats() {
  return {
    built: 0,
    upgraded: 0,
    moved: 0,
    demolished: 0,
  };
}

export function normalizeLifetimeStats(source = {}) {
  const fallback = createDefaultLifetimeStats();
  Object.keys(fallback).forEach((key) => {
    const value = Number(source?.[key]);
    fallback[key] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  });
  return fallback;
}

export function createEmptyContractRecord(slot = "") {
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

export function createDefaultContractsState() {
  return {
    daily: createEmptyContractRecord("daily"),
    weekly: createEmptyContractRecord("weekly"),
  };
}

export function normalizeContractRecord(source = {}, slot = "") {
  return {
    slot,
    cycleKey: safeText(source?.cycleKey),
    templateId: safeText(source?.templateId),
    title: safeText(source?.title),
    description: safeText(source?.description),
    metricKey: safeText(source?.metricKey),
    rewardSteps: Number.isFinite(source?.rewardSteps)
      ? Math.max(0, Math.floor(source.rewardSteps))
      : 0,
    startValue: Number.isFinite(source?.startValue) ? Number(source.startValue) : 0,
    targetDelta: Number.isFinite(source?.targetDelta) ? Math.max(0, Number(source.targetDelta)) : 0,
    targetValue: Number.isFinite(source?.targetValue) ? Number(source.targetValue) : 0,
    claimed: source?.claimed === true,
  };
}

export function normalizeContractsState(source = {}) {
  return {
    daily: normalizeContractRecord(source?.daily, "daily"),
    weekly: normalizeContractRecord(source?.weekly, "weekly"),
  };
}

export function sanitizeTrees(
  source,
  { gridSize = GRID_SIZE, treeVariantCount = TREE_VARIANT_COUNT } = {}
) {
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
        row >= gridSize ||
        col >= gridSize ||
        imageIndex < 0 ||
        imageIndex >= treeVariantCount
      ) {
        return null;
      }

      return { row, col, imageIndex };
    })
    .filter(Boolean);
}

export function createDefaultState(
  overrides = {},
  { treeFactory = () => createInitialTrees() } = {}
) {
  return {
    schemaVersion: CLOUD_STATE_SCHEMA_VERSION,
    availableSteps: DEFAULT_STEPS,
    lastStepTimestamp: null,
    lastNativeStepDate: null,
    lastNativeStepTotal: 0,
    lastUploadedNativeUserId: null,
    lastUploadedNativeDayKey: null,
    lastUploadedNativeStepTotal: 0,
    buildings: [],
    nextBuildingId: 1,
    trees: treeFactory(),
    lifetimeStats: createDefaultLifetimeStats(),
    contracts: createDefaultContractsState(),
    updatedAt: null,
    cloudOwnerUserId: null,
    ...overrides,
  };
}

export function getNextBuildingSequence(buildings = []) {
  let highest = 0;

  if (Array.isArray(buildings)) {
    buildings.forEach((building) => {
      const match = safeText(building?.id).match(/^b-(\d+)$/i);
      if (!match) {
        return;
      }

      highest = Math.max(highest, Number(match[1]) || 0);
    });
  }

  return highest + 1;
}

export function sanitizeBuildings(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  const usedIds = new Set();

  return source
    .map((building, index) => {
      const type = safeText(building?.type);
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

      let id = safeText(building?.id) || `legacy-${index + 1}`;
      while (usedIds.has(id)) {
        id = `${id}-${index + 1}`;
      }
      usedIds.add(id);

      return { id, type, row, col, level };
    })
    .filter(Boolean);
}

export function normalizeStatePayload(
  source = {},
  fallbackState = createDefaultState(),
  options = {}
) {
  const normalizedBuildings = sanitizeBuildings(source?.buildings);
  const normalizedTrees = sanitizeTrees(source?.trees, options);
  const hasExplicitTreeState = Array.isArray(source?.trees);
  const fallbackNextBuildingId = getNextBuildingSequence(normalizedBuildings);

  return {
    schemaVersion: CLOUD_STATE_SCHEMA_VERSION,
    availableSteps: Number.isFinite(source?.availableSteps)
      ? Math.max(0, Math.floor(source.availableSteps))
      : fallbackState.availableSteps,
    lastStepTimestamp: normalizeIsoTimestamp(source?.lastStepTimestamp),
    lastNativeStepDate: normalizeDayKey(source?.lastNativeStepDate),
    lastNativeStepTotal: Number.isFinite(source?.lastNativeStepTotal)
      ? Math.max(0, Math.floor(source.lastNativeStepTotal))
      : 0,
    lastUploadedNativeUserId: safeText(source?.lastUploadedNativeUserId) || null,
    lastUploadedNativeDayKey: normalizeDayKey(source?.lastUploadedNativeDayKey),
    lastUploadedNativeStepTotal: Number.isFinite(source?.lastUploadedNativeStepTotal)
      ? Math.max(0, Math.floor(source.lastUploadedNativeStepTotal))
      : 0,
    buildings: normalizedBuildings,
    nextBuildingId: Number.isFinite(source?.nextBuildingId)
      ? Math.max(Math.floor(source.nextBuildingId), fallbackNextBuildingId)
      : fallbackNextBuildingId,
    trees: hasExplicitTreeState ? normalizedTrees : fallbackState.trees,
    lifetimeStats: normalizeLifetimeStats(source?.lifetimeStats),
    contracts: normalizeContractsState(source?.contracts),
    updatedAt: normalizeIsoTimestamp(source?.updatedAt),
    cloudOwnerUserId: safeText(source?.cloudOwnerUserId) || null,
  };
}

export function getSerializableState(source, options = {}) {
  return normalizeStatePayload(source, createDefaultState({}, options), options);
}

export function hasMeaningfulProgress(source = {}) {
  return Boolean(
    (Array.isArray(source?.buildings) && source.buildings.length) ||
      Number(source?.availableSteps) !== DEFAULT_STEPS ||
      safeText(source?.lastStepTimestamp) ||
      safeText(source?.lastNativeStepDate) ||
      Number(source?.lastNativeStepTotal) > 0 ||
      Number(source?.lifetimeStats?.built) > 0 ||
      Number(source?.lifetimeStats?.upgraded) > 0 ||
      Number(source?.lifetimeStats?.moved) > 0 ||
      Number(source?.lifetimeStats?.demolished) > 0
  );
}

export function getTimestampValue(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getBuildingEntries() {
  return Object.entries(BUILDINGS).sort(
    (left, right) => left[1].unlockLevel - right[1].unlockLevel
  );
}

export function createEffectTotals() {
  return {
    population: 0,
    commerce: 0,
    happiness: 0,
    ecology: 0,
  };
}

export function cloneEffectTotals(source = {}) {
  const totals = createEffectTotals();
  Object.keys(STAT_DEFINITIONS).forEach((stat) => {
    const value = Number(source?.[stat]);
    totals[stat] = Number.isFinite(value) ? value : 0;
  });
  return totals;
}

export function addEffectTotals(target, source = {}, multiplier = 1) {
  Object.keys(STAT_DEFINITIONS).forEach((stat) => {
    const value = Number(source?.[stat]);
    if (Number.isFinite(value)) {
      target[stat] += value * multiplier;
    }
  });
  return target;
}

export function formatEffectList(effects = {}, { short = false } = {}) {
  return Object.entries(STAT_DEFINITIONS)
    .map(([stat, definition]) => {
      const value = Number(effects?.[stat]);
      if (!Number.isFinite(value) || value <= 0) {
        return "";
      }

      return `+${value} ${short ? definition.shortLabel : definition.label}`;
    })
    .filter(Boolean)
    .join(" • ");
}

export function getProsperityForStats(stats = createEffectTotals()) {
  return Object.entries(PROSPERITY_WEIGHTS).reduce((total, [stat, weight]) => {
    const value = Number(stats?.[stat]);
    return total + (Number.isFinite(value) ? value * weight : 0);
  }, 0);
}

export function getLevelForProsperity(prosperity = 0) {
  let level = 1;

  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (prosperity >= threshold) {
      level = index + 1;
    }
  });

  return level;
}

export function getCurrentLevelThreshold(level) {
  return LEVEL_THRESHOLDS[Math.max(0, level - 1)] || 0;
}

export function getNextLevelThreshold(level) {
  return LEVEL_THRESHOLDS[level] || null;
}

export function getNextUnlockForLevel(level) {
  return getBuildingEntries().find(([, definition]) => definition.unlockLevel > level) || null;
}

export function createEmptyCitySummary() {
  return {
    level: 1,
    prosperity: 0,
    currentLevelThreshold: 0,
    nextLevelThreshold: LEVEL_THRESHOLDS[1] || null,
    progressPercent: 0,
    stats: createEffectTotals(),
    baseTotals: createEffectTotals(),
    synergyTotals: createEffectTotals(),
    prosperityBonus: 0,
    unlockedBuildings: ["house"],
    nextUnlock: getNextUnlockForLevel(1),
    buildingCount: 0,
    triggeredSynergies: 0,
    breakdown: [],
  };
}

export function getBuildingMaxLevel(buildingType) {
  const definition = BUILDINGS[buildingType];
  if (!definition) {
    return MAX_BUILDING_LEVEL;
  }

  return Number.isFinite(definition.maxLevel)
    ? Math.max(1, Math.floor(definition.maxLevel))
    : MAX_BUILDING_LEVEL;
}

export function getBuildingLevelMultiplier(level = 1) {
  return 1 + Math.max(0, normalizeBuildingLevel(level) - 1) * BUILDING_LEVEL_STEP;
}

export function scaleEffectTotals(source = {}, multiplier = 1) {
  const scaled = createEffectTotals();
  Object.keys(STAT_DEFINITIONS).forEach((stat) => {
    const value = Number(source?.[stat]);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    scaled[stat] = Math.max(1, Math.round(value * multiplier));
  });
  return scaled;
}

export function getUpgradeCost(building) {
  const definition = BUILDINGS[building?.type];
  if (!definition) {
    return 0;
  }

  const level = normalizeBuildingLevel(building?.level);
  if (level >= getBuildingMaxLevel(building?.type)) {
    return 0;
  }

  const multiplier = 0.6 + (level - 1) * 0.35;
  return Math.max(10, Math.round(definition.cost * multiplier));
}

export function getBuildingTotalInvestment(building) {
  const definition = BUILDINGS[building?.type];
  if (!definition) {
    return 0;
  }

  const level = normalizeBuildingLevel(building?.level);
  let total = definition.cost;

  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += getUpgradeCost({ type: building.type, level: currentLevel });
  }

  return total;
}

export function getFootprintTilesForBuilding(building) {
  const definition = BUILDINGS[building?.type];
  if (!definition) {
    return [];
  }

  const tiles = [];
  for (let rowOffset = 0; rowOffset < definition.height; rowOffset += 1) {
    for (let colOffset = 0; colOffset < definition.width; colOffset += 1) {
      tiles.push({
        row: building.row + rowOffset,
        col: building.col + colOffset,
      });
    }
  }

  return tiles;
}

export function buildOccupancyMap(buildings) {
  const occupancy = new Map();
  sanitizeBuildings(buildings).forEach((building, index) => {
    getFootprintTilesForBuilding(building).forEach(({ row, col }) => {
      occupancy.set(`${row},${col}`, index);
    });
  });
  return occupancy;
}

export function computeCitySummary(buildings = []) {
  const normalizedBuildings = sanitizeBuildings(buildings);
  const stats = createEffectTotals();
  const baseTotals = createEffectTotals();
  const synergyTotals = createEffectTotals();
  const adjacency = normalizedBuildings.map(() => new Set());
  const occupancy = buildOccupancyMap(normalizedBuildings);
  let triggeredSynergies = 0;

  normalizedBuildings.forEach((building, index) => {
    getFootprintTilesForBuilding(building).forEach(({ row, col }) => {
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].forEach(([rowDelta, colDelta]) => {
        const neighborIndex = occupancy.get(`${row + rowDelta},${col + colDelta}`);
        if (neighborIndex !== undefined && neighborIndex !== index) {
          adjacency[index].add(neighborIndex);
        }
      });
    });
  });

  const breakdown = normalizedBuildings.map((building, index) => {
    const definition = BUILDINGS[building.type];
    const levelMultiplier = getBuildingLevelMultiplier(building.level);
    const scaledBaseEffects = scaleEffectTotals(definition.baseEffects, levelMultiplier);
    const totalEffects = cloneEffectTotals(scaledBaseEffects);
    const synergyDetails = [];

    addEffectTotals(baseTotals, scaledBaseEffects);

    definition.synergies.forEach((rule) => {
      const matchingNeighborCount = Array.from(adjacency[index]).filter(
        (neighborIndex) => normalizedBuildings[neighborIndex]?.type === rule.with
      ).length;

      if (!matchingNeighborCount) {
        return;
      }

      const bonus = scaleEffectTotals(rule.effects, levelMultiplier);
      addEffectTotals(bonus, bonus, matchingNeighborCount - 1);
      addEffectTotals(totalEffects, bonus);
      addEffectTotals(synergyTotals, bonus);
      triggeredSynergies += matchingNeighborCount;
      synergyDetails.push({
        with: rule.with,
        count: matchingNeighborCount,
        effects: bonus,
        label: rule.label,
      });
    });

    addEffectTotals(stats, totalEffects);

    return {
      id: building.id,
      type: building.type,
      row: building.row,
      col: building.col,
      level: building.level,
      totalEffects,
      synergyDetails,
    };
  });

  const prosperity = getProsperityForStats(stats);
  const level = getLevelForProsperity(prosperity);
  const currentLevelThreshold = getCurrentLevelThreshold(level);
  const nextLevelThreshold = getNextLevelThreshold(level);
  const progressPercent = nextLevelThreshold
    ? Math.max(
        0,
        Math.min(
          100,
          ((prosperity - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)) *
            100
        )
      )
    : 100;

  return {
    level,
    prosperity,
    currentLevelThreshold,
    nextLevelThreshold,
    progressPercent,
    stats,
    baseTotals,
    synergyTotals,
    prosperityBonus: getProsperityForStats(synergyTotals),
    unlockedBuildings: getBuildingEntries()
      .filter(([, definition]) => level >= definition.unlockLevel)
      .map(([name]) => name),
    nextUnlock: getNextUnlockForLevel(level),
    buildingCount: normalizedBuildings.length,
    triggeredSynergies,
    breakdown,
  };
}

export function hasOpenHousePlot(buildings = []) {
  const occupancy = buildOccupancyMap(sanitizeBuildings(buildings));

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (!occupancy.has(`${row},${col}`)) {
        return true;
      }
    }
  }

  return false;
}

export function formatLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalWeekCycleKey(date = new Date()) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  const dayOffset = (localDate.getDay() + 6) % 7;
  localDate.setDate(localDate.getDate() - dayOffset);
  return `week-of-${formatLocalDayKey(localDate)}`;
}

export function getContractCycleKey(slot, date = new Date()) {
  return slot === "weekly" ? getLocalWeekCycleKey(date) : formatLocalDayKey(date);
}

export function hashText(value = "") {
  return Array.from(String(value)).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 2147483647,
    7
  );
}

export function getContractMetricValue(metricKey, state = {}, summary = createEmptyCitySummary()) {
  switch (metricKey) {
    case "built":
    case "upgraded":
    case "moved":
    case "demolished":
      return Number(state?.lifetimeStats?.[metricKey]) || 0;
    case "prosperity":
      return Number(summary?.prosperity) || 0;
    case "cityLevel":
      return Number(summary?.level) || 1;
    case "commerce":
    case "happiness":
    case "ecology":
    case "population":
      return Number(summary?.stats?.[metricKey]) || 0;
    default:
      return 0;
  }
}

export function pickContractTemplate(
  slot,
  state = {},
  summary = createEmptyCitySummary(),
  date = new Date()
) {
  const templates = slot === "weekly" ? WEEKLY_CONTRACT_TEMPLATES : DAILY_CONTRACT_TEMPLATES;
  const context = {
    slot,
    summary,
    state,
    hasOpenPlot: hasOpenHousePlot(state?.buildings),
  };
  const eligibleTemplates = templates.filter(
    (template) => !template.isAvailable || template.isAvailable(context)
  );
  const pool = eligibleTemplates.length ? eligibleTemplates : templates;
  const cycleKey = getContractCycleKey(slot, date);
  return pool[hashText(`${slot}:${cycleKey}:${summary.level}:${summary.buildingCount}`) % pool.length];
}

export function createContractForSlot(
  slot,
  state = {},
  summary = computeCitySummary(state?.buildings),
  date = new Date()
) {
  const template = pickContractTemplate(slot, state, summary, date);
  const generated = template?.create
    ? template.create({
        slot,
        summary,
        state,
        hasOpenPlot: hasOpenHousePlot(state?.buildings),
      })
    : {
        metricKey: "built",
        targetDelta: 1,
        rewardSteps: slot === "weekly" ? 400 : 120,
        description: "Place 1 new building.",
      };
  const metricKey = safeText(generated.metricKey) || "built";
  const startValue = getContractMetricValue(metricKey, state, summary);
  const targetDelta = Math.max(1, Math.floor(Number(generated.targetDelta) || 1));
  const rewardSteps = Math.max(0, Math.floor(Number(generated.rewardSteps) || 0));

  return {
    slot,
    cycleKey: getContractCycleKey(slot, date),
    templateId: safeText(template?.id) || `${slot}-fallback`,
    title: safeText(template?.title) || CONTRACT_SLOT_LABELS[slot] || "Contract",
    description: safeText(generated.description) || "Complete the contract objective.",
    metricKey,
    rewardSteps,
    startValue,
    targetDelta,
    targetValue: startValue + targetDelta,
    claimed: false,
  };
}

export function refreshContractsState(
  state = {},
  summary = computeCitySummary(state?.buildings),
  date = new Date()
) {
  const contracts = normalizeContractsState(state?.contracts);
  const nextDailyKey = getContractCycleKey("daily", date);
  const nextWeeklyKey = getContractCycleKey("weekly", date);
  let changed = false;

  if (
    contracts.daily.cycleKey !== nextDailyKey ||
    !safeText(contracts.daily.metricKey) ||
    !safeText(contracts.daily.title)
  ) {
    contracts.daily = createContractForSlot("daily", state, summary, date);
    changed = true;
  }

  if (
    contracts.weekly.cycleKey !== nextWeeklyKey ||
    !safeText(contracts.weekly.metricKey) ||
    !safeText(contracts.weekly.title)
  ) {
    contracts.weekly = createContractForSlot("weekly", state, summary, date);
    changed = true;
  }

  return {
    contracts,
    changed,
  };
}

export function evaluateContract(
  contract,
  state = {},
  summary = computeCitySummary(state?.buildings)
) {
  const normalizedContract = normalizeContractRecord(contract, safeText(contract?.slot));
  const currentValue = getContractMetricValue(normalizedContract.metricKey, state, summary);
  const targetDelta = Math.max(
    1,
    Math.floor(
      normalizedContract.targetDelta ||
        normalizedContract.targetValue - normalizedContract.startValue ||
        1
    )
  );
  const rawProgress = currentValue - normalizedContract.startValue;
  const progressValue = Math.max(0, Math.floor(rawProgress));
  const completed = normalizedContract.claimed || currentValue >= normalizedContract.targetValue;
  const displayProgressValue = normalizedContract.claimed ? targetDelta : progressValue;
  const progressPercent = normalizedContract.claimed
    ? 100
    : Math.max(0, Math.min(100, (displayProgressValue / targetDelta) * 100));

  return {
    contract: normalizedContract,
    currentValue,
    targetDelta,
    progressValue: displayProgressValue,
    completed,
    progressPercent,
    remaining: normalizedContract.claimed ? 0 : Math.max(0, targetDelta - displayProgressValue),
  };
}

export function isBuildingUnlocked(name, level = 1) {
  const definition = BUILDINGS[name];
  return Boolean(definition) && level >= definition.unlockLevel;
}

export function getBuildingIndexById(buildingId, buildings = []) {
  const normalizedId = safeText(buildingId);
  if (!normalizedId) {
    return -1;
  }

  return sanitizeBuildings(buildings).findIndex((building) => building.id === normalizedId);
}

export function findBuildingById(buildingId, buildings = []) {
  const index = getBuildingIndexById(buildingId, buildings);
  return index >= 0 ? sanitizeBuildings(buildings)[index] : null;
}

export function findBuildingAt(row, col, buildings = []) {
  return (
    sanitizeBuildings(buildings).find((building) =>
      getFootprintTilesForBuilding(building).some((tile) => tile.row === row && tile.col === col)
    ) || null
  );
}

export function createBuildingRecord(nextBuildingId, type, row, col) {
  const buildingId = `b-${Math.max(1, Math.floor(nextBuildingId || 1))}`;
  return {
    building: {
      id: buildingId,
      type,
      row,
      col,
      level: 1,
    },
    nextBuildingId: Math.max(1, Math.floor(nextBuildingId || 1)) + 1,
  };
}

export function canPlaceBuilding(
  buildings,
  buildingType,
  row,
  col,
  { ignoreBuildingId = "" } = {}
) {
  const definition = BUILDINGS[buildingType];
  if (!definition) {
    return {
      ok: false,
      reason: "unknown-building",
      tiles: [],
    };
  }

  const footprint = getFootprintTilesForBuilding({
    type: buildingType,
    row,
    col,
  });
  const isOutOfBounds = footprint.some(
    (tile) => tile.row < 0 || tile.col < 0 || tile.row >= GRID_SIZE || tile.col >= GRID_SIZE
  );

  if (isOutOfBounds) {
    return {
      ok: false,
      reason: "out-of-bounds",
      tiles: footprint,
    };
  }

  const occupancy = buildOccupancyMap(
    sanitizeBuildings(buildings).filter((building) => building.id !== safeText(ignoreBuildingId))
  );
  const blockedTile = footprint.find((tile) => occupancy.has(`${tile.row},${tile.col}`));

  if (blockedTile) {
    return {
      ok: false,
      reason: "occupied",
      tiles: footprint,
      blockedTile,
    };
  }

  return {
    ok: true,
    reason: "",
    tiles: footprint,
  };
}

export function applyBuildAction(state, { buildingType, row, col } = {}) {
  const summary = computeCitySummary(state?.buildings);
  if (!isBuildingUnlocked(buildingType, summary.level)) {
    return { ok: false, error: "locked" };
  }

  const definition = BUILDINGS[buildingType];
  if (!definition) {
    return { ok: false, error: "unknown-building" };
  }

  if ((Number(state?.availableSteps) || 0) < definition.cost) {
    return { ok: false, error: "insufficient-steps" };
  }

  const placement = canPlaceBuilding(state?.buildings, buildingType, row, col);
  if (!placement.ok) {
    return { ok: false, error: placement.reason, tiles: placement.tiles };
  }

  const next = createBuildingRecord(state?.nextBuildingId, buildingType, row, col);
  state.nextBuildingId = next.nextBuildingId;
  state.buildings.push(next.building);
  state.trees = (Array.isArray(state?.trees) ? state.trees : []).filter(
    (tree) => !placement.tiles.some((tile) => tile.row === tree.row && tile.col === tree.col)
  );
  state.availableSteps -= definition.cost;
  state.lifetimeStats = normalizeLifetimeStats(state?.lifetimeStats);
  state.lifetimeStats.built += 1;

  return {
    ok: true,
    building: next.building,
    tiles: placement.tiles,
  };
}

export function applyMoveAction(state, { buildingId, row, col } = {}) {
  const building = findBuildingById(buildingId, state?.buildings);
  if (!building) {
    return { ok: false, error: "missing-building" };
  }

  if (building.row === row && building.col === col) {
    return { ok: false, error: "same-position" };
  }

  const placement = canPlaceBuilding(state?.buildings, building.type, row, col, {
    ignoreBuildingId: buildingId,
  });
  if (!placement.ok) {
    return { ok: false, error: placement.reason, tiles: placement.tiles };
  }

  const buildingIndex = getBuildingIndexById(buildingId, state?.buildings);
  if (buildingIndex < 0) {
    return { ok: false, error: "missing-building" };
  }

  state.buildings[buildingIndex].row = row;
  state.buildings[buildingIndex].col = col;
  state.lifetimeStats = normalizeLifetimeStats(state?.lifetimeStats);
  state.lifetimeStats.moved += 1;

  return {
    ok: true,
    buildingId,
    tiles: placement.tiles,
  };
}

export function applyUpgradeAction(state, buildingId) {
  const building = findBuildingById(buildingId, state?.buildings);
  if (!building) {
    return { ok: false, error: "missing-building" };
  }

  const upgradeCost = getUpgradeCost(building);
  if (!upgradeCost) {
    return { ok: false, error: "max-level" };
  }

  if ((Number(state?.availableSteps) || 0) < upgradeCost) {
    return { ok: false, error: "insufficient-steps" };
  }

  const buildingIndex = getBuildingIndexById(buildingId, state?.buildings);
  if (buildingIndex < 0) {
    return { ok: false, error: "missing-building" };
  }

  state.buildings[buildingIndex].level = normalizeBuildingLevel(building.level + 1);
  state.availableSteps -= upgradeCost;
  state.lifetimeStats = normalizeLifetimeStats(state?.lifetimeStats);
  state.lifetimeStats.upgraded += 1;

  return {
    ok: true,
    upgradeCost,
  };
}

export function applyDemolishAction(state, buildingId) {
  const building = findBuildingById(buildingId, state?.buildings);
  if (!building) {
    return { ok: false, error: "missing-building" };
  }

  const refundSteps = Math.max(
    0,
    Math.round(getBuildingTotalInvestment(building) * DEMOLISH_REFUND_RATIO)
  );

  state.buildings = sanitizeBuildings(state?.buildings).filter(
    (currentBuilding) => currentBuilding.id !== building.id
  );
  state.availableSteps += refundSteps;
  state.lifetimeStats = normalizeLifetimeStats(state?.lifetimeStats);
  state.lifetimeStats.demolished += 1;

  return {
    ok: true,
    refundSteps,
  };
}

export function applyResetAction(state, { treeFactory = () => createInitialTrees() } = {}) {
  const refundedSteps = sanitizeBuildings(state?.buildings).reduce((total, building) => {
    return total + getBuildingTotalInvestment(building);
  }, 0);

  state.availableSteps += refundedSteps;
  state.buildings = [];
  state.trees = treeFactory();

  return {
    ok: true,
    refundedSteps,
  };
}

export function claimContractRewardInState(
  state,
  slot,
  summary = computeCitySummary(state?.buildings)
) {
  if (!["daily", "weekly"].includes(slot)) {
    return { ok: false, error: "invalid-slot" };
  }

  const contract = state?.contracts?.[slot];
  const evaluation = evaluateContract(contract, state, summary);
  if (!evaluation.completed || evaluation.contract.claimed) {
    return { ok: false, error: "not-claimable", evaluation };
  }

  state.availableSteps += evaluation.contract.rewardSteps;
  state.contracts[slot].claimed = true;
  return {
    ok: true,
    rewardSteps: evaluation.contract.rewardSteps,
    evaluation,
  };
}

export function applyNativeStepSnapshotToState(state, payload = {}) {
  const normalizedSteps = Math.max(0, Math.floor(Number(payload.todaySteps) || 0));
  const dayKey = safeText(payload.dayKey) || new Date().toISOString().slice(0, 10);
  const lastDayKey = safeText(state?.lastNativeStepDate);
  const lastTotal = Number.isFinite(state?.lastNativeStepTotal) ? state.lastNativeStepTotal : 0;
  let grantedSteps = 0;

  if (lastDayKey !== dayKey) {
    grantedSteps = normalizedSteps;
  } else if (normalizedSteps > lastTotal) {
    grantedSteps = normalizedSteps - lastTotal;
  }

  state.availableSteps += grantedSteps;
  state.lastNativeStepDate = dayKey;
  state.lastNativeStepTotal = normalizedSteps;

  return {
    grantedSteps,
    dayKey,
    totalSteps: normalizedSteps,
  };
}

export function applyServerStepEntriesToState(state, entries = []) {
  const normalizedEntries = Array.isArray(entries) ? entries.slice() : [];
  const lastKnownTime = state?.lastStepTimestamp ? new Date(state.lastStepTimestamp).getTime() : 0;
  let newestTimestamp = state?.lastStepTimestamp || null;
  let newSteps = 0;

  normalizedEntries
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
  }

  return {
    grantedSteps: newSteps,
    newestTimestamp,
  };
}
