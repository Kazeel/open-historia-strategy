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

export const applyPopulationTurn = (world, features, { round, date, spanDays }) => {
  const settings = populationSettings(features);
  if (!settings) return { events: [], world };

  // growthRate is "% per year"; scale by the actual skip length.
  // Defaults to one year when spanDays is unknown (direct calls / tests).
  const years = spanDays ? Math.max(0, spanDays) / 365 : 1;

  let nextWorld = world;

  for (const code of Object.keys(world.countryStats ?? {})) {
    const entry = world.countryStats[code];
    if (!entry || typeof entry !== "object") continue;

    const mechanic = entry.mechanic ?? defaultMechanicEntry();
    const popEntry = entry.population ?? {};
    const currentTotal = asNumber(popEntry.total, 1000000);

    const change = Math.round(currentTotal * settings.growthRate * years);
    const nextTotal = currentTotal + change;

    // Natural growth is silent: no engine event. Only state is recorded so
    // the AI prompt context can reference popDelta if needed.
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

  return { events: [], world: nextWorld };
};

// Apply a one-off population change to a single polity (war, epidemic, etc.).
// Silent by default; popDelta recorded so AI prompt context can reference it.
export const applyPopulationDelta = (world, code, delta, { date } = {}) => {
  const change = Math.round(Number(delta) || 0);
  if (change === 0) return { events: [], world };

  const entry = world.countryStats?.[code];
  if (!entry || typeof entry !== "object") return { events: [], world };

  const popEntry = entry.population ?? {};
  const currentTotal = asNumber(popEntry.total, 0);
  const nextTotal = Math.max(0, currentTotal + change);

  let nextWorld = mergeIntoCountryStats(world, code, {
    lastChange: {
      ...(entry.mechanic?.lastChange ?? {}),
      popDelta: change,
    },
  });
  const popStats = { ...(nextWorld.countryStats[code]?.population ?? {}) };
  popStats.total = nextTotal;
  nextWorld = {
    ...nextWorld,
    countryStats: {
      ...nextWorld.countryStats,
      [code]: { ...nextWorld.countryStats[code], population: popStats },
    },
  };

  return { events: [], world: nextWorld };
};

// Move population from one polity to another (net zero globally).
// Clamps source at zero: cannot migrate more than the source has.
// Silent by default — the AI narrates the move; popDelta is recorded per polity.
export const applyPopulationMigration = (world, sourceCode, targetCode, amount, { date } = {}) => {
  const change = Math.round(Number(amount) || 0);
  if (change === 0 || sourceCode === targetCode) return { events: [], world };

  const sourceEntry = world.countryStats?.[sourceCode];
  const targetEntry = world.countryStats?.[targetCode];
  if (!sourceEntry || typeof sourceEntry !== "object" || !targetEntry || typeof targetEntry !== "object") {
    return { events: [], world };
  }

  const sourcePopEntry = sourceEntry.population ?? {};
  const sourceCurrent = asNumber(sourcePopEntry.total, 0);
  const actualChange = Math.min(change, sourceCurrent);
  if (actualChange <= 0) return { events: [], world };

  const sourceNextTotal = sourceCurrent - actualChange;
  const targetPopEntry = targetEntry.population ?? {};
  const targetCurrent = asNumber(targetPopEntry.total, 0);
  const targetNextTotal = targetCurrent + actualChange;

  let nextWorld = mergeIntoCountryStats(world, sourceCode, {
    lastChange: {
      ...(sourceEntry.mechanic?.lastChange ?? {}),
      popDelta: -actualChange,
    },
    updatedRound: sourceEntry.mechanic?.updatedRound ?? 0,
  });
  nextWorld = mergeIntoCountryStats(nextWorld, targetCode, {
    lastChange: {
      ...(targetEntry.mechanic?.lastChange ?? {}),
      popDelta: actualChange,
    },
    updatedRound: targetEntry.mechanic?.updatedRound ?? 0,
  });

  const sourcePopStats = { ...(nextWorld.countryStats[sourceCode]?.population ?? {}) };
  sourcePopStats.total = sourceNextTotal;
  nextWorld = {
    ...nextWorld,
    countryStats: {
      ...nextWorld.countryStats,
      [sourceCode]: { ...nextWorld.countryStats[sourceCode], population: sourcePopStats },
    },
  };

  const targetPopStats = { ...(nextWorld.countryStats[targetCode]?.population ?? {}) };
  targetPopStats.total = targetNextTotal;
  nextWorld = {
    ...nextWorld,
    countryStats: {
      ...nextWorld.countryStats,
      [targetCode]: { ...nextWorld.countryStats[targetCode], population: targetPopStats },
    },
  };

  return { events: [], world: nextWorld };
};
