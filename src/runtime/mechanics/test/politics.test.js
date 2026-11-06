import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPoliticsTurn } from "../politics.js";

const features = {
  hardcodedPolitics: { enabled: true, stabilityBaseline: 50 },
};

const makeWorld = (overrides = {}) => ({
  game: { country: "United States", round: 1 },
  countryStats: {
    "United States": { mechanic: {}, stability: 30 },
  },
  ...overrides,
});

test("drifts stability toward baseline", () => {
  const world = makeWorld();
  // stability = 30, baseline = 50, drift = (50-30)*0.1 = 2, next = 32
  const { events, world: next } = applyPoliticsTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].stability, 32);
  assert.strictEqual(events.length, 0); // drift 2 < threshold 5
});

test("larger drift generates event", () => {
  const world = makeWorld({
    countryStats: {
      "United States": { mechanic: {}, stability: 0 },
    },
  });
  // stability = 0, baseline = 50, drift = (50-0)*0.1 = 5, next = 5
  const { events, world: next } = applyPoliticsTurn(world, features, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].stability, 5);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].mechanicData.drift, 5);
});

test("feature off returns no changes", () => {
  const world = makeWorld();
  const offFeatures = { hardcodedPolitics: { enabled: false } };
  const { events, world: next } = applyPoliticsTurn(world, offFeatures, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(events.length, 0);
  assert.strictEqual(next, world);
});

test("clamps stability at 0 and 100", () => {
  const world = makeWorld({
    countryStats: {
      "United States": { mechanic: {}, stability: 5 },
    },
  });
  const highBaseline = { hardcodedPolitics: { enabled: true, stabilityBaseline: 100 } };
  // stability = 5, baseline = 100, drift = (100-5)*0.1 = 9.5 -> 10, next = 15
  const { world: next } = applyPoliticsTurn(world, highBaseline, {
    round: 1,
    date: "2025-01-01",
  });
  assert.strictEqual(next.countryStats["United States"].stability, 15);
});
