/*! Open Historia — hardcoded mechanics integration © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Chains economy, population, and politics mechanics into one per-turn pass.
// Import-free except for the three mechanic modules.
import { ensureMechanicState } from "./state.js";
import { applyEconomyTurn } from "./economy.js";
import { applyPopulationTurn } from "./population.js";
import { applyPoliticsTurn } from "./politics.js";

export const applyMechanicsTurn = (world, features, { round, date, spanDays }) => {
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
