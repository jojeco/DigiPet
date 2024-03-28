import React from 'react';
import { SafeAreaView, StyleSheet, ImageBackground} from 'react-native';
import PetApp from '../components/PetApp'; // Adjust the path based on your project structure
import BackgroundImage from "../assets/pixelPetBackground.jpg";

const App = () => {
  return (
    <ImageBackground source={BackgroundImage} style={styles.container}>

    <SafeAreaView style={styles.container}>
      <PetApp />
    </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
