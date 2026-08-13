import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

// Shop items configuration
const FOOD_COST = 20;
const FOOD_HUNGER_BONUS = 40;
const TOY_COST = 15;
const TOY_HAPPINESS_BONUS = 30;

const Shop = ({ points, setPoints, hunger, setHunger, setHappiness }) => {
  const canAffordFood = points >= FOOD_COST;
  const canAffordToy = points >= TOY_COST;

  const buyFood = () => {
    if (!canAffordFood) return;
    setPoints((p) => p - FOOD_COST);
    setHunger((h) => Math.min(100, h + FOOD_HUNGER_BONUS));
  };

  const buyToy = () => {
    if (!canAffordToy) return;
    setPoints((p) => p - TOY_COST);
    setHappiness((h) => Math.min(100, h + TOY_HAPPINESS_BONUS));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shop — {points} pts</Text>
      <View style={styles.item}>
        <Text style={styles.itemLabel}>Food ({FOOD_COST} pts) +{FOOD_HUNGER_BONUS} Hunger</Text>
        <Button title="Buy" onPress={buyFood} disabled={!canAffordFood} />
      </View>
      <View style={styles.item}>
        <Text style={styles.itemLabel}>Toy ({TOY_COST} pts) +{TOY_HAPPINESS_BONUS} Happiness</Text>
        <Button title="Buy" onPress={buyToy} disabled={!canAffordToy} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 3,
    width: '90%',
    paddingHorizontal: 6,
  },
  itemLabel: {
    fontSize: 14,
    flex: 1,
    flexWrap: 'wrap',
    marginRight: 8,
  },
});

export default Shop;
