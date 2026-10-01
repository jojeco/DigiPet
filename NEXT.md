# NEXT.md

## What shipped in this pass

- `game/petState.js` — pure, dependency-free pet-state core: three stats
  (happiness/hunger/energy), `createInitialState()`, `clamp()`,
  `applyElapsed()` for capped offline decay, `pet()`/`play()`/`interact()`,
  `awardPoints()`/`addXp()` with a level curve, `useItem()`, `buyItem()`
  (against a `SHOP_ITEMS` catalogue), and `mood()`.
- `game/petStorage.js` — AsyncStorage persistence under a single versioned
  key (`digipet:state:v2`), with safe load/save and migration from the
  legacy `"happiness"` key.
- `components/PetApp.js` rewired onto the above: hydrate-then-catch-up-decay
  on mount, one tick interval instead of two (it now does elapsed-decay,
  free-toy regen, and persistence together), and the always-truthy
  `(happiness => 51)` bug fixed to a real `state.happiness >= 51` check
  against current (not stale-closure) state.
- `components/StatBar.js` — new presentational bar for happiness/hunger/energy.
- `components/Shop.js` — new catalogue UI (Treat/Ball/Bone/Nap Mat), wired to
  the pure `buyItem()`.
- Points are finally earnable (tap/long-press) and spendable (Shop).
- ✅ **Achievements/milestones system.** New `game/achievements.js` — a pure,
  import-free `ACHIEVEMENTS` catalogue (first pet, 50 pets, 10 plays, first
  purchase, 5 items used, level 5, level 10, 200 points banked, max
  happiness, 5 toy uses), `recordEvent()` to bump lifetime `state.stats`
  counters, `checkAchievements()` to unlock+pay out newly-qualifying ones
  (idempotent — an id in `state.achievements` is never re-tested or
  re-paid), and `achievementProgress()` for UI display. `createInitialState()`
  gained `stats: {}` / `achievements: {}`, and a new `normalizeState()`
  upgrades an old save to have both without touching any of its real
  progress — `game/petStorage.js`'s `loadState()` now routes every return
  path through it. `components/PetApp.js`'s `applyAction()` records the
  right event kind per action and runs `checkAchievements()` after, and any
  newly-unlocked achievement takes over the existing `StatFeedback` toast
  slot for that action. New presentational `components/Achievements.js`
  (locked/unlocked, progress, unlock date), toggled by a button next to Shop.
  Reward points are paid via the existing `awardPoints()` — no parallel
  points path. Covered by new `scripts/check-achievements.mjs`, wired into
  `npm test` alongside `check-petstate.mjs`.

## Follow-ups (not done, deliberately out of scope this pass)

1. **Move the game rules onto the unused `redux`/`react-redux` dependency.**
   `petState.js`'s pure reducer-shaped functions (`pet`, `play`, `useItem`,
   `buyItem`, `applyElapsed`) map cleanly onto Redux actions/reducers if the
   app ever needs cross-component state sharing beyond `PetApp.js`. Adding a
   store was explicitly out of scope for this pass (architectural change).
2. **Add Jest + unit tests for `game/petState.js`.** The module was written
   to be import-free specifically so it's trivially testable; today it's
   only verified by an ad-hoc `node -e` self-check. A real `jest` +
   `@testing-library/react-native` setup (not currently a dependency) would
   let this run in CI.
3. **Move the free-toy regen check into `game/petState.js`** as a pure
   helper (e.g. `maybeRegenToy(state)`) instead of living inline in
   `PetApp.js`'s tick handler — it's currently the one bit of game logic
   that isn't in the pure module, purely because it was a direct 1:1 bugfix
   of existing inline code.
