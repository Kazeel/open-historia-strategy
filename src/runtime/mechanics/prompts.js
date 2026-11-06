/*! Open Historia — mechanic prompt context © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Builds a text block showing current mechanic state per polity, for injection
// into AI prompts. The AI reads this to understand engine-tracked values
// (treasury, population trend, stability drift) before writing its orders.
// Imports getMechanicEntry from state.js (import-free pattern).

import { getMechanicEntry } from "./state.js";

export { getMechanicEntry };

const asText = (value) => String(value ?? "").trim();

export const mechanicSummaryForPolity = (world, code) => {
  const entry = world?.countryStats?.[code];
  if (!entry || typeof entry !== "object") return `${code}: no data`;

  const mechanic = getMechanicEntry(world, code);
  const parts = [];

  if (mechanic.treasury !== 0 || mechanic.monthlyIncome !== 1000) {
    parts.push(`treasury ${mechanic.treasury}, income ${mechanic.monthlyIncome}/turn, expenses ${mechanic.monthlyExpenses}/turn`);
  }
  const popEntry = entry.population ?? {};
  const total = Number.isFinite(Number(popEntry.total)) ? Number(popEntry.total) : 0;
  if (total !== 1000000 || mechanic.lastChange.popDelta !== 0) {
    parts.push(`population ${total}, change ${mechanic.lastChange.popDelta > 0 ? "+" : ""}${mechanic.lastChange.popDelta}/turn`);
  }
  const stability = Number.isFinite(Number(entry.stability)) ? Number(entry.stability) : 50;
  if (stability !== 50 || mechanic.lastChange.stabilityDrift !== 0) {
    parts.push(`stability ${stability}/100, drift ${mechanic.lastChange.stabilityDrift > 0 ? "+" : ""}${mechanic.lastChange.stabilityDrift}`);
  }

  return parts.length ? `${code}: ${parts.join("; ")}` : `${code}: no mechanic changes`;
};

export const mechanicPromptText = (world) => {
  if (!world || !world.countryStats) return "";

  const playerCode = asText(world?.game?.country);
  const codes = [];
  if (playerCode) codes.push(playerCode);

  for (const code of Object.keys(world.countryStats)) {
    if (!codes.includes(code)) codes.push(code);
  }

  if (!codes.length) return "";

  return "[Hardcoded mechanics — engine-tracked state]\n" + codes.map((code) => `- ${mechanicSummaryForPolity(world, code)}`).join("\n");
};
