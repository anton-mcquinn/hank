// frontend/app/components/SplashScreenComponent.tsx
import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import ThemedText from './ThemedText';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreenComponent: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = new Animated.Value(0);
  const translateY = new Animated.Value(50);

  useEffect(() => {
    // Animation sequence
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      })
    ]).start();

    // Delay before calling onFinish
    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY }]
      }}>
        <Image
          source={require('../../assets/splash.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText type="title" style={styles.title}>
          Virtual Service Writer
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Streamline your automotive business
        </ThemedText>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default SplashScreenComponent;
