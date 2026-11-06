/*! Open Historia — mechanic state foundation © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Engine-owned mechanic state tracked per polity inside the existing
// world.countryStats[code] schema. This module is import-free: gameplay.js
// hands in the resolved world and feature settings, just like worldDirection.js.
//
// Each polity that has units, relations, or is the player's country gets a
// `mechanic` sub-object inside its countryStats entry:
//
//   world.countryStats[CODE].mechanic = {
//     treasury: number,           // engine-owned cash balance
//     monthlyIncome: number,      // engine-calculated tax income per turn
//     monthlyExpenses: number,    // engine-calculated upkeep + other costs
//     lastChange: {               // what changed this turn (for AI narration)
//       treasuryDelta: number,
//       popDelta: number,
//       stabilityDrift: number,
//     },
//     updatedRound: number,       // last round this was computed
//   };

const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => String(value ?? "").trim();

const MECHANIC_FEATURE_KEYS = Object.freeze([
  "hardcodedEconomy",
  "hardcodedPopulation",
  "hardcodedPolitics",
]);

const MECHANIC_DEFAULTS = Object.freeze({
  treasury: 0,
  monthlyIncome: 1000,
  monthlyExpenses: 0,
  lastChange: {
    treasuryDelta: 0,
    popDelta: 0,
    stabilityDrift: 0,
  },
  updatedRound: 0,
});

const defaultMechanicEntry = () =>
  structuredClone(MECHANIC_DEFAULTS);

// Any mechanic feature enabled?
const anyMechanicEnabled = (features) =>
  MECHANIC_FEATURE_KEYS.some((key) => {
    const entry = features?.[key];
    return entry ? entry.enabled !== false : false;
  });

// Collect every polity code that should have mechanic state tracked.
const collectPolityCodes = (world) => {
  const codes = new Set();
  const playerCode = asText(world?.game?.country);
  if (playerCode) codes.add(playerCode);

  for (const unit of asArray(world?.units)) {
    const code = asText(unit?.ownerCode);
    if (code) codes.add(code);
  }
  for (const relation of asArray(world?.relations)) {
    if (relation?.a) codes.add(asText(relation.a));
    if (relation?.b) codes.add(asText(relation.b));
  }
  for (const override of Object.values(world?.polityOverrides ?? {})) {
    if (override?.code) codes.add(asText(override.code));
  }
  return codes;
};

// Ensure every tracked polity has a mechanic entry inside countryStats.
// Returns a new world object (no mutation).
export const ensureMechanicState = (world, features) => {
  if (!anyMechanicEnabled(features)) return world;

  const codes = collectPolityCodes(world);
  if (codes.size === 0) return world;

  const nextWorld = { ...world };
  const countryStats = { ...(nextWorld.countryStats ?? {}) };

  for (const code of codes) {
    const entry = countryStats[code];
    if (!entry || typeof entry !== "object") {
      countryStats[code] = { mechanic: defaultMechanicEntry() };
      continue;
    }
    const nextEntry = { ...entry };
    if (!nextEntry.mechanic || typeof nextEntry.mechanic !== "object") {
      nextEntry.mechanic = defaultMechanicEntry();
    }
    countryStats[code] = nextEntry;
  }

  nextWorld.countryStats = countryStats;
  return nextWorld;
};

// Read the mechanic entry for a polity, returning defaults if missing.
export const getMechanicEntry = (world, code) => {
  const entry = world?.countryStats?.[code];
  if (!entry || typeof entry !== "object") return defaultMechanicEntry();
  const mechanic = entry.mechanic;
  if (!mechanic || typeof mechanic !== "object") return defaultMechanicEntry();
  return {
    treasury: Number.isFinite(Number(mechanic.treasury)) ? Number(mechanic.treasury) : 0,
    monthlyIncome:
      Number.isFinite(Number(mechanic.monthlyIncome)) ? Number(mechanic.monthlyIncome) : 1000,
    monthlyExpenses:
      Number.isFinite(Number(mechanic.monthlyExpenses)) ? Number(mechanic.monthlyExpenses) : 0,
    lastChange: {
      treasuryDelta:
        Number.isFinite(Number(mechanic.lastChange?.treasuryDelta))
          ? Number(mechanic.lastChange.treasuryDelta)
          : 0,
      popDelta:
        Number.isFinite(Number(mechanic.lastChange?.popDelta))
          ? Number(mechanic.lastChange.popDelta)
          : 0,
      stabilityDrift:
        Number.isFinite(Number(mechanic.lastChange?.stabilityDrift))
          ? Number(mechanic.lastChange.stabilityDrift)
          : 0,
    },
    updatedRound: Number.isFinite(Number(mechanic.updatedRound))
      ? Number(mechanic.updatedRound)
      : 0,
  };
};

// Simple feature-enabled check (import-free copy of the pattern in
// server/gameFeatures.js). Returns true when the feature exists and is not
// explicitly disabled.
export const isFeatureEnabled = (features, key) => {
  const entry = features?.[key];
  return entry ? entry.enabled !== false : false;
};
