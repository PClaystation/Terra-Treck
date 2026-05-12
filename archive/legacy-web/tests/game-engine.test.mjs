import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBuildAction,
  applyDemolishAction,
  applyMoveAction,
  applyNativeStepSnapshotToState,
  applyResetAction,
  applyServerStepEntriesToState,
  applyUpgradeAction,
  canPlaceBuilding,
  claimContractRewardInState,
  computeCitySummary,
  createDefaultState,
} from "../app/game-engine.mjs";

function createState(overrides = {}) {
  return createDefaultState(
    {
      availableSteps: 1000,
      trees: [],
      buildings: [],
      contracts: {
        daily: {
          slot: "daily",
          cycleKey: "2026-05-08",
          templateId: "",
          title: "",
          description: "",
          metricKey: "",
          rewardSteps: 0,
          startValue: 0,
          targetDelta: 0,
          targetValue: 0,
          claimed: false,
        },
        weekly: {
          slot: "weekly",
          cycleKey: "week-of-2026-05-04",
          templateId: "",
          title: "",
          description: "",
          metricKey: "",
          rewardSteps: 0,
          startValue: 0,
          targetDelta: 0,
          targetValue: 0,
          claimed: false,
        },
      },
      ...overrides,
    },
    { treeFactory: () => [] }
  );
}

test("computeCitySummary applies base effects and adjacency synergies", () => {
  const state = createState({
    buildings: [
      { id: "b-1", type: "house", row: 0, col: 0, level: 1 },
      { id: "b-2", type: "park", row: 0, col: 1, level: 1 },
    ],
  });

  const summary = computeCitySummary(state.buildings);

  assert.equal(summary.level, 2);
  assert.equal(summary.stats.population, 6);
  assert.equal(summary.stats.happiness, 9);
  assert.equal(summary.stats.ecology, 5);
  assert.equal(summary.prosperityBonus, 4);
  assert.equal(summary.triggeredSynergies, 2);
});

test("canPlaceBuilding rejects occupied and out-of-bounds placements", () => {
  const state = createState({
    buildings: [{ id: "b-1", type: "house", row: 0, col: 0, level: 1 }],
  });

  const occupied = canPlaceBuilding(state.buildings, "park", 0, 0);
  const outOfBounds = canPlaceBuilding(state.buildings, "market", 19, 18);

  assert.equal(occupied.ok, false);
  assert.equal(occupied.reason, "occupied");
  assert.equal(outOfBounds.ok, false);
  assert.equal(outOfBounds.reason, "out-of-bounds");
});

