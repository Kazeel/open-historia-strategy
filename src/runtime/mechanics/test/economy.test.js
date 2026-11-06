import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEconomyTurn } from "../economy.js";

const features = {
  hardcodedEconomy: { enabled: true, taxRate: 20, upkeepPerUnit: 50 },
};

const makeWorld = (overrides = {}) => ({
  game: { country: "United States", round: 1 },
  countryStats: {
    "United States": { mechanic: { treasury: 1000, monthlyIncome: 500 } },
  },
  units: [{ ownerCode: "United States" }],
  ...overrides,
});

test("collects taxes and pays upkeep", () => {
  const world = makeWorld();
  // treasury = 1000 + (500*0.20) - (1*50) = 1000 + 100 - 50 = 1050
  const { events, world: next } = applyEconomyTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].mechanic.treasury, 1050);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].mechanicData.treasury, 1050);
  assert.strictEqual(events[0].mechanicData.delta, 50);
});

test("feature off returns no changes", () => {
  const world = makeWorld();
  const offFeatures = { hardcodedEconomy: { enabled: false } };
  const { events, world: next } = applyEconomyTurn(world, offFeatures, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next, world);
});

test("no units means no upkeep", () => {
  const world = makeWorld({ units: [] });
  // treasury = 1000 + 100 - 0 = 1100
  const { world: next } = applyEconomyTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].mechanic.treasury, 1100);
});

test("small changes do not generate events", () => {
  const world = makeWorld({
    countryStats: {
      "United States": { mechanic: { treasury: 1000, monthlyIncome: 10 } },
    },
    units: [],
  });
  // taxes = 2, upkeep = 0, delta = 2, below threshold of 10
  const { events } = applyEconomyTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(events.length, 0);
});
