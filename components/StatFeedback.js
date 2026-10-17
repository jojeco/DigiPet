// components/StatFeedback.js
//
// Small presentational floating toast rendered over the pet, e.g. "Hunger
// -30" after using a Treat. Purely presentational — it holds no game logic
// and starts no timers of its own beyond the fade-up-and-out Animated
// sequence, which auto-runs on mount/prop-change. The parent fully
// controls what's shown by passing `message`/`tone`, and can force a
// retrigger on an otherwise-identical message via a changing `nonce`. The
// optional `onDone` prop lets the parent chain a second message after this
// one's animation genuinely finishes (e.g. draining a toast queue from
// game/feedback.js) — it fires only when the sequence completes on its own,
// never when a newer toast interrupts it early (see the `finished` guard
// below).
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

const TONE_COLORS = {
  good: "#4CAF50",
  bad: "#E57373",
};

const StatFeedback = ({ message, tone, nonce, onDone }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return undefined;

    opacity.setValue(0);
    translateY.setValue(0);

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 150, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -50, duration: 400, useNativeDriver: true }),
      ]),
    ]);
    animation.start(({ finished }) => {
      // `finished` is false when a newer toast interrupts this one via the
      // cleanup's animation.stop() below (e.g. the queue advances, or the
      // message/nonce changes before this sequence completes) — in that
      // case the interrupting run (or nothing, if the queue emptied) owns
      // what happens next, so we must NOT also advance the queue here.
      if (finished && onDone) onDone();
    });

    return () => animation.stop();
    // Re-run whenever the message (or an explicit nonce bump for a repeat
    // message) changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, nonce]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
    >
      <Text style={[styles.text, { color: TONE_COLORS[tone] || TONE_COLORS.good }]}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default StatFeedback;
