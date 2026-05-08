import React, { useContext } from "react";
import {
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  View,
  Alert
} from "react-native";
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import ThemedText from "../components/ThemedText";
import ThemedView from "../components/ThemedView";
import { Colors } from "../constants/Colors";
import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../context/ThemeContext";

const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

export default function More() {
  const { colorScheme, preference, setPreference } = useContext(ThemeContext);
  const { logout, userInfo } = useContext(AuthContext);

  const isSystemTheme = preference === 'system';
  const isDarkMode = colorScheme === 'dark';

  const handleToggleSystemTheme = (value: boolean) => {
    setPreference(value ? 'system' : (isDarkMode ? 'dark' : 'light'));
  };

  const handleToggleDarkMode = (value: boolean) => {
    setPreference(value ? 'dark' : 'light');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* THEMING SECTION */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Appearance</ThemedText>
          
          <ThemedView 
            style={styles.settingItem}
            lightColor="#ffffff"
            darkColor="#333333"
          >
            <View style={styles.settingItemContent}>
              <View style={styles.settingItemIcon}>
                <Ionicons 
                  name="phone-portrait-outline" 
                  size={24} 
                  color={colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon} 
                />
              </View>
              <ThemedText>Use device settings</ThemedText>
            </View>
            <Switch
              value={isSystemTheme}
              onValueChange={handleToggleSystemTheme}
              trackColor={{ false: "#767577", true: "#4a90e2" }}
              thumbColor={"#f4f3f4"}
            />
          </ThemedView>
          
          <ThemedView 
            style={styles.settingItem}
            lightColor="#ffffff"
            darkColor="#333333"
          >
            <View style={styles.settingItemContent}>
              <View style={styles.settingItemIcon}>
                <Ionicons 
                  name={isDarkMode ? "moon" : "sunny"} 
                  size={24} 
                  color={colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon} 
                />
              </View>
              <ThemedText>Dark theme</ThemedText>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={handleToggleDarkMode}
              disabled={isSystemTheme}
              trackColor={{ false: "#767577", true: "#4a90e2" }}
              thumbColor={"#f4f3f4"}
              style={{ opacity: isSystemTheme ? 0.5 : 1 }}
            />
          </ThemedView>
        </ThemedView>
        
        {/* SHOP SECTION */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Shop</ThemedText>

          <TouchableOpacity
            style={styles.menuItem}
            lightColor="#ffffff"
            darkColor="#333333"
            onPress={() => router.push('/shop/edit')}
          >
            <View style={styles.menuItemContent}>
              <View style={styles.menuItemIcon}>
                <FontAwesome5
                  name="store"
                  size={20}
                  color={colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon}
                />
              </View>
              <ThemedText>Shop Info</ThemedText>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon}
            />
          </TouchableOpacity>
        </ThemedView>

        {/* HELP & SUPPORT SECTION */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Help & Support</ThemedText>
          
          <TouchableOpacity 
            style={styles.menuItem}
            lightColor="#ffffff"
            darkColor="#333333"
            onPress={() => Alert.alert("Coming Soon", "User guide will be available in a future update.")}
          >
            <View style={styles.menuItemContent}>
              <View style={styles.menuItemIcon}>
                <FontAwesome5 
                  name="book" 
                  size={20} 
                  color={colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon} 
                />
              </View>
              <ThemedText>User Guide</ThemedText>
            </View>
            <MaterialIcons 
              name="chevron-right" 
              size={24} 
              color={colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon} 
            />
          </TouchableOpacity>
        </ThemedView>
        
        {/* ABOUT SECTION */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">About</ThemedText>
          
          <ThemedView 
            style={styles.infoCard}
            lightColor="#f8f8f8"
            darkColor="#222"
          >
            <ThemedText style={styles.appName}>Virtual Service Writer</ThemedText>
            <ThemedText style={styles.versionText}>Version {APP_VERSION}</ThemedText>
            <ThemedText style={styles.copyrightText}>© 2025 Auto Shop Software</ThemedText>
          </ThemedView>
        </ThemedView>

        {/* ACCOUNT SECTION */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Account</ThemedText>

          {userInfo && (
            <ThemedView
              style={styles.settingItem}
              lightColor="#ffffff"
              darkColor="#333333"
            >
              <View style={styles.settingItemContent}>
                <View style={styles.settingItemIcon}>
                  <FontAwesome5
                    name="user-circle"
                    size={22}
                    color={colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon}
                  />
                </View>
                <View>
                  <ThemedText style={{ fontWeight: '600' }}>{userInfo.username}</ThemedText>
                  <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{userInfo.email}</ThemedText>
                </View>
              </View>
            </ThemedView>
          )}

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() =>
              Alert.alert('Log Out', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log Out', style: 'destructive', onPress: logout },
              ])
            }
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.logoutIcon} />
            <ThemedText style={styles.logoutText}>Log Out</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  settingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemIcon: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  versionText: {
    marginBottom: 4,
  },
  copyrightText: {
    opacity: 0.7,
    fontSize: 12,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#d0021b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
