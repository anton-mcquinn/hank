import React, { useState, useContext } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
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
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.appName}>Virtual Service Writer</ThemedText>
      <ThemedText type="title" style={styles.title}>Log In</ThemedText>
      
      {isError && (
        <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
      )}
      
      <TextInput
        style={styles.input}
        placeholder="Username or Email"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        editable={!isLoading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
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
      
      <View style={styles.registerContainer}>
        <ThemedText>Don't have an account?</ThemedText>
        <TouchableOpacity onPress={() => router.replace('/auth/register')}>
          <ThemedText style={styles.registerLink}>Register</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  input: {
    backgroundColor: '#f5f5f5',
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerLink: {
    color: '#0a7ea4',
    fontWeight: '600',
    marginLeft: 5,
  },
});
