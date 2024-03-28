
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, Animated, Vibration } from "react-native"; // Corrected import
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TapGestureHandler,
  LongPressGestureHandler,
  State,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Inventory from "./Inventory";
import Points from "./Points";
import Bark from "../assets/dogBarking.mp3"; 
import Bark2 from "../assets/dogBarking2.mp3";
import { Audio } from 'expo-av';


const PetApp = () => {
  const [happiness, setHappiness] = useState(100);
  const [points, setPoints] = useState(0);
  const [inventory, setInventory] = useState([{ name: "Toy", effect: 10 }]); // Example item
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const triggerVibrationFeedback = () => {
    Vibration.vibrate(100); // Vibrate for 100 milliseconds
  };

  const triggerHappyAnimation = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  

  useEffect(() => {
    const loadHappiness = async () => {
      const savedHappiness = await AsyncStorage.getItem("happiness");
      if (savedHappiness !== null) {
        setHappiness(JSON.parse(savedHappiness));
      }
    };

    loadHappiness();

    const intervalId = setInterval(() => {
      setHappiness((prevHappiness) => {
        const newHappiness = Math.max(0, prevHappiness - 1);
        AsyncStorage.setItem("happiness", JSON.stringify(newHappiness));
        return newHappiness;
      });
    }, 6000); // Adjust the interval as necessary

    return () => clearInterval(intervalId);
  }, []);
  
  const playSound = async () => {
    const { sound } = await Audio.Sound.createAsync(
      Bark,
      { shouldPlay: true }
    );
    await sound.playAsync();
    
    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.didJustFinish) {
        await sound.unloadAsync();
      }
    });
  };

  const handleTap = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      console.log("Pet tapped!");
      setHappiness(prevHappiness => Math.min(100, prevHappiness + 5));
      triggerHappyAnimation(); // Trigger animation
      await playSound(); // Play sound
      triggerVibrationFeedback(); // Vibrate
    }
  };
  
  const handleLongPress = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      console.log("Pet long-pressed!");
      setHappiness(prevHappiness => Math.min(100, prevHappiness + 20));
      triggerHappyAnimation(); // Trigger animation
      await playSound(); // Play sound
      triggerVibrationFeedback(); // Vibrate
    }
  };
  
  
  const handleUseItem = (item) => {
    // Example: increase happiness with the item's effect
    setHappiness((current) => Math.min(100, current + item.effect));
    // Remove item from inventory after use
    setInventory((current) => current.filter((i) => i !== item));
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.topContainer}>
        <Text style={styles.text}>Pet Happiness: {happiness}</Text>
        <Points points={points} />
        <Inventory inventory={inventory} onUseItem={handleUseItem} />
      </View>
      
      <TapGestureHandler onHandlerStateChange={handleTap}>
        <LongPressGestureHandler
          onHandlerStateChange={handleLongPress}
          minDurationMs={800}
        >
          <View style={styles.petContainer}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>

            <Image
              source={require("../assets/pixelPuppy.png")}
              style={styles.petImage}
            />
            </Animated.View>
          </View>
        </LongPressGestureHandler>
      </TapGestureHandler>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  topContainer: {
    // Takes necessary space only, allowing petContainer to be at the bottom
    justifyContent: "flex-start",
    alignItems: "center",
    
  },
  container: {
    flex: 1,
    justifyContent: "space-between", // This separates top content and pet container
  },
  text: {
    marginTop: 20, // Adjust as necessary for your layout
    fontSize: 18,
  },
  petContainer: {
    flex: 1, // Take up all available space
    justifyContent: 'flex-end', // Align children (the pet image) to the bottom
    alignItems: 'center', // Center children horizontally
    marginBottom: 50, // If you want some space from the bottom edge
  },
  petImage: {
    width: 200,
    height: 200,
  },
});


export default PetApp;
