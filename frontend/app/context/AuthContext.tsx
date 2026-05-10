// frontend/app/context/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import api, { tokenStorage, setOnAuthFailure, ApiError } from '../api/client';

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

  // When the api client fails to refresh, clear local state so the app bounces to /auth/login.
  useEffect(() => {
    setOnAuthFailure(() => {
      setUserToken(null);
      setUserInfo(null);
    });
    return () => setOnAuthFailure(null);
  }, []);

  // Load tokens on startup and try to fetch the current user.
  // The api client transparently refreshes a stale access token if a valid refresh token exists.
  useEffect(() => {
    (async () => {
      try {
        const storedAccess = await tokenStorage.getAccess();
        if (!storedAccess) return;

        try {
          const me = await api.get<User>('/auth/me');
          // Re-read from storage in case the api client rotated tokens during /auth/me.
          const currentAccess = await tokenStorage.getAccess();
          setUserToken(currentAccess);
          setUserInfo(me);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await tokenStorage.clear();
          } else {
            console.error('Bootstrap auth error:', error);
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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

      if (!response.ok) {
        setIsError(true);
        setErrorMessage(data.detail || 'Login failed');
        return;
      }

      await tokenStorage.setPair(data.access_token, data.refresh_token);
      setUserToken(data.access_token);

      const me = await api.get<User>('/auth/me');
      setUserInfo(me);
    } catch (error) {
      setIsError(true);
      setErrorMessage('Network error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setUserToken(null);
    setUserInfo(null);
    await tokenStorage.clear();
    setIsLoading(false);
  };

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
