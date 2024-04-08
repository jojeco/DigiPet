// Importing necessary modules and components from React, React Native, AsyncStorage for persistent storage,
// gesture handlers for interactive animations, and sound management from expo-av.
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, Animated, Vibration } from "react-native"; // Corrected import
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TapGestureHandler,
  LongPressGestureHandler,
  State,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Inventory from "./Inventory"; // Custom component for managing inventory items
import Points from "./Points"; // Custom component for displaying points
import Bark from "../assets/dogBarking.mp3"; // Sound assets for pet interactions
import { Audio } from 'expo-av'; // Module for handling audio playback


const PetApp = () => {
    // State hooks for managing dynamic values: pet's happiness, player's points, and the inventory of items.

  const [happiness, setHappiness] = useState(100); // Pet's current happiness level
  const [points, setPoints] = useState(0); // Player's current points
  const [inventory, setInventory] = useState([{ name: "Toy", effect: 50 }]);// Current inventory items
 
  // useRef hook to manage the animation scale for the pet image.
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Function to trigger device vibration as feedback.
  const triggerVibrationFeedback = () => {
    Vibration.vibrate(100); // Vibrate for 100 milliseconds
  };

  // Function to trigger a happy animation for the pet image.
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
  
  
  // useEffect hook to manage the persistence of pet happiness and the intervals for decreasing happiness and adding items to the inventory.
  useEffect(() => {
    const loadHappiness = async () => {
      const savedHappiness = await AsyncStorage.getItem("happiness");
      if (savedHappiness !== null) {
        setHappiness(JSON.parse(savedHappiness));
      }
    };

    loadHappiness();

    const happinessIntervalId = setInterval(() => {
      setHappiness((prevHappiness) => {
        const newHappiness = Math.max(0, prevHappiness - 1);
        AsyncStorage.setItem("happiness", JSON.stringify(newHappiness));
        return newHappiness;
      });
    }, 6000); // Decrease happiness every minute // Decrease happiness every minute

    // Interval to add 'Toy' item to inventory if it's not already there and pet's happiness is not too high
    const toyIntervalId = setInterval(() => {
      setInventory((currentInventory) => {
        if (!currentInventory.find(item => item.name === "Toy" )&& (happiness => 51)) {
          return [...currentInventory, { name: "Toy", effect: 20 }];
        }
        return currentInventory;
      });
    }, 5000); // Re-add 'Toy' every 2 minutes

    // Clear intervals on component unmount
    return () => {
      clearInterval(happinessIntervalId);
      clearInterval(toyIntervalId);
    };
  }, []);
  
  // Function to play the pet interaction sound.
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

  // Event handlers for tap and long press gestures on the pet image.
  const handleTap = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      console.log("Pet tapped!");
      setHappiness(prevHappiness => Math.min(100, prevHappiness + 2));
      triggerHappyAnimation(); // Trigger animation
      await playSound(); // Play sound
      triggerVibrationFeedback(); // Vibrate
    }
  };
  
  // Function to handle long press gesture on the pet image.
  const handleLongPress = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      console.log("Pet long-pressed!");
      setHappiness(prevHappiness => Math.min(100, prevHappiness + 15));
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
