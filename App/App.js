import React from 'react';
import { SafeAreaView, StyleSheet, ImageBackground} from 'react-native';
import PetApp from '../components/PetApp'; // Adjust the path based on your project structure
import BackgroundImage1 from "../assets/pixelPetBackground.jpg";
import BackgroundImage2 from "../assets/landscape_pinktrees.jpg";



const App = () => {
  return (
    <ImageBackground source={BackgroundImage2} style={styles.container}>

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
