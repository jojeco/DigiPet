// scripts/check-petstate.mjs
//
// Plain-Node, zero-dependency self-check for game/petState.js. Runs with
// `npm test` / `node scripts/check-petstate.mjs`. Every assertion uses an
// explicit, fixed `nowMs` value rather than the real clock, so results are
// deterministic. On any failure this prints a clear message and exits 1;
// on success it prints a summary and exits 0.

import {
  clamp,
  createInitialState,
  applyElapsed,
  pet,
  play,
  useItem,
  buyItem,
  describeChange,
  maybeRegenToy,
  toyCooldownRemainingMs,
  formatCooldown,
  FREE_TOY,
  TOY_REGEN_COOLDOWN_MS,
  SHOP_ITEMS,
} from "../game/petState.js";

let passCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  passCount += 1;
}

const BASE_NOW = 1_700_000_000_000; // fixed arbitrary epoch ms, never real Date.now()

// --- Regression checks: pure functions that already existed before this pass ---

// clamp()
assert(clamp(150, 0, 100) === 100, "clamp() should cap above max");
assert(clamp(-10, 0, 100) === 0, "clamp() should floor below min");
assert(clamp(NaN, 0, 100) === 0, "clamp() should treat NaN as min");

// applyElapsed() — 10 minutes away should decay happiness/energy down and
// hunger up, and never mutate the input object.
{
  const start = createInitialState(BASE_NOW);
  const tenMinutesLater = BASE_NOW + 10 * 60 * 1000;
  const decayed = applyElapsed(start, tenMinutesLater);
  assert(decayed !== start, "applyElapsed() should return a new object");
  assert(decayed.happiness === 90, `expected happiness 90 after 10min decay, got ${decayed.happiness}`);
  assert(decayed.hunger === 15, `expected hunger 15 after 10min decay, got ${decayed.hunger}`);
  assert(decayed.energy === 92.5, `expected energy 92.5 after 10min decay, got ${decayed.energy}`);
  assert(start.happiness === 100, "applyElapsed() must not mutate its input");
}

// pet() / play() — stat deltas and points/xp rewards unchanged. Start below
// the happiness ceiling so a +2/+15 delta is actually observable (a fresh
// createInitialState() is already at 100 happiness and would clamp it away).
{
  const start = { ...createInitialState(BASE_NOW), happiness: 50 };
  const petted = pet(start);
  assert(petted.happiness === start.happiness + 2, "pet() should add +2 happiness");
  assert(petted.energy === start.energy - 1, "pet() should cost 1 energy");
  assert(petted.points === 1, "pet() should award 1 point");

  const played = play(start);
  assert(played.happiness === start.happiness + 15, "play() should add +15 happiness");
  assert(played.energy === start.energy - 5, "play() should cost 5 energy");
  assert(played.points === 5, "play() should award 5 points");
}

// buyItem() — affordability enforced, points never negative, no-op returns SAME reference.
{
  const poor = { ...createInitialState(BASE_NOW), points: 5 };
  const stillPoor = buyItem(poor, "ball"); // costs 15, can't afford
  assert(stillPoor === poor, "buyItem() should no-op (same reference) when unaffordable");

  const rich = { ...createInitialState(BASE_NOW), points: 20 };
  const bought = buyItem(rich, "ball");
  assert(bought !== rich, "buyItem() should return a new object on success");
  assert(bought.points === 5, `expected 5 points left after buying Ball, got ${bought.points}`);
  assert(bought.inventory.some((i) => i.id === "ball"), "buyItem() should add the item to inventory");
  assert(SHOP_ITEMS.find((i) => i.id === "ball").cost === 15, "SHOP_ITEMS catalogue shape changed unexpectedly");
}

// describeChange() — no-op vs real change.
{
  const before = createInitialState(BASE_NOW);
  const same = describeChange(before, before);
  assert(same.changed === false, "describeChange() should report no change for identical states");

  const after = { ...before, hunger: before.hunger + 30 };
  const changed = describeChange(before, after);
  assert(changed.changed === true, "describeChange() should detect a real change");
  assert(changed.label === "Hunger +30", `expected label 'Hunger +30', got '${changed.label}'`);
  assert(changed.tone === "bad", "hunger going up is bad (BETTER_WHEN.hunger === 'lower')");
}

