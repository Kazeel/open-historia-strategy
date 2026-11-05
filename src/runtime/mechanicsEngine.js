/*! Open Historia — hardcoded mechanics engine © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Engine-owned state tracked per polity so long-term progress does not depend on
// AI memory alone. Each turn the engine applies deterministic changes
// (taxes, upkeep, population growth, stability drift) and returns events the AI
// narrates. The AI proposes; the engine enforces.
//
// Import-free: gameplay.js passes in the resolved feature settings and world
// state, just like worldDirection.js.

const asArray = (value) => (Array.isArray(value) ? value : []);
const asText = (value) => String(value ?? "").trim();
const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// A polity's economy entry: { treasury, monthlyIncome, monthlyExpenses, lastIncome }.
const emptyEconomy = () => ({
  treasury: 0,
  monthlyIncome: 1000,
  monthlyExpenses: 0,
  lastIncome: 0,
  lastExpenses: 0,
});

// A polity's population entry: { total, growthRate, lastChange }.
const emptyPopulation = () => ({
  total: 1000000,
  growthRate: 1,
  lastChange: 0,
});

// A polity's politics entry: { stability, stabilityBaseline, politicalClout, lastChange }.
const emptyPolitics = () => ({
  stability: 50,
  stabilityBaseline: 50,
  politicalClout: 0,
  lastChange: 0,
});

// Ensure every polity with units, relations or ownership overrides has a mechanics
// entry. Polities already tracked are left alone.
export const ensureMechanicState = (world, features) => {
  const economy = isFeatureEnabled(features, "hardcodedEconomy");
  const population = isFeatureEnabled(features, "hardcodedPopulation");
  const politics = isFeatureEnabled(features, "hardcodedPolitics");
  if (!economy && !population && !politics) return world;

  const polityCodes = new Set();
  for (const unit of asArray(world?.units)) {
    const code = asText(unit?.ownerCode);
    if (code) polityCodes.add(code);
  }
  for (const relation of asArray(world?.relations)) {
    if (relation?.a) polityCodes.add(asText(relation.a));
    if (relation?.b) polityCodes.add(asText(relation.b));
  }
  for (const override of Object.values(world?.polityOverrides ?? {})) {
    if (override?.code) polityCodes.add(asText(override.code));
  }
  const playerCode = asText(world?.game?.country) || "";
  if (playerCode) polityCodes.add(playerCode);

  const nextWorld = { ...world };
  if (economy) {
    nextWorld.economy = { ...(nextWorld.economy ?? {}) };
    for (const code of polityCodes) {
      if (!nextWorld.economy[code]) nextWorld.economy[code] = emptyEconomy();
    }
  }
  if (population) {
    nextWorld.population = { ...(nextWorld.population ?? {}) };
    for (const code of polityCodes) {
      if (!nextWorld.population[code]) nextWorld.population[code] = emptyPopulation();
    }
  }
  if (politics) {
    nextWorld.politics = { ...(nextWorld.politics ?? {}) };
    for (const code of polityCodes) {
      if (!nextWorld.politics[code]) nextWorld.politics[code] = emptyPolitics();
    }
  }
  return nextWorld;
};

// Read a polity's economy, or the default.
const economyOf = (world, code) =>
  (world?.economy?.[code] ?? emptyEconomy());

// Read a polity's population, or the default.
const populationOf = (world, code) =>
  (world?.population?.[code] ?? emptyPopulation());

// Read a polity's politics, or the default.
const politicsOf = (world, code) =>
  (world?.politics?.[code] ?? emptyPolitics());

// --- Economy ---------------------------------------------------------------

// Collect taxes and pay upkeep for every polity with an economy entry.
// Returns { events, world } where events are engine-narrated economic changes.
export const applyEconomyTurn = (world, features, { round, date }) => {
  const enabled = isFeatureEnabled(features, "hardcodedEconomy");
  if (!enabled) return { events: [], world };
  const settings = features?.hardcodedEconomy ?? {};
  const taxRate = asNumber(settings.taxRate, 20) / 100;
  const upkeepPerUnit = asNumber(settings.upkeepPerUnit, 50);

  const events = [];
  const nextEconomy = { ...(world.economy ?? {}) };
  for (const [code, entry] of Object.entries(nextEconomy)) {
    const income = asNumber(entry.monthlyIncome, 1000);
    const taxes = Math.round(income * taxRate);
    const units = asArray(world?.units).filter((u) => asText(u?.ownerCode) === code).length;
    const upkeep = units * upkeepPerUnit;
    const expenses = asNumber(entry.monthlyExpenses, 0) + upkeep;
    const delta = taxes - expenses;
    const treasury = asNumber(entry.treasury, 0) + delta;

    nextEconomy[code] = {
      ...entry,
      treasury,
      monthlyExpenses: expenses,
      lastIncome: taxes,
      lastExpenses: expenses,
    };

    if (Math.abs(delta) >= 10) {
      events.push({
        date,
        title: delta > 0 ? `${code} treasury grows` : `${code} treasury shrinks`,
        description: delta > 0
          ? `The engine collected ${taxes} in taxes and spent ${expenses} on upkeep; treasury is now ${treasury}.`
          : `The engine collected ${taxes} in taxes but spent ${expenses} on upkeep; treasury is now ${treasury}.`,
        importance: "minor",
        kind: "world",
        tags: ["economy"],
        notable: false,
        playerRelated: code === (world?.game?.country ?? ""),
        impacts: {},
        mechanic: "economy",
        mechanicData: { code, taxes, expenses, treasury, delta },
      });
    }
  }
  return { events, world: { ...world, economy: nextEconomy } };
};

// --- Population ------------------------------------------------------------

export const applyPopulationTurn = (world, features, { round, date }) => {
  const enabled = isFeatureEnabled(features, "hardcodedPopulation");
  if (!enabled) return { events: [], world };
  const settings = features?.hardcodedPopulation ?? {};
  const baseGrowth = asNumber(settings.growthRate, 1) / 100;

  const events = [];
  const nextPopulation = { ...(world.population ?? {}) };
  for (const [code, entry] of Object.entries(nextPopulation)) {
    const total = asNumber(entry.total, 1000000);
    const growth = asNumber(entry.growthRate, baseGrowth);
    const change = Math.round(total * growth);
    const nextTotal = total + change;

    nextPopulation[code] = {
      ...entry,
      total: nextTotal,
      lastChange: change,
    };

    if (Math.abs(change) >= 1000) {
      events.push({
        date,
        title: change > 0 ? `${code} population grows` : `${code} population shrinks`,
        description: `Population changed by ${change > 0 ? "+" : ""}${change} this turn (${growth * 100}% rate); total is now ${nextTotal}.`,
        importance: "minor",
        kind: "world",
        tags: ["population"],
        notable: false,
        playerRelated: code === (world?.game?.country ?? ""),
        impacts: {},
        mechanic: "population",
        mechanicData: { code, change, total: nextTotal, rate: growth },
      });
    }
  }
  return { events, world: { ...world, population: nextPopulation } };
};

// --- Politics --------------------------------------------------------------

export const applyPoliticsTurn = (world, features, { round, date }) => {
  const enabled = isFeatureEnabled(features, "hardcodedPolitics");
  if (!enabled) return { events: [], world };
  const settings = features?.hardcodedPolitics ?? {};
  const baseline = asNumber(settings.stabilityBaseline, 50);

  const events = [];
  const nextPolitics = { ...(world.politics ?? {}) };
  for (const [code, entry] of Object.entries(nextPolitics)) {
    const stability = asNumber(entry.stability, 50);
    const polityBaseline = asNumber(entry.stabilityBaseline, baseline);
    // Drift 10% of the way toward baseline each turn.
    const drift = Math.round((polityBaseline - stability) * 0.1);
    const nextStability = clamp(stability + drift, 0, 100);
    const clout = asNumber(entry.politicalClout, 0);

    nextPolitics[code] = {
      ...entry,
      stability: nextStability,
      stabilityBaseline: polityBaseline,
      politicalClout: clout,
      lastChange: drift,
    };

    if (Math.abs(drift) >= 5) {
      events.push({
        date,
        title: drift > 0 ? `${code} stability rises` : `${code} stability falls`,
        description: `Stability drifted ${drift > 0 ? "+" : ""}${drift} toward baseline ${polityBaseline}; now ${nextStability}/100.`,
        importance: "minor",
        kind: "world",
        tags: ["politics"],
        notable: false,
        playerRelated: code === (world?.game?.country ?? ""),
        impacts: {},
        mechanic: "politics",
        mechanicData: { code, drift, stability: nextStability, baseline: polityBaseline },
      });
    }
  }
  return { events, world: { ...world, politics: nextPolitics } };
};

// --- Top-level -------------------------------------------------------------

// Run one turn of every enabled mechanic. Returns { events, world } where
// events are engine-generated events the AI should narrate, and world carries
// the updated mechanic state.
export const applyMechanicsTurn = (world, features, { round, date }) => {
  let current = ensureMechanicState(world, features);
  const economyResult = applyEconomyTurn(current, features, { round, date });
  current = economyResult.world;
  let events = [...economyResult.events];

  const populationResult = applyPopulationTurn(current, features, { round, date });
  current = populationResult.world;
  events = [...events, ...populationResult.events];

  const politicsResult = applyPoliticsTurn(current, features, { round, date });
  current = politicsResult.world;
  events = [...events, ...politicsResult.events];

  return { events, world: current };
};

// Read a polity's mechanic summary for prompt injection.
export const mechanicSummaryForPolity = (world, code) => {
  const parts = [];
  const economy = economyOf(world, code);
  const population = populationOf(world, code);
  const politics = politicsOf(world, code);

  if (economy.treasury !== 0 || economy.monthlyIncome !== 1000) {
    parts.push(`economy: treasury ${economy.treasury}, income ${economy.monthlyIncome}/turn, expenses ${economy.monthlyExpenses}/turn`);
  }
  if (population.total !== 1000000 || population.growthRate !== 1) {
    parts.push(`population: ${population.total} (${population.growthRate}%/turn)`);
  }
  if (politics.stability !== 50 || politics.stabilityBaseline !== 50) {
    parts.push(`politics: stability ${politics.stability}/100, baseline ${politics.stabilityBaseline}, clout ${politics.politicalClout}`);
  }
  return parts.length ? `${code}: ${parts.join("; ")}` : `${code}: no mechanic state`;
};

// Read all mechanic state for prompt injection (player polity first).
export const mechanicPromptText = (world) => {
  const playerCode = asText(world?.game?.country);
  const codes = [];
  if (playerCode) codes.push(playerCode);
  for (const code of Object.keys(world?.economy ?? {})) {
    if (!codes.includes(code)) codes.push(code);
  }
  for (const code of Object.keys(world?.population ?? {})) {
    if (!codes.includes(code)) codes.push(code);
  }
  for (const code of Object.keys(world?.politics ?? {})) {
    if (!codes.includes(code)) codes.push(code);
  }
  if (!codes.length) return "";
  return "[Hardcoded mechanics — engine-tracked state]\n" + codes.map((code) => `- ${mechanicSummaryForPolity(world, code)}`).join("\n");
};

// Feature helpers (mirror server/gameFeatures.js so this module is import-free).
const FEATURE_KEYS = new Set(["hardcodedEconomy", "hardcodedPopulation", "hardcodedPolitics"]);
export const isFeatureEnabled = (features, key) => {
  if (!FEATURE_KEYS.has(key)) return false;
  const entry = features?.[key];
  return entry ? entry.enabled !== false : false;
};
