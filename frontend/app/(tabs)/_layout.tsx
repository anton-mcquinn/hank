import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { HapticTab } from '../components/HapticTab';
import { IconSymbol } from '../components/ui/IconSymbol';
import TabBarBackground from '../components/ui/TabBarBackground';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: true,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workorders"
        options={{
          title: 'Work Orders',
          tabBarIcon: ({ color }) => <FontAwesome5 name="clipboard-list" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color }) => <FontAwesome6 name="people-group" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          tabBarIcon: ({ color }) => <FontAwesome6 name="file-invoice-dollar" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <FontAwesome5 name="hamburger" size={24} color={color} />
        }}
      />
    </Tabs>
  );
}
