import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TapGestureHandler,
  LongPressGestureHandler,
  State,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Inventory from "./Inventory";
import Points from "./Points";

const PetApp = () => {
  const [happiness, setHappiness] = useState(100);
  const [points, setPoints] = useState(0);
  const [inventory, setInventory] = useState([{ name: "Toy", effect: 10 }]); // Example item

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

  const handleTap = ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      console.log("Pet tapped!");
      setHappiness((prevHappiness) => Math.min(100, prevHappiness + 5));
    }
  };

  const handleLongPress = ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      console.log("Pet long-pressed!");
      setHappiness((prevHappiness) => Math.min(100, prevHappiness + 20));
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
      <View style={styles.container}>
        <Text style={styles.text}>Pet Happiness: {happiness}</Text>
        <TapGestureHandler onHandlerStateChange={handleTap}>
          <LongPressGestureHandler
            onHandlerStateChange={handleLongPress}
            minDurationMs={800}
          >
            <View style={styles.petContainer}>
              <Image
                source={require("../assets/PixelPuppy1.jpg")}
                style={styles.petImage}
              />
              <Points points={points} />
              <Inventory inventory={inventory} onUseItem={handleUseItem} />
            </View>
          </LongPressGestureHandler>
        </TapGestureHandler>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    marginBottom: 20,
    fontSize: 18,
  },
  petContainer: {
    alignItems: "center",
  },
  petImage: {
    width: 200,
    height: 200,
  },
});

export default PetApp;
