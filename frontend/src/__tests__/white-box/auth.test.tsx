/**
 * WHITE BOX TESTS - Authentication Hook
 * Tests internal logic, state management, and implementation details
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuth, AuthProvider } from '../../hooks/useAuth';
import { apiClient } from '../../services/api';

// Mock the API client
jest.mock('../../services/api');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('WHITE BOX: useAuth Hook Internal Logic', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  describe('Internal State Management', () => {
    test('should initialize with default state values', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    test('should handle localStorage token on initialization', async () => {
      localStorage.setItem('access_token', 'mock-token');
      mockedApiClient.getCurrentProfile.mockResolvedValueOnce({
        id: 1,
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          is_active: true,
          date_joined: '2024-01-01T00:00:00Z',
        },
        role: 'admin',
        tokens: 1000,
        mail_tokens: 50,
        company_name: 'Test Company',
        stripe_customer_id: 'cus_test123',
        stripe_subscription_id: 'sub_test123',
        subscription_plan: 'premium',
        monthly_subscription_active: true,
        subscription_start_date: '2024-01-01',
        beta_months_remaining: 0,
        onboarding_completed: true,
        last_activity: '2024-01-01T00:00:00Z',
        voice_commands_enabled: true,
        voice_wake_term: 'DroneStrike',
        preferences: {},
        monthly_rate: 99.99,
        is_premium_user: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        color_scheme: 'dark',
        logo_url: '',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.username).toBe('testuser');
    });
  });

  describe('Login Function Internal Logic', () => {
    test('should update internal state correctly during login process', async () => {
      const mockLoginResponse = {
        access: 'new-access-token',
        refresh: 'new-refresh-token',
      };

      const mockProfile = {
        id: 1,
        user: {
          id: 1,
          username: 'newuser',
          email: 'new@example.com',
          first_name: 'New',
          last_name: 'User',
          is_active: true,
          date_joined: '2024-01-01T00:00:00Z',
        },
        role: 'user' as const,
        tokens: 500,
        mail_tokens: 25,
        company_name: 'New Company',
        stripe_customer_id: 'cus_new123',
        stripe_subscription_id: 'sub_new123',
        subscription_plan: 'basic',
        monthly_subscription_active: true,
        subscription_start_date: '2024-01-01',
        beta_months_remaining: 0,
        onboarding_completed: true,
        last_activity: '2024-01-01T00:00:00Z',
        voice_commands_enabled: false,
        voice_wake_term: 'DroneStrike',
        preferences: {},
        monthly_rate: 49.99,
        is_premium_user: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        color_scheme: 'dark',
        logo_url: '',
      };

      mockedApiClient.login.mockResolvedValueOnce(mockLoginResponse);
      mockedApiClient.getCurrentProfile.mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          username: 'newuser',
          password: 'password123',
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.username).toBe('newuser');
      expect(result.current.profile?.tokens).toBe(500);
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'new-access-token');
    });

    test('should handle login errors and maintain state integrity', async () => {
      mockedApiClient.login.mockRejectedValueOnce(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login({
            username: 'baduser',
            password: 'badpass',
          });
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
    });
  });

  describe('Logout Function Internal Logic', () => {
    test('should clear all internal state and localStorage', async () => {
      // Setup authenticated state
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('refresh_token', 'test-refresh');

      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
    });
  });

  describe('Profile Refresh Internal Logic', () => {
    test('should update profile state without affecting authentication', async () => {
      const updatedProfile = {
        id: 1,
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          is_active: true,
          date_joined: '2024-01-01T00:00:00Z',
        },
        role: 'admin' as const,
        tokens: 2000, // Updated tokens
        mail_tokens: 100, // Updated mail tokens
        company_name: 'Test Company',
        stripe_customer_id: 'cus_test123',
        stripe_subscription_id: 'sub_test123',
        subscription_plan: 'premium',
        monthly_subscription_active: true,
        subscription_start_date: '2024-01-01',
        beta_months_remaining: 0,
        onboarding_completed: true,
        last_activity: '2024-01-01T00:00:00Z',
        voice_commands_enabled: true,
        voice_wake_term: 'DroneStrike',
        preferences: {},
        monthly_rate: 99.99,
        is_premium_user: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        color_scheme: 'dark',
        logo_url: '',
      };

      mockedApiClient.getCurrentProfile.mockResolvedValueOnce(updatedProfile);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshProfile();
      });

      expect(result.current.profile?.tokens).toBe(2000);
      expect(result.current.profile?.mail_tokens).toBe(100);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Error Handling Internal Logic', () => {
    test('should handle network errors gracefully', async () => {
      mockedApiClient.getCurrentProfile.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    test('should handle malformed API responses', async () => {
      mockedApiClient.getCurrentProfile.mockResolvedValueOnce(null as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});