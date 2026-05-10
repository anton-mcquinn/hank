import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';

export default function LoginScreen() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const { login, isLoading, isError, errorMessage } = useContext(AuthContext);

  const handleLogin = async (): Promise<void> => {
    if (username.trim() === '' || password === '') {
      alert('Please enter both username and password');
      return;
    }
    
    await login(username, password);
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
            <ThemedText type="title" style={styles.appName}>Virtual Service Writer</ThemedText>
            <ThemedText type="title" style={styles.title}>Log In</ThemedText>

            {isError && (
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            )}

            <ThemedText style={styles.label}>Username or Email</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
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

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Log In</ThemedText>
              )}
            </TouchableOpacity>
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
  appName: {
    textAlign: 'center',
    marginBottom: 4,
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
});
