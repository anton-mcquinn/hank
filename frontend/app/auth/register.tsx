// frontend/app/auth/register.tsx
import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';

export default function RegisterScreen() {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const { register, isLoading, isError, errorMessage } = useContext(AuthContext);

  const handleRegister = async (): Promise<void> => {
    if (username.trim() === '' || email.trim() === '' || password === '') {
      alert('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    await register(username, email, password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={styles.flex} onPress={Keyboard.dismiss}>
        <ThemedView style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText type="title" style={styles.title}>Create Account</ThemedText>

            {isError && (
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            )}

            <ThemedText style={styles.label}>Username</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!isLoading}
            />

            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />

            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />

            <ThemedText style={styles.label}>Confirm Password</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Register</ThemedText>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <ThemedText>Already have an account?</ThemedText>
              <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                <ThemedText style={styles.loginLink}>Log In</ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </ThemedView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f5f5f5',
    color: '#000',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginLink: {
    color: '#0a7ea4',
    fontWeight: '600',
    marginLeft: 5,
  },
});
