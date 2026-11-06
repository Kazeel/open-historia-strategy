/*! Open Historia — hardcoded population engine © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Deterministic per-turn population: growth/decline applied to each
// polity's total. Import-free except for state.js helpers.

const asArray = (value) => (Array.isArray(value) ? value : []);
const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const asText = (value) => String(value ?? "").trim();

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

const populationSettings = (features) => {
  const entry = features?.hardcodedPopulation;
  if (!entry || entry.enabled === false) return null;
  return {
    growthRate: asNumber(entry.growthRate, 1) / 100,
  };
};

export const applyPopulationTurn = (world, features, { round, date }) => {
  const settings = populationSettings(features);
  if (!settings) return { events: [], world };

  const events = [];
  let nextWorld = world;

  for (const code of Object.keys(world.countryStats ?? {})) {
    const entry = world.countryStats[code];
    if (!entry || typeof entry !== "object") continue;

    const mechanic = entry.mechanic ?? defaultMechanicEntry();
    const popEntry = entry.population ?? {};
    const currentTotal = asNumber(popEntry.total, 1000000);

    const change = Math.round(currentTotal * settings.growthRate);
    const nextTotal = currentTotal + change;

    if (Math.abs(change) >= 1000) {
      events.push({
        date,
        title: change > 0 ? `${code} population grows` : `${code} population shrinks`,
        description: `Population changed by ${change > 0 ? "+" : ""}${change} this turn (${settings.growthRate * 100}% rate); total is now ${nextTotal}.`,
        importance: "minor",
        kind: "world",
        tags: ["population"],
        notable: false,
        playerRelated: code === asText(world.game?.country),
        impacts: {},
        mechanic: "population",
        mechanicData: { code, change, total: nextTotal, rate: settings.growthRate },
      });
    }

    nextWorld = mergeIntoCountryStats(nextWorld, code, {
      lastChange: {
        ...mechanic.lastChange,
        popDelta: change,
      },
      updatedRound: round,
    });
    // Also update population.total on the entry itself
    const popStats = { ...(nextWorld.countryStats[code]?.population ?? {}) };
    popStats.total = nextTotal;
    nextWorld = {
      ...nextWorld,
      countryStats: {
        ...nextWorld.countryStats,
        [code]: { ...nextWorld.countryStats[code], population: popStats },
      },
    };
  }

  return { events, world: nextWorld };
};
