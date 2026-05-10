// API client for making HTTP requests to the backend
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'userToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const tokenStorage = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setPair: async (access: string, refresh: string) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};

export const getAuthHeader = async (): Promise<Record<string, string>> => {
  try {
    const token = await tokenStorage.getAccess();
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
  } catch (error) {
    console.error('Error getting token:', error);
  }
  return {};
};

// iOS simulator shares the host's loopback; Android emulator reaches the host via 10.0.2.2.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

const API_URL = {
  development: `http://${DEV_HOST}:8000/api/v1`,
  production: 'https://hank.idleworkshop.com/api/v1',
};

const getBaseUrl = (): string => {
  return __DEV__ ? API_URL.development : API_URL.production;
};

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

// Auth-failure callback wired up by AuthContext so we can trigger a logout
// when refresh fails (refresh token expired/invalid).
let onAuthFailure: (() => void) | null = null;
export const setOnAuthFailure = (cb: (() => void) | null) => {
  onAuthFailure = cb;
};

// Single in-flight refresh promise so concurrent 401s coalesce into one /auth/refresh call.
let refreshInFlight: Promise<string | null> | null = null;

const performRefresh = async (): Promise<string | null> => {
  const refreshToken = await tokenStorage.getRefresh();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.access_token || !data.refresh_token) return null;
    await tokenStorage.setPair(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
};

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const buildOptions = (
  method: string,
  data: any,
  authHeader: Record<string, string>,
  customHeaders: Record<string, string>,
): RequestInit => {
  const headers: Record<string, string> = {
    ...defaultHeaders,
    ...authHeader,
    ...customHeaders,
  };
  const options: RequestInit = { method, headers };
  if (data) {
    if (data instanceof FormData) {
      delete headers['Content-Type'];
      options.body = data;
    } else {
      options.body = JSON.stringify(data);
    }
  }
  return options;
};

export const apiRequest = async <T>(
  endpoint: string,
  method: string = 'GET',
  data?: any,
  customHeaders: Record<string, string> = {},
): Promise<T> => {
  const url = `${getBaseUrl()}${endpoint}`;

  const send = async (authHeader: Record<string, string>) => {
    const response = await fetch(url, buildOptions(method, data, authHeader, customHeaders));
    const responseData = await response.json().catch(() => ({}));
    return { response, responseData };
  };

  try {
    let { response, responseData } = await send(await getAuthHeader());

    // Auth endpoints don't refresh themselves — refreshing on /auth/refresh
    // would be infinite recursion; refreshing on /auth/token is meaningless
    // (the user is logging in).
    const isAuthEndpoint = endpoint.startsWith('/auth/token') || endpoint.startsWith('/auth/refresh');

    if (response.status === 401 && !isAuthEndpoint) {
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        ({ response, responseData } = await send({ Authorization: `Bearer ${newAccess}` }));
      } else {
        // Refresh failed — clear tokens and let the app know to bounce to login.
        await tokenStorage.clear();
        onAuthFailure?.();
      }
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        responseData.detail || `API error: ${response.status}`,
        responseData,
      );
    }

    return responseData as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      error instanceof Error ? error.message : 'Unknown error',
      error,
    );
  }
};

export const api = {
  getBaseUrl,

  get: <T>(endpoint: string, customHeaders?: Record<string, string>) =>
    apiRequest<T>(endpoint, 'GET', undefined, customHeaders),

  post: <T>(endpoint: string, data?: any, customHeaders?: Record<string, string>) =>
    apiRequest<T>(endpoint, 'POST', data, customHeaders),

  put: <T>(endpoint: string, data?: any, customHeaders?: Record<string, string>) =>
    apiRequest<T>(endpoint, 'PUT', data, customHeaders),

  delete: <T>(endpoint: string, customHeaders?: Record<string, string>) =>
    apiRequest<T>(endpoint, 'DELETE', undefined, customHeaders),

  upload: <T>(endpoint: string, formData: FormData, customHeaders?: Record<string, string>) => {
    const headers = { ...customHeaders };
    return apiRequest<T>(endpoint, 'POST', formData, headers);
  },
};

export default api;
