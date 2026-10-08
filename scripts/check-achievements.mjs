// scripts/check-achievements.mjs
//
// Plain-Node, zero-dependency self-check for game/achievements.js and the
// achievements-related additions to game/petState.js (stats/achievements
// fields, normalizeState()). Same style as scripts/check-petstate.mjs:
// fixed nowMs, explicit assert(), exit 1 on the first failure, exit 0 with
// a summary on success. Wired into `npm test` alongside check-petstate.mjs
// (does not replace it).

import { createInitialState, normalizeState, awardPoints, STAT_MAX, INITIAL_HAPPINESS } from "../game/petState.js";
import { ACHIEVEMENTS, recordEvent, checkAchievements, achievementProgress } from "../game/achievements.js";

let passCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  passCount += 1;
}

const BASE_NOW = 1_700_000_000_000; // fixed arbitrary epoch ms, never real Date.now()

// --- createInitialState() gains empty stats/achievements ---
{
  const start = createInitialState(BASE_NOW);
  assert(start.stats && typeof start.stats === "object", "createInitialState() should include a stats object");
  assert(Object.keys(start.stats).length === 0, "createInitialState() stats should start empty");
  assert(start.achievements && typeof start.achievements === "object", "createInitialState() should include an achievements object");
  assert(Object.keys(start.achievements).length === 0, "createInitialState() achievements should start empty");
}

// --- Fresh saves must not start with "max_happiness" already earned ---
{
  assert(
    INITIAL_HAPPINESS < STAT_MAX,
    "INITIAL_HAPPINESS must be below STAT_MAX so max_happiness is an earnable achievement"
  );
  const fresh = createInitialState(BASE_NOW);
  const { unlocked } = checkAchievements(fresh, BASE_NOW);
  assert(
    !unlocked.some((a) => a.id === "max_happiness"),
    "a freshly created state should not immediately unlock max_happiness"
  );
}

// --- recordEvent(): pure counter bumps ---
{
  const start = createInitialState(BASE_NOW);
  const once = recordEvent(start, "pets");
  assert(once !== start, "recordEvent() should return a new object");
  assert(start.stats.pets === undefined, "recordEvent() must not mutate its input");
  assert(once.stats.pets === 1, "recordEvent() should default n to 1");

  const bumped = recordEvent(once, "pets", 3);
  assert(bumped.stats.pets === 4, "recordEvent() should bump an existing counter by n");

  const other = recordEvent(bumped, "plays");
  assert(other.stats.pets === 4 && other.stats.plays === 1, "recordEvent() should track independent kinds separately");
}

// --- checkAchievements(): single unlock, reward via the real points mechanism, idempotency ---
{
  // Start below max happiness so "max_happiness" doesn't also fire here and
  // muddy the "exactly one unlock" assertion below.
  let state = { ...createInitialState(BASE_NOW), happiness: 50 };
  state = recordEvent(state, "pets", 1);
  const before = state;

  const { state: after, unlocked } = checkAchievements(state, BASE_NOW);
  assert(unlocked.length === 1 && unlocked[0].id === "first_pet", "a single pet() event should unlock exactly 'first_pet'");
  assert(after.achievements.first_pet === BASE_NOW, "the unlock should be stamped with the passed nowMs");

  const firstPetDef = ACHIEVEMENTS.find((a) => a.id === "first_pet");
  assert(
    after.points === before.points + firstPetDef.reward.points,
    `reward should be applied: expected points ${before.points + firstPetDef.reward.points}, got ${after.points}`
  );
  // The mechanism reused must be the real awardPoints(), not a parallel one.
  const direct = awardPoints(before, firstPetDef.reward.points);
  assert(direct.points === after.points, "achievements should reuse petState.js's awardPoints(), not a parallel points path");

  // Idempotency: checking again (even with new stats bumps queued in) must
  // not re-unlock or re-pay an id that's already a key in state.achievements.
  const restamped = recordEvent(after, "pets", 5); // more pets, still already unlocked
  const { state: again, unlocked: unlockedAgain } = checkAchievements(restamped, BASE_NOW + 999);
  assert(unlockedAgain.length === 0, "checkAchievements() must not re-unlock an already-unlocked achievement");
  assert(again.points === after.points, "checkAchievements() must not re-pay an already-unlocked achievement");
  assert(again.achievements.first_pet === BASE_NOW, "an existing unlock timestamp must never be overwritten by a later check");
}

