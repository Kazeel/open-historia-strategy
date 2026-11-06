import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPopulationTurn } from "../population.js";

const features = {
  hardcodedPopulation: { enabled: true, growthRate: 1 },
};

const makeWorld = (overrides = {}) => ({
  game: { country: "United States", round: 1 },
  countryStats: {
    "United States": { mechanic: {}, population: { total: 1000000 } },
  },
  ...overrides,
});

test("applies population growth", () => {
  const world = makeWorld();
  // total = 1000000 * 1.01 = 1010000
  const { events, world: next } = applyPopulationTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].population.total, 1010000);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].mechanicData.change, 10000);
});

test("feature off returns no changes", () => {
  const world = makeWorld();
  const offFeatures = { hardcodedPopulation: { enabled: false } };
  const { events, world: next } = applyPopulationTurn(world, offFeatures, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next, world);
});

test("negative growth shrinks population", () => {
  const world = makeWorld({
    countryStats: {
      "United States": { mechanic: {}, population: { total: 1000000 } },
    },
  });
  const negFeatures = { hardcodedPopulation: { enabled: true, growthRate: -2 } };
  const { world: next } = applyPopulationTurn(world, negFeatures, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].population.total, 980000);
});

test("small changes do not generate events", () => {
  const world = makeWorld({
    countryStats: {
      "United States": { mechanic: {}, population: { total: 500 } },
    },
  });
  // change = 500 * 0.01 = 5, below threshold of 1000
  const { events } = applyPopulationTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(events.length, 0);
});
