// Importing necessary modules and components from React, React Native,
// gesture handlers for interactive animations, and sound management from expo-av.
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, Animated, Vibration } from "react-native"; // Corrected import
import {
  TapGestureHandler,
  LongPressGestureHandler,
  State,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Inventory from "./Inventory"; // Custom component for managing inventory items
import Points from "./Points"; // Custom component for displaying points
import StatBar from "./StatBar"; // Presentational stat bars (happiness/hunger/energy)
import Shop from "./Shop"; // Buyable items, spends points
import StatFeedback from "./StatFeedback"; // Floating toast for stat changes from item use / shop buys
import Bark from "../assets/dogBarking.mp3"; // Sound assets for pet interactions
import { Audio } from 'expo-av'; // Module for handling audio playback
import {
  pet as petAction,
  play as playAction,
  useItem as applyItem,
  buyItem,
  applyElapsed,
  mood,
  describeChange,
} from "../game/petState"; // Pure game rules — see game/petState.js
import { loadState, saveState } from "../game/petStorage"; // AsyncStorage persistence

// How often the "time passes" tick runs while the app is open. This is the
// single interval that replaces the old happiness-decay + toy-regen
// intervals: it applies elapsed-time decay via applyElapsed() and persists.
const TICK_INTERVAL_MS = 7000;

// Toy the pet gets back for free once happiness is high enough — this is
// the mechanic the old `(happiness => 51)` always-truthy bug was supposed
// to gate but never actually did (an arrow function is always truthy).
const FREE_TOY = { id: "toy", name: "Toy", effects: { happiness: 50 } };

const PetApp = () => {
  // Single source of truth for the whole pet: stats, points, xp, level,
  // inventory, lastSeen. `null` until loadState()+applyElapsed() resolve on
  // mount, so we don't render undefined.happiness.
  const [state, setState] = useState(null);

  // useRef hook to manage the animation scale for the pet image.
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Keep the latest state in a ref too, so the unmount cleanup can save the
  // most recent value without needing state in its dependency array, and so
  // applyAction() (below) can read the current state from outside setState.
  const stateRef = useRef(null);
  // Guards setState/setToast calls that could otherwise fire after unmount
  // (e.g. if a gesture handler resolves its async playSound() late).
  const isMountedRef = useRef(true);
  // Monotonic counter used as StatFeedback's `nonce` so an identical toast
  // message (e.g. using the same item twice) still re-triggers the fade.
  const toastNonceRef = useRef(0);

  // Floating toast state for item-use / shop-buy feedback. `nonce` is bumped
  // on every real (non-no-op) action so StatFeedback re-animates even when
  // the message text repeats.
  const [toast, setToast] = useState({ message: "", tone: "good", nonce: 0 });

  // Function to trigger device vibration as feedback.
  const triggerVibrationFeedback = () => {
    Vibration.vibrate(100); // Vibrate for 100 milliseconds
  };

  // Function to trigger a happy animation for the pet image.
  const triggerHappyAnimation = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };


  // On mount: hydrate from storage, apply decay for time spent away, then
  // start a single tick interval that keeps applying elapsed-time decay and
  // persisting while the app is open. On unmount: persist one last time and
  // clear the interval.
  useEffect(() => {
    let tickId;
    let cancelled = false;
    // Re-arm on every effect run, not just at useRef() init: React 18's
    // StrictMode mounts, tears down, then re-mounts effects in dev, so a ref
    // that is only ever set to false in the cleanup would stay false for the
    // rest of the session and silently block every later setState below.
    isMountedRef.current = true;

    const hydrate = async () => {
      const loaded = await loadState();
      const caughtUp = applyElapsed(loaded, Date.now());
      if (cancelled) return;
      stateRef.current = caughtUp;
      setState(caughtUp);
      await saveState(caughtUp, { force: true });

      tickId = setInterval(() => {
        setState((prev) => {
          if (!prev) return prev;
          let next = applyElapsed(prev, Date.now());

          // Re-add the free 'Toy' if it's not already in the inventory and
          // happiness is high enough. This is the fixed version of the old
          // `(happiness => 51)` bug — a real comparison against the CURRENT
          // state, not a stale closure over the value at mount time.
          if (!next.inventory.find((item) => item.id === "toy") && next.happiness >= 51) {
            next = { ...next, inventory: [...next.inventory, FREE_TOY] };
          }

          stateRef.current = next;
          saveState(next, { force: true }); // always persist on the decay tick
          return next;
        });
      }, TICK_INTERVAL_MS); // Apply elapsed-time decay + toy regen + persist every ~7s
    };

    hydrate();

    // Clear interval and do a final save on unmount.
    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (tickId) clearInterval(tickId);
      if (stateRef.current) {
        saveState(stateRef.current, { force: true });
      }
    };
  }, []);

  // Function to play the pet interaction sound.
  const playSound = async () => {
    const { sound } = await Audio.Sound.createAsync(
      Bark,
      { shouldPlay: true }
    );
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.didJustFinish) {
        await sound.unloadAsync();
      }
    });
  };

  // Single entry point for every user action that mutates pet state (tap,
  // long-press, use-item, shop-buy). Reads the current state from
  // stateRef (not from a setState updater, since saveState() must run
  // OUTSIDE the updater — calling it inside is unsafe: React may invoke an
  // updater more than once under StrictMode/concurrent mode, which would
  // duplicate the AsyncStorage write). `fn` is one of the pure petState.js
  // functions; per that module's convention, a no-op action (e.g. using an
  // item you don't hold, or buying something you can't afford) returns the
  // SAME object back, which we detect via reference equality and bail out
  // of early — no state update, no save, no animation/sound/vibration/toast.
  // `fallbackLabel` covers actions that are real but move none of the three
  // stats describeChange() watches (a Shop purchase only spends points and
  // grows the inventory), so they still get a toast.
  const applyAction = async (fn, options = {}) => {
    const { animate = true, fallbackLabel = "", fallbackTone = "good" } = options;
    const prev = stateRef.current;
    if (!prev) return;

    const next = fn(prev);
    if (next === prev) {
      return; // no-op action — nothing changed, nothing to feed back
    }

    stateRef.current = next;
    if (isMountedRef.current) setState(next);
    saveState(next, { force: true }); // force-save exactly once, outside the updater

    const change = describeChange(prev, next);
    const message = change.changed ? change.label : fallbackLabel;
    const tone = change.changed ? change.tone : fallbackTone;
    if (message && isMountedRef.current) {
      setToast({ message, tone, nonce: toastNonceRef.current++ });
    }

    if (animate) {
      triggerHappyAnimation(); // Trigger animation
      // A failed bark must not reject this handler: Inventory/Shop buttons
      // now route through here and don't await the promise, so a rejection
      // would surface as an unhandled one and skip the vibration below.
      try {
        await playSound(); // Play sound
      } catch (err) {
        console.warn("playSound failed", err);
      }
      triggerVibrationFeedback(); // Vibrate
    }
  };

  // Event handlers for tap and long press gestures on the pet image.
  const handleTap = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      console.log("Pet tapped!");
      await applyAction(petAction); // +2 happiness, small energy cost, points/xp
    }
  };

  // Function to handle long press gesture on the pet image.
  const handleLongPress = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      console.log("Pet long-pressed!");
      await applyAction(playAction); // +15 happiness, bigger energy cost, points/xp
    }
  };

  const handleUseItem = async (item) => {
    await applyAction((prev) => applyItem(prev, item.id)); // no-op if item isn't actually held
  };

  const handleBuy = async (item) => {
    // A purchase moves points/inventory, not happiness/hunger/energy, so it
    // needs an explicit label — describeChange() would report "no change".
    await applyAction((prev) => buyItem(prev, item.id), {
      fallbackLabel: `Bought ${item.name}`,
    }); // no-op if points < item.cost
  };

  if (!state) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.topContainer}>
          <Text style={styles.text}>Loading…</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.topContainer}>
        <Text style={styles.text}>{mood(state)} · Level {state.level}</Text>
        <StatBar label="Happiness" value={state.happiness} color="#4CAF50" />
        <StatBar label="Hunger" value={state.hunger} color="#E57373" />
        <StatBar label="Energy" value={state.energy} color="#64B5F6" />
        <Points points={state.points} />
        <Inventory inventory={state.inventory} onUseItem={handleUseItem} />
        <Shop points={state.points} onBuy={handleBuy} />
      </View>

      <TapGestureHandler onHandlerStateChange={handleTap}>
        <LongPressGestureHandler
          onHandlerStateChange={handleLongPress}
          minDurationMs={800}
        >
          <View style={styles.petContainer}>
          {toast.message ? (
            <StatFeedback message={toast.message} tone={toast.tone} nonce={toast.nonce} />
          ) : null}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>

            <Image
              source={require("../assets/pixelPuppy.png")}
              style={styles.petImage}
            />
            </Animated.View>
          </View>
        </LongPressGestureHandler>
      </TapGestureHandler>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  topContainer: {
    // Takes necessary space only, allowing petContainer to be at the bottom
    justifyContent: "flex-start",
    alignItems: "center",

  },
  container: {
    flex: 1,
    justifyContent: "space-between", // This separates top content and pet container
  },
  text: {
    marginTop: 20, // Adjust as necessary for your layout
    fontSize: 18,
  },
  petContainer: {
    flex: 1, // Take up all available space
    justifyContent: 'flex-end', // Align children (the pet image) to the bottom
    alignItems: 'center', // Center children horizontally
    marginBottom: 50, // If you want some space from the bottom edge
  },
  petImage: {
    width: 200,
    height: 200,
  },
});


export default PetApp;
