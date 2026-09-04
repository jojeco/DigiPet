// game/petState.js
//
// Pure pet-state game core. This module imports NOTHING — no React, no React
// Native, no AsyncStorage — so it can be loaded and asserted against with
// plain `node` and zero installed dependencies, no test runner required.
// Every exported function is pure: it takes state in and
// returns a brand-new state object, never mutating its argument. The only
// place "now" enters the picture is via an injected `nowMs` parameter
// (defaulting to `Date.now()`), so callers can test with fixed clocks.
//
// Stat semantics (pick one, documented, consistent):
//   - happiness: 0 (miserable) .. 100 (thrilled). Decays DOWN over time.
//   - hunger:    0 (full) .. 100 (starving). Decays UP over time — i.e. the
//                pet gets hungrier the longer it's ignored. Feeding reduces it.
//   - energy:    0 (exhausted) .. 100 (fully rested). Decays DOWN over time;
//                interacting with the pet costs a little energy.

export const STAT_MAX = 100;
export const STAT_MIN = 0;
export const SCHEMA_VERSION = 2;

// How much each stat moves per minute of elapsed real time. happiness/energy
// count down, hunger counts up (see semantics note above).
export const DECAY_PER_MINUTE = {
  happiness: 1,
  hunger: 1.5,
  energy: 0.75,
};

// Cap on how many minutes of "away" decay can be applied in one go, so that
// closing the app for a month doesn't produce absurd/NaN numbers.
const MAX_ELAPSED_MINUTES = 720; // 12 hours

// Simple shop catalogue. Lives here (rather than duplicated in Shop.js) so
// there is exactly one source of truth for item costs/effects that both the
// pure buyItem() logic and the presentational Shop component can read.
export const SHOP_ITEMS = [
  { id: "treat", name: "Treat", cost: 10, effects: { hunger: -30 } },
  { id: "ball", name: "Ball", cost: 15, effects: { happiness: 20 } },
  { id: "bone", name: "Bone", cost: 25, effects: { happiness: 10, hunger: -15 } },
  { id: "napmat", name: "Nap Mat", cost: 20, effects: { energy: 40 } },
];

export function clamp(value, min, max) {
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function createInitialState(nowMs = Date.now()) {
  return {
    version: SCHEMA_VERSION,
    happiness: 100,
    hunger: 0,
    energy: 100,
    points: 0,
    xp: 0,
    level: 1,
    inventory: [{ id: "toy", name: "Toy", effects: { happiness: 50 } }],
    lastSeen: nowMs,
  };
}

// Applies stat decay for the time elapsed since state.lastSeen, clamped and
// capped. Returns a NEW state with lastSeen advanced to nowMs. Safe against
// a missing/NaN lastSeen and against elapsed <= 0 (clock skew / same tick).
export function applyElapsed(state, nowMs = Date.now()) {
  const lastSeen = state.lastSeen;
  if (typeof lastSeen !== "number" || Number.isNaN(lastSeen)) {
    return { ...state, lastSeen: nowMs };
  }

  const elapsedMs = nowMs - lastSeen;
  if (elapsedMs <= 0) {
    return { ...state, lastSeen: nowMs };
  }

  const elapsedMinutes = Math.min(elapsedMs / 60000, MAX_ELAPSED_MINUTES);

  return {
    ...state,
    happiness: clamp(state.happiness - DECAY_PER_MINUTE.happiness * elapsedMinutes, STAT_MIN, STAT_MAX),
    hunger: clamp(state.hunger + DECAY_PER_MINUTE.hunger * elapsedMinutes, STAT_MIN, STAT_MAX),
    energy: clamp(state.energy - DECAY_PER_MINUTE.energy * elapsedMinutes, STAT_MIN, STAT_MAX),
    lastSeen: nowMs,
  };
}

export function xpForLevel(level) {
  return 100 * level;
}

export function awardPoints(state, n) {
  return { ...state, points: Math.max(0, state.points + n) };
}

// Adds xp, rolling over into level-ups (with a small point bonus per level)
// using the curve xpForLevel(level) = 100 * level.
export function addXp(state, n) {
  let xp = state.xp + Math.max(0, n);
  let level = state.level;
  let points = state.points;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    points += 10; // level-up bonus
  }

  return { ...state, xp, level, points };
}

