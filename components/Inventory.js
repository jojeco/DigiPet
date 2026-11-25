import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { groupInventory, formatEffects } from '../game/petState';

const Inventory = ({ inventory, onUseItem }) => {
  const groups = groupInventory(inventory);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory:</Text>
      {groups.length === 0 && <Text>No items</Text>}
      {groups.map(({ item, count }) => {
        const effectsLabel = formatEffects(item.effects);
        return (
          <Button
            key={item.id}
            title={`Use ${item.name}${count > 1 ? ` (x${count})` : ''}${effectsLabel ? ` · ${effectsLabel}` : ''}`}
            onPress={() => onUseItem(item)}
          />
        );
      })}
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
