// game/feedback.js
//
// Pure, import-free helper for turning the result of a single
// applyAction()-style call into an ORDERED list of toast messages, instead
// of collapsing everything down to one. Imports NOTHING — not even
// game/petState.js or game/achievements.js — same convention as those two
// modules, and specifically avoids a circular dependency with
// game/achievements.js (which imports from game/petState.js) since this
// module is consumed by both call sites in components/PetApp.js.
//
// Background: before this module existed, components/PetApp.js built one
// `message`/`tone` from describeChange(prev, next) (or a fallback label),
// then OVERWROTE it with "Achievement(s) unlocked: …" whenever
// checkAchievements() returned anything newly-unlocked — silently dropping
// the stat-delta message from the same action (e.g. the first tap should
// show both "Happiness +2" AND "Achievement unlocked: First Pet", but only
// the achievement ever showed). buildFeedbackMessages() replaces that
// overwrite with an ordered queue: the stat/fallback message (if any) comes
// first, then one combined unlock message (if any).

// Builds the ordered list of { message, tone, kind } entries for a single
// action. `kind` is "delta" (stat change / fallback) or "unlock" — the caller
// uses it to carry not-yet-shown unlocks forward when a newer action
// replaces the queue (see components/PetApp.js's applyAction()).
//   - change: the `describeChange(prev, next)` result (or undefined/null) —
//     consulted only for `change.changed`/`change.label`/`change.tone`.
//   - unlocked: the `checkAchievements()` result's `unlocked` array (list of
//     catalogue entries with a `.name`), or empty/undefined if none.
//   - fallbackLabel / fallbackTone: used when `change.changed` is false,
//     exactly like the pre-queue behaviour (e.g. a Shop purchase, which
//     moves points/inventory but none of the three watched stats).
// Returns [] when there's nothing to show at all (no change, no fallback,
// no unlocks) — callers should treat an empty array as "no toast this
// action", same as the old "message stays empty" case.
export function buildFeedbackMessages({ change, unlocked, fallbackLabel, fallbackTone }) {
  const messages = [];

  if (change && change.changed) {
    messages.push({ message: change.label, tone: change.tone, kind: "delta" });
  } else if (fallbackLabel) {
    messages.push({ message: fallbackLabel, tone: fallbackTone || "good", kind: "delta" });
  }

  if (unlocked && unlocked.length > 0) {
    // Surface EVERY newly-unlocked achievement by name (not just a count),
    // even when several unlock from the same action (e.g. reaching level 10
    // unlocks both "level_5" and "level_10" at once) — wording preserved
    // from the old overwrite logic in components/PetApp.js.
    const names = unlocked.map((a) => a.name).join(", ");
    messages.push({
      message: `Achievement${unlocked.length > 1 ? "s" : ""} unlocked: ${names}`,
      tone: "good",
      kind: "unlock",
    });
  }

  return messages;
}