// A tap: +2 happiness (unchanged from the original behaviour), a small
// energy cost, and a small points/xp reward.
export function pet(state) {
  let next = {
    ...state,
    happiness: clamp(state.happiness + 2, STAT_MIN, STAT_MAX),
    energy: clamp(state.energy - 1, STAT_MIN, STAT_MAX),
  };
  next = awardPoints(next, 1);
  next = addXp(next, 2);
  return next;
}

// A long-press: +15 happiness (unchanged from the original behaviour), a
// bigger energy cost, and a bigger points/xp reward.
export function play(state) {
  let next = {
    ...state,
    happiness: clamp(state.happiness + 15, STAT_MIN, STAT_MAX),
    energy: clamp(state.energy - 5, STAT_MIN, STAT_MAX),
  };
  next = awardPoints(next, 5);
  next = addXp(next, 10);
  return next;
}

// Convenience dispatcher: interact(state, "pet" | "play").
export function interact(state, kind) {
  if (kind === "play") return play(state);
  if (kind === "pet") return pet(state);
  return state;
}

// Applies an inventory item's effects to the matching stats and removes one
// instance of it from the inventory. No-op (returns the SAME state) if the
// item isn't held.
export function useItem(state, itemId) {
  const idx = state.inventory.findIndex((item) => item.id === itemId);
  if (idx === -1) return state;

  const item = state.inventory[idx];
  const effects = item.effects || {};
  const nextStats = {};
  for (const stat of Object.keys(effects)) {
    if (stat in state) {
      nextStats[stat] = clamp(state[stat] + effects[stat], STAT_MIN, STAT_MAX);
    }
  }

  const nextInventory = state.inventory.slice(0, idx).concat(state.inventory.slice(idx + 1));

  return { ...state, ...nextStats, inventory: nextInventory };
}

// Spends points on a shop item (looked up by id in SHOP_ITEMS) and adds it
// to the inventory. Rejected (returns the SAME state) if the item doesn't
// exist or points are insufficient — points must never go negative.
export function buyItem(state, itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item || state.points < item.cost) return state;

  return {
    ...state,
    points: state.points - item.cost,
    inventory: [...state.inventory, { id: item.id, name: item.name, effects: item.effects }],
  };
}

// Derives a short mood string from the current stats, for display.
export function mood(state) {
  if (state.hunger > 80) return "Hungry";
  if (state.energy < 20) return "Tired";
  if (state.happiness < 30) return "Sad";
  if (state.happiness >= 80 && state.hunger < 40 && state.energy > 50) return "Happy";
  return "Content";
}

// The three stats considered for change-detection/feedback below. Points,
// xp, level, and inventory are deliberately ignored here.
const STAT_KEYS = ["happiness", "hunger", "energy"];

// Which direction is an *improvement* for each stat — happiness/energy are
// better higher, hunger is better lower (see the semantics note at the top
// of this file).
export const BETTER_WHEN = {
  happiness: "higher",
  energy: "higher",
  hunger: "lower",
};

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Pure comparison of two state objects (typically "before" and "after" an
// action like useItem()/buyItem()) for driving user-facing feedback (e.g. a
// toast). Only happiness/hunger/energy are considered. Deltas are rounded
// to integers; a stat is skipped if either side isn't a finite number
// (defensive against partial/corrupt state — never throws). `label` is
// built from whichever stat moved the most in absolute value (ties keep
// the first stat encountered in STAT_KEYS order). Returns
// `{ changed: false, deltas: [], label: "" }` when nothing moved, which
// covers the no-op useItem()/buyItem() paths that return the same object.
export function describeChange(prev, next) {
  if (!prev || !next) return { changed: false, deltas: [], label: "" };

  const deltas = [];
  for (const stat of STAT_KEYS) {
    const before = prev[stat];
    const after = next[stat];
    if (typeof before !== "number" || Number.isNaN(before)) continue;
    if (typeof after !== "number" || Number.isNaN(after)) continue;

    const delta = Math.round(after - before);
    if (delta === 0) continue;

    const direction = delta > 0 ? "higher" : "lower";
    const good = BETTER_WHEN[stat] === direction;
    deltas.push({ stat, delta, good });
  }

  if (deltas.length === 0) return { changed: false, deltas: [], label: "" };

  let biggest = deltas[0];
  for (const d of deltas) {
    if (Math.abs(d.delta) > Math.abs(biggest.delta)) biggest = d;
  }

  const sign = biggest.delta > 0 ? "+" : "";
  return {
    changed: true,
    deltas,
    label: `${capitalize(biggest.stat)} ${sign}${biggest.delta}`,
    tone: biggest.good ? "good" : "bad",
  };
}
