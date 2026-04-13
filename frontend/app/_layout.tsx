import React, { useEffect, useState, useContext } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, Redirect, useSegments, useRouter, useRootNavigationState } from 'expo-router';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider as AppThemeProvider, ThemeContext } from './context/ThemeContext';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import SplashScreenComponent from './components/SplashScreenComponent';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { userToken, isLoading } = useContext(AuthContext);
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!navState?.key) return;

    if (showSplash) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isLoading) {
        if (!userToken && !inAuthGroup) {
          router.replace('/auth/login');
        } else if (userToken && inAuthGroup) {
          router.replace('/');
        }
        SplashScreen.hideAsync();
      }
    }, [userToken, segments, navState?.key, isLoading, showSplash]);

    useEffect(() => {
      if (navState?.key) {
        SplashScreen.hideAsync();
    }
  }, [navState?.key]);

  if (showSplash) {
    return <SplashScreenComponent onFinish={() => setShowSplash(false)} />;
  }
    if (isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size = "Large" color = "#0a7ea4" />
          <Text style={{ marginTop: 10 }}>Loading...</Text>
        </View>
      );
    }
    return <>{children}</>;
}
function ThemedApp() {
  const { colorScheme } = useContext(ThemeContext);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AuthCheck>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </AuthCheck>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedApp />
    </AppThemeProvider>
  );
}
