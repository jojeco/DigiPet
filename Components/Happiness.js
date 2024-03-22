import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PetComponent = () => {
    const [happiness, setHappiness] = useState(100);

    useEffect(() => {
        // Load the saved state
        const loadState = async () => {
            const savedHappiness = await AsyncStorage.getItem('happiness');
            if (savedHappiness) {
                setHappiness(parseInt(savedHappiness, 10));
            }
        };
        
        loadState();

        // Decrease happiness over time
        const interval = setInterval(() => {
            setHappiness(prevHappiness => Math.max(0, prevHappiness - 1));
        }, 60000); // Decrease every minute for simplicity

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Save the state on change
        AsyncStorage.setItem('happiness', happiness.toString());
    }, [happiness]);

    const increaseHappiness = () => {
        setHappiness(prevHappiness => Math.min(100, prevHappiness + 10));
    };

    return (
        <View>
            <Text>Happiness: {happiness}</Text>
            <TouchableOpacity onPress={increaseHappiness}>
                <Text>Pet Me</Text>
            </TouchableOpacity>
        </View>
    );
};