4. ✅ **Per-stat feeding/animation feedback** — done. `components/PetApp.js`
   now routes tap, long-press, item-use, and Shop buys through a single
   `applyAction()` helper: the same `triggerHappyAnimation()`/bark/vibration
   fire for all four, a `<StatFeedback>` toast (new `components/StatFeedback.js`,
   driven by the new `describeChange()` in `game/petState.js`) shows the
   per-stat delta (e.g. "Hunger -30", colored by whether the change was
   good/bad), and no-op actions (item not held / can't afford) produce no
   feedback at all. Also fixed `saveState()` being called inside `setState`
   updaters (unsafe under StrictMode) and `handleUseItem`'s save being
   silently throttled — every action now force-saves exactly once, outside
   the updater.
5. **Pet evolution at level 5 (and beyond)** — swap `pixelPuppy.png` for an
   evolved sprite once `state.level` crosses a threshold, using the leveling
   system already in `petState.js`.
6. ✅ **Move the free-toy regen check into `game/petState.js`** — done. The
   toy now has a real cooldown (`TOY_REGEN_COOLDOWN_MS`, ~10 minutes) instead
   of the always-truthy `happiness >= 51` check, tracked via a
   `toyAvailableAt` timestamp stamped by `useItem()` and consumed by the new
   pure `maybeRegenToy()`. `PetApp.js`'s tick effect calls it instead of
   inlining the logic, and its `saveState()` call was moved outside the
   `setState` updater (mirroring `applyAction()`) for the same StrictMode
   reason. Also added `scripts/check-petstate.mjs` — the repo's first real
   automated check, wired to `npm test`.
7. **No real test framework yet, just the one plain script.**
   `scripts/check-petstate.mjs` is hand-rolled (no runner, no watch mode, no
   per-test isolation reporting) — it's a real improvement over the old
   ad-hoc `node -e` check but still just one big script with a shared
   assertion counter. A minimal test runner (even something dependency-free
   like Node's built-in `node:test`, which ships with Node 18+ and needs no
   npm install) would give per-assertion pass/fail output instead of
   stop-on-first-failure.
8. ✅ **Show the toy cooldown in the UI** — done. New presentational
   `components/ToyCooldown.js` renders "Toy back in m:ss" under the
   Inventory while the toy is on cooldown (and "Toy coming back…" in the
   brief gap before the tick restores it, never "0:00"). It keeps its own 1s
   clock only while there's something to count down, so `PetApp.js` gained no
   interval. Driven by the new pure `toyCooldownRemainingMs()` /
   `formatCooldown()` in `game/petState.js`, asserted in
   `scripts/check-petstate.mjs`. The component itself is not machine-tested
   (no RN test setup — see item 2).
9. **Make the toy cooldown length configurable.** `TOY_REGEN_COOLDOWN_MS` is
   still a hardcoded constant; a difficulty/settings option (or per-level
   scaling) would be a small change now that the countdown reads it live.
10. **Component-level tests for `ToyCooldown`.** Once Jest +
    `@testing-library/react-native` exist (item 2), add a fake-timers test
    that the interval starts only while counting and is cleared on unmount.
11. **Countdown feedback on toy return.** Fire the existing
    `applyAction()`-style bark/toast when the toy reappears so the player
    notices it's back without watching the Inventory.
12. **Achievement toast queueing.** When one `applyAction()` call produces
    both a real stat delta AND one or more achievement unlocks, the unlock
    message currently wins the single `StatFeedback` toast slot outright and
    the stat delta for that same action is silently dropped. A small
    multi-message queue (even just "show stat delta, then unlock, 1s apart")
    would surface both instead of picking one.
13. **Achievements screen is inline, not a dedicated screen/modal.**
    `showAchievements` just toggles `components/Achievements.js` in place
    under Shop — fine today, but will want a real modal or nav route once
    the screen has more going on than a scrollable list.
14. ✅ **Progress bars for achievements, not just "current / target" text** —
    done. Each row in `components/Achievements.js` now renders a thin
    filled-track bar under the "current / target" text, mirroring
    `StatBar.js`'s track/fill visual pattern (declared as local styles, not
    imported). Width is the clamped current/target percentage, guarded
    against a missing/zero target or NaN; unlocked rows always show a full
    bar in a distinct "done" colour.
15. **A toy-return-timed achievement, once item 11 ships.** `toy_five`
    (added this pass) only counts total Toy uses and is deliberately not
    tied to the cooldown/regen mechanic. Once "countdown feedback on toy
    return" (item 11) exists, a "used the toy right as it came back"
    achievement could build on top of it.
16. **Fresh saves unlock "Pure Joy" on the very first tap.**
    `createInitialState()` starts happiness at `STAT_MAX`, so a brand new
    pet's first action unlocks both `first_pet` and `max_happiness`. Harmless
    (both toasts are shown together), but consider starting happiness below
    max or requiring the player to *raise* it to max. Also: the list is
    capped at 240px and scrolls, but has not been checked on a real device.