test("applyBuildAction spends steps, assigns ids, and clears trees on the footprint", () => {
  const state = createState({
    trees: [
      { row: 1, col: 1, imageIndex: 0 },
      { row: 5, col: 5, imageIndex: 1 },
    ],
  });

  const result = applyBuildAction(state, {
    buildingType: "house",
    row: 1,
    col: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(state.availableSteps, 900);
  assert.equal(state.nextBuildingId, 2);
  assert.deepEqual(state.buildings[0], {
    id: "b-1",
    type: "house",
    row: 1,
    col: 1,
    level: 1,
  });
  assert.deepEqual(state.trees, [{ row: 5, col: 5, imageIndex: 1 }]);
  assert.equal(state.lifetimeStats.built, 1);
});

test("applyUpgradeAction and applyDemolishAction update building state and refunds", () => {
  const state = createState({
    availableSteps: 500,
    buildings: [{ id: "b-1", type: "house", row: 0, col: 0, level: 1 }],
  });

  const upgrade = applyUpgradeAction(state, "b-1");
  const demolish = applyDemolishAction(state, "b-1");

  assert.equal(upgrade.ok, true);
  assert.equal(state.lifetimeStats.upgraded, 1);
  assert.equal(demolish.ok, true);
  assert.equal(demolish.refundSteps, 112);
  assert.equal(state.availableSteps, 552);
  assert.equal(state.buildings.length, 0);
  assert.equal(state.lifetimeStats.demolished, 1);
});

test("applyMoveAction respects occupancy and updates lifetime move count", () => {
  const state = createState({
    buildings: [
      { id: "b-1", type: "house", row: 0, col: 0, level: 1 },
      { id: "b-2", type: "house", row: 2, col: 2, level: 1 },
    ],
  });

  const blockedMove = applyMoveAction(state, { buildingId: "b-1", row: 2, col: 2 });
  const moved = applyMoveAction(state, { buildingId: "b-1", row: 1, col: 0 });

  assert.equal(blockedMove.ok, false);
  assert.equal(blockedMove.error, "occupied");
  assert.equal(moved.ok, true);
  assert.equal(state.buildings[0].row, 1);
  assert.equal(state.buildings[0].col, 0);
  assert.equal(state.lifetimeStats.moved, 1);
});

test("claimContractRewardInState pays once for completed contracts", () => {
  const state = createState({
    availableSteps: 200,
    lifetimeStats: {
      built: 1,
      upgraded: 0,
      moved: 0,
      demolished: 0,
    },
    contracts: {
      daily: {
        slot: "daily",
        cycleKey: "2026-05-08",
        templateId: "test",
        title: "Test Daily",
        description: "Build one house.",
        metricKey: "built",
        rewardSteps: 150,
        startValue: 0,
        targetDelta: 1,
        targetValue: 1,
        claimed: false,
      },
      weekly: {
        slot: "weekly",
        cycleKey: "week-of-2026-05-04",
        templateId: "",
        title: "",
        description: "",
        metricKey: "",
        rewardSteps: 0,
        startValue: 0,
        targetDelta: 0,
        targetValue: 0,
        claimed: false,
      },
    },
  });

  const firstClaim = claimContractRewardInState(state, "daily");
  const secondClaim = claimContractRewardInState(state, "daily");

  assert.equal(firstClaim.ok, true);
  assert.equal(firstClaim.rewardSteps, 150);
  assert.equal(state.availableSteps, 350);
  assert.equal(state.contracts.daily.claimed, true);
  assert.equal(secondClaim.ok, false);
});

test("applyNativeStepSnapshotToState grants only step deltas within a day", () => {
  const state = createState({ availableSteps: 0 });

  const first = applyNativeStepSnapshotToState(state, {
    todaySteps: 1200,
    dayKey: "2026-05-08",
  });
  const second = applyNativeStepSnapshotToState(state, {
    todaySteps: 1500,
    dayKey: "2026-05-08",
  });
  const third = applyNativeStepSnapshotToState(state, {
    todaySteps: 900,
    dayKey: "2026-05-08",
  });
  const nextDay = applyNativeStepSnapshotToState(state, {
    todaySteps: 800,
    dayKey: "2026-05-09",
  });

  assert.equal(first.grantedSteps, 1200);
  assert.equal(second.grantedSteps, 300);
  assert.equal(third.grantedSteps, 0);
  assert.equal(nextDay.grantedSteps, 800);
  assert.equal(state.availableSteps, 2300);
});

test("applyServerStepEntriesToState grants only unseen server entries", () => {
  const state = createState({
    availableSteps: 0,
    lastStepTimestamp: "2026-05-08T10:00:00.000Z",
  });

  const firstSync = applyServerStepEntriesToState(state, [
    { timestamp: "2026-05-08T09:00:00.000Z", steps: 100 },
    { timestamp: "2026-05-08T10:30:00.000Z", steps: 200 },
    { timestamp: "2026-05-08T11:00:00.000Z", steps: 300 },
  ]);
  const secondSync = applyServerStepEntriesToState(state, [
    { timestamp: "2026-05-08T10:30:00.000Z", steps: 200 },
    { timestamp: "2026-05-08T11:00:00.000Z", steps: 300 },
  ]);

  assert.equal(firstSync.grantedSteps, 500);
  assert.equal(state.availableSteps, 500);
  assert.equal(state.lastStepTimestamp, "2026-05-08T11:00:00.000Z");
  assert.equal(secondSync.grantedSteps, 0);
});

test("applyResetAction refunds built value and regenerates trees", () => {
  const state = createState({
    availableSteps: 100,
    buildings: [{ id: "b-1", type: "house", row: 0, col: 0, level: 2 }],
  });

  const reset = applyResetAction(state, {
    treeFactory: () => [{ row: 3, col: 3, imageIndex: 2 }],
  });

  assert.equal(reset.ok, true);
  assert.equal(state.availableSteps, 260);
  assert.deepEqual(state.buildings, []);
  assert.deepEqual(state.trees, [{ row: 3, col: 3, imageIndex: 2 }]);
});
