// game/petStorage.js
//
// Persistence layer for the pet state. Wraps
// @react-native-async-storage/async-storage (already a real dependency) and
// nothing else. Every read/write is try/catch-guarded so a storage failure
// never crashes the app.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createInitialState, SCHEMA_VERSION } from "./petState";

export const STORAGE_KEY = "digipet:state:v2";
const LEGACY_HAPPINESS_KEY = "happiness";

// Minimum time between persisted saves (ms), so a fast tick interval doesn't
// hammer AsyncStorage. Hand-rolled — no lodash, per scope boundaries.
const SAVE_THROTTLE_MS = 4000;
let lastSaveAt = 0;

function isValidState(candidate) {
  return (
    candidate &&
    typeof candidate === "object" &&
    typeof candidate.happiness === "number" &&
    typeof candidate.hunger === "number" &&
    typeof candidate.energy === "number" &&
    typeof candidate.points === "number" &&
    typeof candidate.xp === "number" &&
    typeof candidate.level === "number" &&
    Array.isArray(candidate.inventory)
  );
}

// Reads and parses the versioned state key. Handles the legacy migration:
// if the new key is absent but the old "happiness" key exists, seeds a
// fresh state with that happiness value, persists it under the new key, and
// leaves the old key in place (never deletes user data). On any missing or
// corrupt data, resolves to a valid createInitialState() without throwing.
export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        return parsed;
      }
      // Corrupt/unexpected shape — fall through to a fresh state below.
    } else {
      // No new-schema state yet — check for the legacy key.
      const legacyRaw = await AsyncStorage.getItem(LEGACY_HAPPINESS_KEY);
      if (legacyRaw !== null) {
        const legacyHappiness = JSON.parse(legacyRaw);
        const migrated = {
          ...createInitialState(),
          version: SCHEMA_VERSION,
          happiness:
            typeof legacyHappiness === "number" && !Number.isNaN(legacyHappiness)
              ? legacyHappiness
              : createInitialState().happiness,
        };
        await saveState(migrated, { force: true });
        return migrated;
      }
    }
  } catch (err) {
    console.warn("petStorage: loadState failed, using fresh state", err);
  }

  return createInitialState();
}

// Stringifies + persists state under the single versioned key. Throttled to
// at most once per SAVE_THROTTLE_MS unless { force: true } is passed (used
// for the decay tick and for the legacy-migration write). Never throws.
export async function saveState(state, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastSaveAt < SAVE_THROTTLE_MS) {
    return;
  }
  lastSaveAt = now;

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("petStorage: saveState failed", err);
  }
}
