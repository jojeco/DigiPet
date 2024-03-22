import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import PetApp from '../components/PetApp'; // Adjust the path based on your project structure

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <PetApp />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
