// frontend/app/context/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';

// Define types for context data
interface User {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}

interface AuthContextType {
  isLoading: boolean;
  userToken: string | null;
  userInfo: User | null;
  isError: boolean;
  errorMessage: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create context with default values
export const AuthContext = createContext<AuthContextType>({
  isLoading: false,
  userToken: null,
  userInfo: null,
  isError: false,
  errorMessage: '',
  login: async () => {},
  logout: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Load token on startup
  useEffect(() => {
    bootstrapAsync();
  }, []);

  // Function to load stored token
  const bootstrapAsync = async (): Promise<void> => {
    try {
      const storedToken = await SecureStore.getItemAsync('userToken');
      if (storedToken) {
        // Validate the token before exposing it to the app
        await getUserInfo(storedToken);
      }
    } catch (error) {
      console.error('Error loading token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get user info with token
  const getUserInfo = async (token: string): Promise<void> => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`${api.getBaseUrl()}/auth/me`, { headers });

      if (!response.ok) {
        // Invalid or expired token — clear it silently without setting an error
        await SecureStore.deleteItemAsync('userToken');
        return;
      }

      const data = await response.json();
      setUserToken(token);
      setUserInfo(data);
    } catch (error) {
      console.error('Error fetching user info:', error);
      await SecureStore.deleteItemAsync('userToken');
    }
  };

  // Login function
  const login = async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    setIsError(false);
    
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await fetch(`${api.getBaseUrl()}/auth/token`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUserToken(data.access_token);
        await SecureStore.setItemAsync('userToken', data.access_token);
        await getUserInfo(data.access_token);
      } else {
        setIsError(true);
        setErrorMessage(data.detail || 'Login failed');
      }
    } catch (error) {
      setIsError(true);
      setErrorMessage('Network error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setUserToken(null);
    setUserInfo(null);
    await SecureStore.deleteItemAsync('userToken');
    setIsLoading(false);
  };

  // Create authentication context value
  const authContext: AuthContextType = {
    isLoading,
    userToken,
    userInfo,
    isError,
    errorMessage,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};
