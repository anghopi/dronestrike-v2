/**
 * WHITE BOX TESTS - API Client Internal Logic
 * Tests internal implementation of API client class
 */

import { apiClient } from '../../services/api';
import { LoginRequest } from '../../types';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  })),
}));

describe('WHITE BOX: API Client Internal Implementation', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Get reference to mocked axios instance
    const axios = require('axios');
    mockAxiosInstance = axios.create();
  });

  describe('Authentication Token Management', () => {
    test('setAuthToken method correctly sets authorization header', () => {
      const token = 'test-access-token';
      
      // Access private method through type assertion
      (apiClient as any).setAuthToken(token);
      
      expect((apiClient as any).accessToken).toBe(token);
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', token);
    });

    test('clearAuthToken method removes all authentication data', () => {
      // Set up initial state
      (apiClient as any).accessToken = 'test-token';
      
      (apiClient as any).clearAuthToken();
      
      expect((apiClient as any).accessToken).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    });

    test('constructor loads token from localStorage', () => {
      localStorage.setItem('access_token', 'stored-token');
      
      // Create new instance to test constructor
      const { APIClient } = require('../../services/api');
      const newClient = new (APIClient as any)();
      
      expect(newClient.accessToken).toBe('stored-token');
    });
  });

  describe('Request Interceptor Logic', () => {
    test('request interceptor adds authorization header when token exists', () => {
      const mockConfig = { headers: {} };
      
      // Set token
      (apiClient as any).accessToken = 'test-token';
      
      // Get the interceptor function
      const interceptorCalls = mockAxiosInstance.interceptors.request.use.mock.calls;
      const requestInterceptor = interceptorCalls[0][0];
      
      const result = requestInterceptor(mockConfig);
      
      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    test('request interceptor does not add header when no token', () => {
      const mockConfig = { headers: {} };
      
      // Ensure no token
      (apiClient as any).accessToken = null;
      
      const interceptorCalls = mockAxiosInstance.interceptors.request.use.mock.calls;
      const requestInterceptor = interceptorCalls[0][0];
      
      const result = requestInterceptor(mockConfig);
      
      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor Error Handling', () => {
    test('response interceptor handles 401 errors by clearing tokens', async () => {
      const mockError = {
        response: { status: 401 },
        config: {},
      };

      // Set up token
      (apiClient as any).accessToken = 'expired-token';
      localStorage.setItem('access_token', 'expired-token');

      const interceptorCalls = mockAxiosInstance.interceptors.response.use.mock.calls;
      const errorInterceptor = interceptorCalls[0][1];

      try {
        await errorInterceptor(mockError);
      } catch (error) {
        // Expected to throw
      }

      expect((apiClient as any).accessToken).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
    });

    test('response interceptor attempts token refresh on 401', async () => {
      const mockError = {
        response: { status: 401 },
        config: { _retry: false },
      };

      localStorage.setItem('refresh_token', 'valid-refresh-token');
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { access: 'new-access-token' }
      });

      const interceptorCalls = mockAxiosInstance.interceptors.response.use.mock.calls;
      const errorInterceptor = interceptorCalls[0][1];

      await errorInterceptor(mockError);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/refresh/', {
        refresh: 'valid-refresh-token'
      });
    });
  });

  describe('Login Method Internal Logic', () => {
    test('login method correctly processes successful response', async () => {
      const credentials: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      };

      const mockResponse = {
        data: {
          access: 'new-access-token',
          refresh: 'new-refresh-token'
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.login(credentials);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/login/', credentials);
      expect(result).toEqual(mockResponse.data);
      expect((apiClient as any).accessToken).toBe('new-access-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'new-refresh-token');
    });

    test('login method handles API errors correctly', async () => {
      const credentials: LoginRequest = {
        username: 'baduser',
        password: 'badpass'
      };

      const mockError = new Error('Invalid credentials');
      mockAxiosInstance.post.mockRejectedValueOnce(mockError);

      await expect(apiClient.login(credentials)).rejects.toThrow('Invalid credentials');
      expect((apiClient as any).accessToken).toBeNull();
    });
  });

  describe('Generic HTTP Methods Implementation', () => {
    test('get method passes parameters correctly', async () => {
      const mockResponse = { data: ['item1', 'item2'] };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.get('/api/test', { params: { page: 1 } });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/test', { params: { page: 1 } });
      expect(result).toBe(mockResponse);
    });

    test('post method sends data correctly', async () => {
      const testData = { name: 'test', value: 123 };
      const mockResponse = { data: { id: 1, ...testData } };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.post('/api/test', testData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/test', testData, undefined);
      expect(result).toBe(mockResponse);
    });

    test('patch method updates data correctly', async () => {
      const updateData = { status: 'updated' };
      const mockResponse = { data: { id: 1, ...updateData } };
      mockAxiosInstance.patch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.patch('/api/test/1', updateData);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/api/test/1', updateData, undefined);
      expect(result).toBe(mockResponse);
    });

    test('delete method removes resource correctly', async () => {
      const mockResponse = { data: null };
      mockAxiosInstance.delete.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.delete('/api/test/1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/test/1', undefined);
      expect(result).toBe(mockResponse);
    });
  });

  describe('Error Handling Internal Logic', () => {
    test('network errors are properly propagated', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      
      mockAxiosInstance.get.mockRejectedValueOnce(networkError);

      await expect(apiClient.get('/api/test')).rejects.toThrow('Network Error');
    });

    test('HTTP error responses maintain structure', async () => {
      const httpError = {
        response: {
          status: 400,
          data: { error: 'Bad Request' }
        }
      };

      mockAxiosInstance.post.mockRejectedValueOnce(httpError);

      await expect(apiClient.post('/api/test', {})).rejects.toMatchObject(httpError);
    });
  });

  describe('Token Refresh Internal Logic', () => {
    test('refreshToken method updates access token correctly', async () => {
      localStorage.setItem('refresh_token', 'valid-refresh');
      
      const mockResponse = {
        data: { access: 'refreshed-access-token' }
      };
      
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await apiClient.refreshToken();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/refresh/', {
        refresh: 'valid-refresh'
      });
      expect((apiClient as any).accessToken).toBe('refreshed-access-token');
    });

    test('refreshToken method throws when no refresh token available', async () => {
      localStorage.removeItem('refresh_token');

      await expect(apiClient.refreshToken()).rejects.toThrow('No refresh token available');
    });
  });
});