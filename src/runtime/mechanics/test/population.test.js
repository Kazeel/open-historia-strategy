import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPopulationTurn, applyPopulationDelta } from "../population.js";

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
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next.countryStats["United States"].mechanic.lastChange.popDelta, 10000);
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
  const { events, world: next } = applyPopulationTurn(world, negFeatures, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].population.total, 980000);
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next.countryStats["United States"].mechanic.lastChange.popDelta, -20000);
});

test("small changes are applied silently (no events)", () => {
  const world = makeWorld({
    countryStats: {
      "United States": { mechanic: {}, population: { total: 500 } },
    },
  });
  // change = 500 * 0.01 * 1 = 5
  const { events, world: next } = applyPopulationTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next.countryStats["United States"].population.total, 505);
});

test("scales growth by skip length (30 days vs 365 days)", () => {
  const world = makeWorld();
  const yearResult = applyPopulationTurn(world, features, {
    round: 1,
    date: "2025-01-01",
    spanDays: 365,
  });
  assert.strictEqual(yearResult.world.countryStats["United States"].population.total, 1010000);
  assert.strictEqual(yearResult.events.length, 0);

  const monthResult = applyPopulationTurn(world, features, {
    round: 1,
    date: "2025-01-01",
    spanDays: 30,
  });
  // 1000000 * 0.01 * 30/365 = 821.91 -> 822
  assert.strictEqual(monthResult.world.countryStats["United States"].population.total, 1000822);
  assert.strictEqual(monthResult.events.length, 0);
});

const deltaWorld = () => makeWorld({
  countryStats: {
    "United States": { mechanic: {}, population: { total: 1000000 } },
  },
});

test("applyPopulationDelta adds population", () => {
  const world = deltaWorld();
  const { events, world: next } = applyPopulationDelta(world, "United States", 50000, {
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].population.total, 1050000);
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next.countryStats["United States"].mechanic.lastChange.popDelta, 50000);
});

test("applyPopulationDelta removes population", () => {
  const world = deltaWorld();
  const { events, world: next } = applyPopulationDelta(world, "United States", -200000, {
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].population.total, 800000);
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next.countryStats["United States"].mechanic.lastChange.popDelta, -200000);
});

test("applyPopulationDelta clamps at zero", () => {
  const world = deltaWorld();
  const { events, world: next } = applyPopulationDelta(world, "United States", -2000000, {
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].population.total, 0);
  assert.strictEqual(events.length, 0);
});

test("applyPopulationDelta zero change returns world unchanged", () => {
  const world = deltaWorld();
  const { events, world: next } = applyPopulationDelta(world, "United States", 0, {
    date: "2025-01-01",
  });
  assert.strictEqual(next, world);
  assert.strictEqual(events.length, 0);
});

test("applyPopulationDelta small change applied silently", () => {
  const world = deltaWorld();
  const { events, world: next } = applyPopulationDelta(world, "United States", 500, {
    date: "2025-01-01",
  });
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next.countryStats["United States"].population.total, 1000500);
});
