import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

const Inventory = ({ inventory, onUseItem }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory:</Text>
      {inventory.map((item, index) => (
        <Button key={index} title={`Use ${item.name}`} onPress={() => onUseItem(item)} />
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
