import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { toyCooldownRemainingMs, formatCooldown } from '../game/petState';

// Presentational countdown for the free toy's cooldown. Purely a display
// concern: it keeps its own 1s `now` clock and never writes game state or
// saves anything — PetApp's tick (maybeRegenToy) is what actually brings the
// toy back. Renders nothing when the toy is held and there's nothing to wait for.
const ToyCooldown = ({ toyAvailableAt, hasToy }) => {
  const [now, setNow] = useState(Date.now());

  const remainingMs = toyCooldownRemainingMs(
    { inventory: hasToy ? [{ id: 'toy' }] : [], toyAvailableAt },
    now
  );
  const counting = remainingMs > 0;

  // Only run the interval while there's actually something to count down.
  // Re-syncs `now` immediately so a stale clock doesn't flash old text.
  useEffect(() => {
    if (!counting) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  if (hasToy) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {counting ? `Toy back in ${formatCooldown(remainingMs)}` : 'Toy coming back…'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  text: {
    fontSize: 16,
  },
});

export default ToyCooldown;