// --- level / points threshold achievements ---
{
  let result = checkAchievements({ ...createInitialState(BASE_NOW), level: 5 }, BASE_NOW);
  assert(result.unlocked.some((a) => a.id === "level_5"), "reaching level 5 should unlock 'level_5'");
  assert(!result.unlocked.some((a) => a.id === "level_10"), "level 5 alone must not also unlock 'level_10'");

  result = checkAchievements({ ...createInitialState(BASE_NOW), level: 10 }, BASE_NOW);
  assert(
    result.unlocked.some((a) => a.id === "level_5") && result.unlocked.some((a) => a.id === "level_10"),
    "reaching level 10 in one jump should unlock both level achievements at once"
  );

  result = checkAchievements({ ...createInitialState(BASE_NOW), points: 200 }, BASE_NOW);
  assert(result.unlocked.some((a) => a.id === "bank_200"), "having 200+ points banked should unlock 'bank_200'");

  result = checkAchievements({ ...createInitialState(BASE_NOW), happiness: STAT_MAX }, BASE_NOW);
  assert(result.unlocked.some((a) => a.id === "max_happiness"), "happiness at STAT_MAX should unlock 'max_happiness'");
}

// --- achievementProgress(): reflects real counters/targets and flips on unlock ---
{
  let state = createInitialState(BASE_NOW);
  state = recordEvent(state, "plays", 4);

  const progress = achievementProgress(state);
  assert(progress.length === ACHIEVEMENTS.length, "achievementProgress() should list every catalogue entry");

  const playsBefore = progress.find((p) => p.id === "ten_plays");
  assert(playsBefore.unlocked === false, "4/10 plays should not be unlocked yet");
  assert(
    playsBefore.progress.current === 4 && playsBefore.progress.target === 10,
    `progress should reflect the real counter/target, got ${JSON.stringify(playsBefore.progress)}`
  );

  const { state: leveledUp } = checkAchievements(recordEvent(state, "plays", 6), BASE_NOW);
  const playsAfter = achievementProgress(leveledUp).find((p) => p.id === "ten_plays");
  assert(playsAfter.unlocked === true && playsAfter.unlockedAt === BASE_NOW, "10/10 plays should unlock with a real timestamp");
}

// --- normalizeState(): legacy save preserves real values, fills new fields ---
{
  const legacy = {
    version: 2,
    happiness: 42,
    hunger: 17,
    energy: 63,
    points: 123,
    xp: 55,
    level: 3,
    inventory: [{ id: "ball", name: "Ball", effects: { happiness: 20 } }],
    lastSeen: BASE_NOW - 999,
    // no stats, no achievements — simulates a save from before this feature existed
  };

  const normalized = normalizeState(legacy, BASE_NOW);
  assert(normalized !== legacy, "normalizeState() should return a new object");
  assert(
    normalized.happiness === 42 && normalized.hunger === 17 && normalized.energy === 63,
    "normalizeState() must preserve existing stat values"
  );
  assert(
    normalized.points === 123 && normalized.xp === 55 && normalized.level === 3,
    "normalizeState() must preserve existing points/xp/level"
  );
  assert(normalized.lastSeen === BASE_NOW - 999, "normalizeState() must preserve the real lastSeen, not reset it to nowMs");
  assert(
    normalized.inventory.length === 1 && normalized.inventory[0].id === "ball",
    "normalizeState() must preserve existing inventory"
  );
  assert(
    normalized.stats && typeof normalized.stats === "object" && Object.keys(normalized.stats).length === 0,
    "normalizeState() should default a missing stats object to {}"
  );
  assert(
    normalized.achievements && typeof normalized.achievements === "object" && Object.keys(normalized.achievements).length === 0,
    "normalizeState() should default a missing achievements object to {}"
  );

  // A save that already has partial stats/achievements must keep them intact, not reset them.
  const partial = { ...legacy, stats: { pets: 7 }, achievements: { first_pet: 123 } };
  const normalizedPartial = normalizeState(partial, BASE_NOW);
  assert(normalizedPartial.stats.pets === 7, "normalizeState() must not drop existing stats counters");
  assert(normalizedPartial.achievements.first_pet === 123, "normalizeState() must not drop existing achievement unlocks");

  // A totally missing/invalid candidate should fall back to a fresh (but valid) state, never throw.
  let fallback;
  try {
    fallback = normalizeState(null, BASE_NOW);
  } catch (err) {
    console.error(`FAIL: normalizeState(null) crashed: ${err}`);
    process.exit(1);
  }
  assert(fallback.stats && fallback.achievements, "normalizeState(null) should still produce a valid stats/achievements shape");
}

console.log(`PASS: all ${passCount} assertions passed in scripts/check-achievements.mjs`);
process.exit(0);
