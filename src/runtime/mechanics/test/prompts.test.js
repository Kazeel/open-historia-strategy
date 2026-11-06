import { test } from "node:test";
import assert from "node:assert/strict";
import { mechanicPromptText, mechanicSummaryForPolity, getMechanicEntry } from "../prompts.js";

const defaultEntry = {
  treasury: 0,
  monthlyIncome: 1000,
  monthlyExpenses: 0,
  lastChange: { treasuryDelta: 0, popDelta: 0, stabilityDrift: 0 },
  updatedRound: 0,
};

const makeWorld = (overrides = {}) => ({
  game: { country: "United States", round: 1 },
  countryStats: {
    "United States": { mechanic: { ...defaultEntry }, stability: 50, population: { total: 1000000 } },
  },
  ...overrides,
});

test("returns empty string when no mechanic state", () => {
  assert.strictEqual(mechanicPromptText({}), "");
  assert.strictEqual(mechanicPromptText(null), "");
});

test("returns mechanic summary for player polity", () => {
  const world = makeWorld({
    countryStats: {
      "United States": {
        mechanic: { ...defaultEntry, treasury: 500, monthlyIncome: 200 },
        stability: 65,
        population: { total: 1010000 },
      },
    },
  });
  const text = mechanicPromptText(world);
  assert.ok(text.includes("United States"));
  assert.ok(text.includes("treasury 500"));
  assert.ok(text.includes("stability 65/100"));
  assert.ok(text.includes("population 1010000"));
});

test("player polity is listed first", () => {
  const world = makeWorld({
    countryStats: {
      "China": { mechanic: { ...defaultEntry, treasury: 300 }, stability: 40, population: { total: 1400000000 } },
      "United States": { mechanic: { ...defaultEntry, treasury: 500 }, stability: 65, population: { total: 330000000 } },
    },
  });
  const text = mechanicPromptText(world);
  const usIndex = text.indexOf("United States");
  const chinaIndex = text.indexOf("China");
  assert.ok(usIndex < chinaIndex, "Player polity should appear first");
});

test("mechanicSummaryForPolity returns no data for missing polity", () => {
  assert.strictEqual(mechanicSummaryForPolity({}, "France"), "France: no data");
});

test("getMechanicEntry returns defaults for missing polity", () => {
  const entry = getMechanicEntry({}, "France");
  assert.strictEqual(entry.treasury, 0);
  assert.strictEqual(entry.monthlyIncome, 1000);
});
