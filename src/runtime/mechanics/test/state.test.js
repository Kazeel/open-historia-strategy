import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureMechanicState,
  getMechanicEntry,
  isFeatureEnabled,
} from "../state.js";

const baseFeatures = {
  hardcodedEconomy: { enabled: true, taxRate: 20, upkeepPerUnit: 50 },
  hardcodedPopulation: { enabled: true, growthRate: 1 },
  hardcodedPolitics: { enabled: true, stabilityBaseline: 50 },
};

const allOffFeatures = {
  hardcodedEconomy: { enabled: false },
  hardcodedPopulation: { enabled: false },
  hardcodedPolitics: { enabled: false },
};

const makeWorld = (overrides = {}) => ({
  game: { country: "United States", round: 1 },
  countryStats: {},
  units: [{ ownerCode: "United States" }],
  relations: [],
  polityOverrides: {},
  ...overrides,
});

test("isFeatureEnabled returns true when feature is on", () => {
  assert.strictEqual(isFeatureEnabled(baseFeatures, "hardcodedEconomy"), true);
});

test("isFeatureEnabled returns false when feature is off", () => {
  assert.strictEqual(isFeatureEnabled(allOffFeatures, "hardcodedEconomy"), false);
});

test("isFeatureEnabled returns false when feature is missing", () => {
  assert.strictEqual(isFeatureEnabled({}, "hardcodedEconomy"), false);
});

test("ensureMechanicState returns world unchanged when no mechanic features enabled", () => {
  const world = makeWorld();
  const result = ensureMechanicState(world, allOffFeatures);
  assert.strictEqual(result, world);
});

test("ensureMechanicState creates mechanic entry for player polity", () => {
  const world = makeWorld();
  const result = ensureMechanicState(world, baseFeatures);
  assert.ok(result.countryStats["United States"]);
  assert.strictEqual(result.countryStats["United States"].mechanic.treasury, 0);
  assert.strictEqual(result.countryStats["United States"].mechanic.monthlyIncome, 1000);
  assert.strictEqual(result.countryStats["United States"].mechanic.monthlyExpenses, 0);
});

test("ensureMechanicState creates mechanic entry for unit-owning polity", () => {
  const world = makeWorld({
    units: [{ ownerCode: "United States" }, { ownerCode: "China" }],
    countryStats: { "United States": {}, "China": {} },
  });
  const result = ensureMechanicState(world, baseFeatures);
  assert.ok(result.countryStats["China"].mechanic);
  assert.strictEqual(result.countryStats["China"].mechanic.treasury, 0);
});

test("ensureMechanicState does not duplicate an existing mechanic entry", () => {
  const world = makeWorld({
    countryStats: {
      "United States": { mechanic: { treasury: 500, monthlyIncome: 200 } },
    },
  });
  const result = ensureMechanicState(world, baseFeatures);
  assert.strictEqual(result.countryStats["United States"].mechanic.treasury, 500);
  assert.strictEqual(result.countryStats["United States"].mechanic.monthlyIncome, 200);
});

test("ensureMechanicState returns a new world object (no mutation)", () => {
  const world = makeWorld();
  const result = ensureMechanicState(world, baseFeatures);
  assert.notStrictEqual(result, world);
  assert.notStrictEqual(result.countryStats, world.countryStats);
  assert.strictEqual(world.countryStats["United States"], undefined);
});

test("getMechanicEntry returns defaults for missing polity", () => {
  const world = makeWorld();
  const entry = getMechanicEntry(world, "France");
  assert.strictEqual(entry.treasury, 0);
  assert.strictEqual(entry.monthlyIncome, 1000);
  assert.strictEqual(entry.monthlyExpenses, 0);
  assert.strictEqual(entry.lastChange.treasuryDelta, 0);
  assert.strictEqual(entry.lastChange.popDelta, 0);
  assert.strictEqual(entry.lastChange.stabilityDrift, 0);
  assert.strictEqual(entry.updatedRound, 0);
});

test("getMechanicEntry returns existing entry values", () => {
  const world = makeWorld({
    countryStats: {
      "United States": {
        mechanic: { treasury: 1234, monthlyIncome: 500, monthlyExpenses: 100, updatedRound: 3 },
      },
    },
  });
  const entry = getMechanicEntry(world, "United States");
  assert.strictEqual(entry.treasury, 1234);
  assert.strictEqual(entry.monthlyIncome, 500);
  assert.strictEqual(entry.monthlyExpenses, 100);
  assert.strictEqual(entry.updatedRound, 3);
});
