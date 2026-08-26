import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Small presentational stat bar: a label, a numeric value, and a filled
// track whose width is the stat's percentage of max. Used three times in
// PetApp.js (happiness / hunger / energy). Purely presentational — no
// state, no game logic.
const StatBar = ({ label, value, max = 100, color = "#4CAF50" }) => {
  // Guard against a missing/NaN stat so we never render a "NaN%" width.
  const safeValue = Number.isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(100, (safeValue / max) * 100));

  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {label}: {Math.round(safeValue)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    width: "80%",
    marginVertical: 4,
  },
  label: {
    fontSize: 14,
    marginBottom: 2,
  },
  track: {
    height: 10,
    width: "100%",
    backgroundColor: "#ddd",
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
  },
});

export default StatBar;
