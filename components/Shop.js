import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { SHOP_ITEMS } from "../game/petState";

// Catalogue-driven shop. Rendering only — no game logic here. Pressing a
// button calls onBuy(item); PetApp is responsible for calling the pure
// buyItem(state, itemId) from petState.js and updating/persisting state.
// Mirrors the plain <Button> style used in Inventory.js.
const Shop = ({ points, onBuy }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shop:</Text>
      {SHOP_ITEMS.map((item) => (
        <Button
          key={item.id}
          title={`${item.name} (${item.cost} pts)`}
          onPress={() => onBuy(item)}
          disabled={points < item.cost}
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

export default Shop;
