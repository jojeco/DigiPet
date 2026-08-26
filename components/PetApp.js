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
import Bark from "../assets/dogBarking.mp3"; // Sound assets for pet interactions
import { Audio } from 'expo-av'; // Module for handling audio playback
import {
  pet as petAction,
  play as playAction,
  useItem as applyItem,
  buyItem,
  applyElapsed,
  mood,
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
  // most recent value without needing state in its dependency array.
  const stateRef = useRef(null);

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

  // Event handlers for tap and long press gestures on the pet image.
  const handleTap = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      console.log("Pet tapped!");
      setState((prev) => {
        if (!prev) return prev;
        const next = petAction(prev); // +2 happiness, small energy cost, points/xp
        stateRef.current = next;
        saveState(next);
        return next;
      });
      triggerHappyAnimation(); // Trigger animation
      await playSound(); // Play sound
      triggerVibrationFeedback(); // Vibrate
    }
  };

  // Function to handle long press gesture on the pet image.
  const handleLongPress = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      console.log("Pet long-pressed!");
      setState((prev) => {
        if (!prev) return prev;
        const next = playAction(prev); // +15 happiness, bigger energy cost, points/xp
        stateRef.current = next;
        saveState(next);
        return next;
      });
      triggerHappyAnimation(); // Trigger animation
      await playSound(); // Play sound
      triggerVibrationFeedback(); // Vibrate
    }
  };


  const handleUseItem = (item) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = applyItem(prev, item.id); // no-op if item isn't actually held
      stateRef.current = next;
      saveState(next);
      return next;
    });
  };

  const handleBuy = (item) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = buyItem(prev, item.id); // no-op if points < item.cost
      stateRef.current = next;
      saveState(next, { force: true });
      return next;
    });
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
