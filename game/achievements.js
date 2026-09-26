// game/achievements.js
//
// Pure achievements/milestones system built on top of game/petState.js.
// Imports NOTHING but petState.js itself — no React, no React Native, no
// AsyncStorage — so it can be loaded and asserted against with plain `node`
// and zero installed dependencies, same convention as petState.js.
//
// Design:
//   - `state.stats` (added to createInitialState()/normalizeState() over in
//     petState.js) is a plain { kindName: count } map of lifetime event
//     counters, e.g. { pets: 12, plays: 3, itemsUsed: 5, purchases: 1,
//     toysUsed: 2 }. `recordEvent()` is the only thing that bumps it.
//   - `state.achievements` is a plain { achievementId: unlockedAtMs } map.
//     An id's presence in this object IS the "already unlocked" flag —
//     `checkAchievements()` never re-tests or re-pays an id once it's a key
//     here, which is what makes it idempotent.
//   - Rewards are paid via petState.js's own `awardPoints()` — there is
//     deliberately no second/parallel points-awarding path here.

import { awardPoints, STAT_MAX } from "./petState.js";

function statCount(state, kind) {
  return (state.stats && state.stats[kind]) || 0;
}

// Returns a progress(state) function for a simple lifetime-counter
// achievement, e.g. countProgress("pets", 50) -> { current, target }.
function countProgress(kind, target) {
  return (state) => ({ current: Math.min(statCount(state, kind), target), target });
}

// Returns a progress(state) function for a threshold on some other numeric
// field of state (level, points, happiness, ...), read via `getValue`.
function valueProgress(getValue, target) {
  return (state) => ({ current: Math.min(getValue(state) || 0, target), target });
}

// The achievements catalogue. Each entry: { id, name, description,
// reward: { points }, test(state), progress(state) }. `progress` is an
// addition beyond the minimum shape, purely to drive achievementProgress()
// below — it is never consulted by checkAchievements()/test().
export const ACHIEVEMENTS = [
  {
    id: "first_pet",
    name: "First Pet",
    description: "Pet your DigiPet for the first time.",
    reward: { points: 5 },
    test: (state) => statCount(state, "pets") >= 1,
    progress: countProgress("pets", 1),
  },
  {
    id: "fifty_pets",
    name: "Fifty Pets",
    description: "Pet your DigiPet 50 times in total.",
    reward: { points: 25 },
    test: (state) => statCount(state, "pets") >= 50,
    progress: countProgress("pets", 50),
  },
  {
    id: "ten_plays",
    name: "Playful",
    description: "Play with your DigiPet 10 times.",
    reward: { points: 20 },
    test: (state) => statCount(state, "plays") >= 10,
    progress: countProgress("plays", 10),
  },
  {
    id: "first_purchase",
    name: "Shopper",
    description: "Buy your first item from the shop.",
    reward: { points: 10 },
    test: (state) => statCount(state, "purchases") >= 1,
    progress: countProgress("purchases", 1),
  },
  {
    id: "five_items_used",
    name: "Well Stocked",
    description: "Use 5 items from your inventory.",
    reward: { points: 15 },
    test: (state) => statCount(state, "itemsUsed") >= 5,
    progress: countProgress("itemsUsed", 5),
  },
  {
    id: "level_5",
    name: "Growing Up",
    description: "Reach level 5.",
    reward: { points: 30 },
    test: (state) => (state.level || 1) >= 5,
    progress: valueProgress((state) => state.level || 1, 5),
  },
  {
    id: "level_10",
    name: "Veteran",
    description: "Reach level 10.",
    reward: { points: 60 },
    test: (state) => (state.level || 1) >= 10,
    progress: valueProgress((state) => state.level || 1, 10),
  },
  {
    id: "bank_200",
    name: "Saver",
    description: "Have 200 points banked at once.",
    reward: { points: 20 },
    test: (state) => (state.points || 0) >= 200,
    progress: valueProgress((state) => state.points || 0, 200),
  },
  {
    id: "max_happiness",
    name: "Pure Joy",
    description: "Get happiness all the way to its max.",
    reward: { points: 10 },
    test: (state) => (state.happiness || 0) >= STAT_MAX,
    progress: valueProgress((state) => state.happiness || 0, STAT_MAX),
  },
  {
    id: "toy_five",
    name: "Toy Fanatic",
    description: "Use the Toy 5 times.",
    reward: { points: 15 },
    test: (state) => statCount(state, "toysUsed") >= 5,
    progress: countProgress("toysUsed", 5),
  },
];

// Pure. Bumps state.stats[kind] by n (default 1), creating the stats object
// (or the individual counter) if missing. Never mutates its input.
export function recordEvent(state, kind, n = 1) {
  const stats = { ...(state.stats || {}) };
  stats[kind] = (stats[kind] || 0) + n;
  return { ...state, stats };
}

// Pure. Walks the catalogue in order, unlocking (stamping
// state.achievements[id] = nowMs) and paying out the reward for every
// achievement whose test(state) passes and that isn't already unlocked.
// Returns { state, unlocked }, where `unlocked` is the list of catalogue
// entries newly unlocked by this call (empty if none). Idempotent: calling
// this again on the returned `state` with no new stats/progress in between
// will never re-unlock or re-pay anything, because an id's presence in
// state.achievements is checked (and skipped) before its test() ever runs.
export function checkAchievements(state, nowMs = Date.now()) {
  let next = state;
  const achievements = { ...(state.achievements || {}) };
  const unlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (achievements[achievement.id] != null) continue; // already unlocked — never re-test, never re-pay (nowMs 0 is a valid stamp)
    if (!achievement.test(next)) continue;

    achievements[achievement.id] = nowMs;
    next = { ...next, achievements: { ...achievements } };
    if (achievement.reward && typeof achievement.reward.points === "number") {
      next = awardPoints(next, achievement.reward.points); // the SAME points mechanism petState.js already uses
    }
    unlocked.push(achievement);
  }

  return { state: next, unlocked };
}

// Read-only projection of the catalogue + current state for UI display:
// one entry per achievement with its unlocked flag/timestamp and a
// { current, target } progress pair. Never mutates state and unlocks
// nothing itself — use checkAchievements() for that.
export function achievementProgress(state) {
  const achievements = (state && state.achievements) || {};
  return ACHIEVEMENTS.map((a) => {
    const unlockedAt = achievements[a.id] != null ? achievements[a.id] : null;
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      unlocked: unlockedAt != null,
      unlockedAt,
      progress: typeof a.progress === "function" ? a.progress(state) : { current: unlockedAt ? 1 : 0, target: 1 },
    };
  });
}
