import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

const Inventory = ({ inventory, onUseItem }) => {
  // Group by item.id so buying the same item multiple times shows one
  // button with a count, instead of one stale-keyed button per purchase.
  const groups = [];
  const groupsById = {};
  for (const item of inventory) {
    const group = groupsById[item.id];
    if (group) {
      group.count += 1;
    } else {
      groupsById[item.id] = { item, count: 1 };
      groups.push(groupsById[item.id]);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory:</Text>
      {groups.length === 0 && <Text>No items</Text>}
      {groups.map(({ item, count }) => (
        <Button
          key={item.id}
          title={`Use ${item.name}${count > 1 ? ` (x${count})` : ''}`}
          onPress={() => onUseItem(item)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  title: {
    fontSize: 18,
    marginBottom: 10,
  },
});

export default Inventory;
