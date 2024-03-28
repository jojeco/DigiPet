import React from 'react';
import { SafeAreaView, StyleSheet, ImageBackground } from 'react-native';
import PetApp from '../components/PetApp'; // Ensure the path is correct
import BackgroundImage1 from "../assets/landscape_pinktrees.jpg"; // Use just one background image variable for simplicity
import BackgroundImage2 from "../assets/pixelPetBackground.jpg";

const App = () => {
  return (
    <ImageBackground source={BackgroundImage2} style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <PetApp />
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1, // Ensure the background image covers the whole screen
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // Ensure the container fills the width inside SafeAreaView
  },
});

export default App;
