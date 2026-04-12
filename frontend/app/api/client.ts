// API client for making HTTP requests to the backend
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const getAuthHeader = async (): Promise<Record<string, string>> => {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
  } catch (error) {
    console.error('Error getting token:', error);
  }
  return {};
};

// Base URL configuration - adjust this based on your environment
const API_URL = {
  // Use localhost for iOS simulator, 10.0.2.2 for Android emulator
  development: Platform.OS === 'ios' 
    ? 'http://192.168.0.89:8000/api/v1'
    : 'http://10.0.2.2:8000/api/v1',
  production: 'https://your-api-domain.com/api/v1'
};

// Get the appropriate API URL based on environment
const getBaseUrl = (): string => {
  // You can expand this logic based on your environment setup
  return __DEV__ ? API_URL.development : API_URL.production;
};

// Default headers for API requests
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Helper to handle API errors
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

export const apiRequest = async <T>(
  endpoint: string,
  method: string = 'GET',
  data?: any,
  customHeaders: Record<string, string> = {}
): Promise<T> => {
  const url = `${getBaseUrl()}${endpoint}`;
  
  // Get auth headers
  const authHeader = await getAuthHeader();
  
  const headers = {
    ...defaultHeaders,
    ...authHeader,
    ...customHeaders,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (data) {
    if (data instanceof FormData) {
      // If we're sending form data, let the browser set the Content-Type
      delete headers['Content-Type'];
      options.body = data;
    } else {
      options.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      throw new ApiError(
        response.status,
        responseData.detail || `API error: ${response.status}`,
        responseData
      );
    }
    
    return responseData as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Rethrow as ApiError for consistent error handling
    throw new ApiError(
      500,
      error instanceof Error ? error.message : 'Unknown error',
      error
    );
  }
};

// Helper methods for common HTTP verbs
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

  // Special method for multipart/form-data uploads
  upload: <T>(endpoint: string, formData: FormData, customHeaders?: Record<string, string>) => {
    const headers = { ...customHeaders };
    // Let the browser set the correct Content-Type with boundary
    return apiRequest<T>(endpoint, 'POST', formData, headers);
  }
};

export default api;