// --- New behavior: toy cooldown ---

// useItem() on the toy sets toyAvailableAt = nowMs + TOY_REGEN_COOLDOWN_MS.
{
  const start = createInitialState(BASE_NOW);
  const usedAt = BASE_NOW + 5000;
  const afterUse = useItem(start, "toy", usedAt);
  assert(afterUse !== start, "useItem() consuming the toy should return a new object");
  assert(
    afterUse.toyAvailableAt === usedAt + TOY_REGEN_COOLDOWN_MS,
    `expected toyAvailableAt ${usedAt + TOY_REGEN_COOLDOWN_MS}, got ${afterUse.toyAvailableAt}`
  );
  assert(
    !afterUse.inventory.some((i) => i.id === "toy"),
    "useItem() should have removed the toy from inventory"
  );
  assert(afterUse.happiness === 100, "toy's +50 happiness should already be clamped at 100 from full");
}

// maybeRegenToy() — not due yet: SAME reference (===), not just deep-equal.
{
  const start = createInitialState(BASE_NOW);
  const usedAt = BASE_NOW;
  const afterUse = useItem(start, "toy", usedAt);
  const tooSoon = usedAt + TOY_REGEN_COOLDOWN_MS - 1;
  const stillNotDue = maybeRegenToy(afterUse, tooSoon);
  assert(stillNotDue === afterUse, "maybeRegenToy() should return the SAME reference when not due");
}

// maybeRegenToy() — due: new object, toy back in inventory, cooldown cleared.
{
  const start = createInitialState(BASE_NOW);
  const usedAt = BASE_NOW;
  const afterUse = useItem(start, "toy", usedAt);
  const dueAt = usedAt + TOY_REGEN_COOLDOWN_MS;
  const regenned = maybeRegenToy(afterUse, dueAt);
  assert(regenned !== afterUse, "maybeRegenToy() should return a NEW object when due");
  assert(regenned.inventory.some((i) => i.id === "toy"), "maybeRegenToy() should add the toy back to inventory");
  assert(!regenned.toyAvailableAt, "maybeRegenToy() should clear toyAvailableAt once regenned");
}

// maybeRegenToy() — already holding a toy: no double-regen even if "due".
{
  const start = createInitialState(BASE_NOW); // already has the toy
  const stamped = { ...start, toyAvailableAt: BASE_NOW - 1 }; // "due" per timestamp
  const noDouble = maybeRegenToy(stamped, BASE_NOW);
  assert(noDouble === stamped, "maybeRegenToy() should no-op if the toy is already held, even if due");
}

// maybeRegenToy() — legacy state with no toyAvailableAt field: must not crash,
// must not insta-regen, but must not strand the player without a toy forever.
{
  const legacy = createInitialState(BASE_NOW);
  delete legacy.toyAvailableAt; // it was never set, simulating a pre-cooldown save
  legacy.inventory = []; // used up, no toyAvailableAt ever recorded (old save format)
  let result;
  try {
    result = maybeRegenToy(legacy, BASE_NOW);
  } catch (err) {
    console.error(`FAIL: maybeRegenToy() crashed on a legacy state without toyAvailableAt: ${err}`);
    process.exit(1);
  }
  assert(!result.inventory.some((i) => i.id === "toy"), "legacy state should not insta-regen a toy");
  assert(
    result.toyAvailableAt === BASE_NOW + TOY_REGEN_COOLDOWN_MS,
    "legacy state with no toy should start the cooldown from now, not be stranded forever"
  );
  // Repeated ticks before it's due must stay stable (same ref, no crash, no drift).
  const tick2 = maybeRegenToy(result, BASE_NOW + 1000);
  assert(tick2 === result, "legacy state should be a stable no-op on later ticks once stamped");
  // And it really does come back one cooldown later.
  const healed = maybeRegenToy(result, BASE_NOW + TOY_REGEN_COOLDOWN_MS);
  assert(healed.inventory.some((i) => i.id === "toy"), "legacy state should regain the toy after one cooldown");
}

