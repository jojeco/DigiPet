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
4. **Per-stat feeding/animation feedback** — right now `triggerHappyAnimation()`
   /bark/vibration only fire on tap and long-press; using an item or buying
   from the Shop has no animated feedback, which makes the Shop feel a bit flat.
5. **Pet evolution at level 5 (and beyond)** — swap `pixelPuppy.png` for an
   evolved sprite once `state.level` crosses a threshold, using the leveling
   system already in `petState.js`.
