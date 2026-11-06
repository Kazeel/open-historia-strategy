/*! Open Historia — hardcoded politics engine © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Deterministic per-turn politics: stability drifts toward baseline.
// Import-free except for state.js helpers.

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

const politicsSettings = (features) => {
  const entry = features?.hardcodedPolitics;
  if (!entry || entry.enabled === false) return null;
  return {
    stabilityBaseline: asNumber(entry.stabilityBaseline, 50),
  };
};

export const applyPoliticsTurn = (world, features, { round, date }) => {
  const settings = politicsSettings(features);
  if (!settings) return { events: [], world };

  const events = [];
  let nextWorld = world;

  for (const code of Object.keys(world.countryStats ?? {})) {
    const entry = world.countryStats[code];
    if (!entry || typeof entry !== "object") continue;

    const mechanic = entry.mechanic ?? defaultMechanicEntry();
    const stability = asNumber(entry.stability, 50);
    const baseline = asNumber(mechanic.stabilityBaseline ?? settings.stabilityBaseline, settings.stabilityBaseline);

    // Drift 10% of the way toward baseline each turn.
    const drift = Math.round((baseline - stability) * 0.1);
    const nextStability = clamp(stability + drift, 0, 100);

    if (Math.abs(drift) >= 5) {
      events.push({
        date,
        title: drift > 0 ? `${code} stability rises` : `${code} stability falls`,
        description: `Stability drifted ${drift > 0 ? "+" : ""}${drift} toward baseline ${baseline}; now ${nextStability}/100.`,
        importance: "minor",
        kind: "world",
        tags: ["politics"],
        notable: false,
        playerRelated: code === asText(world.game?.country),
        impacts: {},
        mechanic: "politics",
        mechanicData: { code, drift, stability: nextStability, baseline },
      });
    }

    nextWorld = mergeIntoCountryStats(nextWorld, code, {
      lastChange: {
        ...mechanic.lastChange,
        stabilityDrift: drift,
      },
      updatedRound: round,
    });
    // Also update stability on the entry itself
    nextWorld = {
      ...nextWorld,
      countryStats: {
        ...nextWorld.countryStats,
        [code]: { ...nextWorld.countryStats[code], stability: nextStability },
      },
    };
  }

  return { events, world: nextWorld };
};
