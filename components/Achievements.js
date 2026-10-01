// components/Achievements.js
//
// Presentational list of achievements — locked vs unlocked, a progress
// indicator per item, and the unlock timestamp once earned. Takes the
// output of game/achievements.js's achievementProgress(state) as `items`.
// Holds no game logic and no timers of its own — purely presentational,
// same convention as StatBar.js/Inventory.js.
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

const Achievements = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Achievements</Text>
      {/* Capped + scrollable so 10 rows never push the pet off-screen on small phones. */}
      <ScrollView style={styles.list} nestedScrollEnabled>
      {items.map((item) => {
        const hasProgress = item.progress && typeof item.progress.current === "number";
        // Guard against a missing/zero target or NaN division so we never render a "NaN%" width.
        const rawPct = hasProgress && item.progress.target
          ? (item.progress.current / item.progress.target) * 100
          : 0;
        const pct = item.unlocked
          ? 100
          : Math.max(0, Math.min(100, Number.isFinite(rawPct) ? rawPct : 0));

        return (
          <View key={item.id} style={[styles.row, item.unlocked && styles.rowUnlocked]}>
            <Text style={styles.name}>
              {item.unlocked ? "✓ " : "• "}
              {item.name}
            </Text>
            <Text style={styles.description}>{item.description}</Text>
            {hasProgress ? (
              <>
                <Text style={styles.progress}>
                  {Math.min(item.progress.current, item.progress.target)} / {item.progress.target}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${pct}%` },
                      item.unlocked && styles.progressFillDone,
                    ]}
                  />
                </View>
              </>
            ) : null}
            {item.unlocked && item.unlockedAt ? (
              <Text style={styles.timestamp}>
                Unlocked {new Date(item.unlockedAt).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "90%",
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  list: {
    maxHeight: 240,
  },
  row: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
    opacity: 0.6,
  },
  rowUnlocked: {
    opacity: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
  },
  description: {
    fontSize: 12,
    color: "#666",
  },
  progress: {
    fontSize: 12,
    color: "#333",
  },
  progressTrack: {
    height: 5,
    width: "100%",
    backgroundColor: "#ddd",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#4CAF50",
  },
  progressFillDone: {
    backgroundColor: "#2e7d32",
  },
  timestamp: {
    fontSize: 11,
    color: "#999",
  },
});

export default Achievements;
