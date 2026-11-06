/*! Open Historia — hardcoded economy engine © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Deterministic per-turn economy: taxes collected, unit upkeep paid,
// treasury balance updated. Import-free except for state.js helpers.

const asArray = (value) => (Array.isArray(value) ? value : []);
const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const asText = (value) => String(value ?? "").trim();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const defaultMechanicEntry = () => ({
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

const mergeIntoCountryStats = (world, code, updates) => {
  const countryStats = { ...(world.countryStats ?? {}) };
  const entry = countryStats[code] || {};
  const nextEntry = { ...entry };
  const mechanic = { ...defaultMechanicEntry(), ...(nextEntry.mechanic ?? {}) };
  const nextMechanic = { ...mechanic, ...updates };
  nextEntry.mechanic = nextMechanic;
  countryStats[code] = nextEntry;
  return { ...world, countryStats };
};

// Read economy settings from features.
const economySettings = (features) => {
  const entry = features?.hardcodedEconomy;
  if (!entry || entry.enabled === false) return null;
  return {
    taxRate: asNumber(entry.taxRate, 20) / 100,
    upkeepPerUnit: asNumber(entry.upkeepPerUnit, 50),
  };
};

export const applyEconomyTurn = (world, features, { round, date }) => {
  const settings = economySettings(features);
  if (!settings) return { events: [], world };

  const events = [];
  let nextWorld = world;

  for (const code of Object.keys(world.countryStats ?? {})) {
    const entry = world.countryStats[code];
    if (!entry || typeof entry !== "object") continue;

    const mechanic = entry.mechanic ?? defaultMechanicEntry();
    const treasury = asNumber(mechanic.treasury, 0);
    const monthlyIncome = asNumber(mechanic.monthlyIncome, 1000);

    // Count units owned by this polity.
    const unitCount = asArray(world.units).filter(
      (u) => asText(u?.ownerCode) === code,
    ).length;

    const taxes = Math.round(monthlyIncome * settings.taxRate);
    const upkeep = unitCount * settings.upkeepPerUnit;
    const expenses = asNumber(mechanic.monthlyExpenses, 0) + upkeep;
    const delta = taxes - expenses;
    const nextTreasury = treasury + delta;

    if (Math.abs(delta) >= 10) {
      events.push({
        date,
        title: delta > 0 ? `${code} treasury grows` : `${code} treasury shrinks`,
        description: `The engine collected ${taxes} in taxes and spent ${expenses} on upkeep; treasury is now ${nextTreasury}.`,
        importance: "minor",
        kind: "world",
        tags: ["economy"],
        notable: false,
        playerRelated: code === asText(world.game?.country),
        impacts: {},
        mechanic: "economy",
        mechanicData: { code, taxes, expenses, treasury: nextTreasury, delta },
      });
    }

    nextWorld = mergeIntoCountryStats(nextWorld, code, {
      treasury: nextTreasury,
      monthlyExpenses: expenses,
      lastChange: {
        ...mechanic.lastChange,
        treasuryDelta: delta,
      },
      updatedRound: round,
    });
  }

  return { events, world: nextWorld };
};
