import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Points = ({ points }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Points: {points}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 20,
  },
  text: {
    fontSize: 18,
  },
});

export default Points;