// maybeRegenToy() — legacy state that still HOLDS the toy: pure no-op, no stray stamp.
{
  const legacyHolding = createInitialState(BASE_NOW);
  delete legacyHolding.toyAvailableAt;
  const result = maybeRegenToy(legacyHolding, BASE_NOW + 999_999_999);
  assert(result === legacyHolding, "legacy state already holding the toy should be an exact no-op");
}

// toyCooldownRemainingMs() / formatCooldown() — the pure helpers behind the countdown UI.
{
  const used = useItem(createInitialState(BASE_NOW), "toy", BASE_NOW); // toy consumed, cooldown stamped
  assert(!used.inventory.some((i) => i.id === "toy"), "sanity: using the toy should remove it");

  // Future timestamp -> exact remaining, integer.
  assert(
    toyCooldownRemainingMs(used, BASE_NOW) === TOY_REGEN_COOLDOWN_MS,
    "full cooldown should remain right after using the toy"
  );
  assert(
    toyCooldownRemainingMs(used, BASE_NOW + 192_000) === TOY_REGEN_COOLDOWN_MS - 192_000,
    "remaining should shrink by the elapsed time"
  );
  assert(Number.isInteger(toyCooldownRemainingMs(used, BASE_NOW + 1234.5)), "remaining should be an integer number of ms");

  // Past / exactly-due timestamp -> 0, never negative.
  assert(toyCooldownRemainingMs(used, BASE_NOW + TOY_REGEN_COOLDOWN_MS) === 0, "remaining should be 0 exactly at the deadline");
  assert(toyCooldownRemainingMs(used, BASE_NOW + TOY_REGEN_COOLDOWN_MS + 5_000_000) === 0, "remaining must never go negative");

  // Toy held -> 0 even with a (stale) future toyAvailableAt.
  const holding = { ...createInitialState(BASE_NOW), toyAvailableAt: BASE_NOW + 999_999 };
  assert(toyCooldownRemainingMs(holding, BASE_NOW) === 0, "holding the toy should mean 0 remaining regardless of toyAvailableAt");

  // Missing / null / NaN toyAvailableAt with no toy -> 0, no crash (legacy saves).
  const noToy = { ...used, inventory: [] };
  assert(toyCooldownRemainingMs({ ...noToy, toyAvailableAt: null }, BASE_NOW) === 0, "null toyAvailableAt should be 0");
  assert(toyCooldownRemainingMs({ ...noToy, toyAvailableAt: undefined }, BASE_NOW) === 0, "undefined toyAvailableAt should be 0");
  assert(toyCooldownRemainingMs({ ...noToy, toyAvailableAt: NaN }, BASE_NOW) === 0, "NaN toyAvailableAt should be 0");
  const legacy = { ...noToy };
  delete legacy.toyAvailableAt;
  let legacyRemaining;
  try {
    legacyRemaining = toyCooldownRemainingMs(legacy, BASE_NOW);
  } catch (err) {
    console.error(`FAIL: toyCooldownRemainingMs() crashed on a legacy state without toyAvailableAt: ${err}`);
    process.exit(1);
  }
  assert(legacyRemaining === 0, "legacy state with toyAvailableAt deleted should be 0");

  // formatCooldown() — m:ss with zero-padded seconds.
  assert(formatCooldown(61_000) === "1:01", "61000ms should format as 1:01");
  assert(formatCooldown(0) === "0:00", "0ms should format as 0:00");
  assert(formatCooldown(9_000) === "0:09", "seconds should be zero-padded");
  assert(formatCooldown(TOY_REGEN_COOLDOWN_MS) === "10:00", "the full cooldown should format as 10:00");
  assert(formatCooldown(-500) === "0:00", "negative durations should clamp to 0:00");
  assert(formatCooldown(1) === "0:01", "a sub-second remainder should round up, never show 0:00 while counting");
}

// FREE_TOY shape sanity — guards against an accidental shape change during the move.
assert(FREE_TOY.id === "toy" && FREE_TOY.name === "Toy" && FREE_TOY.effects.happiness === 50, "FREE_TOY shape changed unexpectedly");

console.log(`PASS: all ${passCount} assertions passed in scripts/check-petstate.mjs`);
process.exit(0);
