/**
 * BLACK BOX TESTS - Login Page
 * Tests functionality from user perspective without internal knowledge
 */

import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../utils/test-utils';
import { Login } from '../../pages/Login';
import { apiClient } from '../../services/api';

// Mock the API client
jest.mock('../../services/api');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock react-router-dom navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('BLACK BOX: Login Page User Experience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Login Form Behavior', () => {
    test('user can see all required form elements', () => {
      render(<Login />);

      expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText(/dronestrike/i)).toBeInTheDocument();
    });

    test('user can enter credentials and submit form', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.login.mockResolvedValueOnce({
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
      });

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

      render(<Login />);

      const usernameInput = screen.getByRole('textbox', { name: /username/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedApiClient.login).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123',
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    test('user sees error message when login fails', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.login.mockRejectedValueOnce({
        response: {
          data: { detail: 'Invalid credentials' },
          status: 401,
        },
      });

      render(<Login />);

      const usernameInput = screen.getByRole('textbox', { name: /username/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'baduser');
      await user.type(passwordInput, 'badpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    test('user can toggle password visibility', async () => {
      const user = userEvent.setup();
      render(<Login />);

      const passwordInput = screen.getByLabelText(/password/i);
      const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('user can use demo credentials', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.login.mockResolvedValueOnce({
        access: 'demo-access-token',
        refresh: 'demo-refresh-token',
      });

      mockedApiClient.getCurrentProfile.mockResolvedValueOnce({
        id: 1,
        user: {
          id: 1,
          username: 'demo',
          email: 'demo@example.com',
          first_name: 'Demo',
          last_name: 'User',
          is_active: true,
          date_joined: '2024-01-01T00:00:00Z',
        },
        role: 'user',
        tokens: 100,
        mail_tokens: 10,
        company_name: 'Demo Company',
        stripe_customer_id: '',
        stripe_subscription_id: '',
        subscription_plan: 'demo',
        monthly_subscription_active: false,
        subscription_start_date: '',
        beta_months_remaining: 1,
        onboarding_completed: false,
        last_activity: '2024-01-01T00:00:00Z',
        voice_commands_enabled: false,
        voice_wake_term: 'DroneStrike',
        preferences: {},
        monthly_rate: 0,
        is_premium_user: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        color_scheme: 'dark',
        logo_url: '',
      });

      render(<Login />);

      const demoButton = screen.getByText(/try demo/i);
      await user.click(demoButton);

      await waitFor(() => {
        expect(mockedApiClient.login).toHaveBeenCalledWith({
          username: 'demo',
          password: 'demo123',
        });
      });
    });
  });

  describe('Form Validation from User Perspective', () => {
    test('user cannot submit empty form', async () => {
      const user = userEvent.setup();
      render(<Login />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Form should not submit with empty fields
      expect(mockedApiClient.login).not.toHaveBeenCalled();
    });

    test('user sees loading state during login', async () => {
      const user = userEvent.setup();
      
      // Mock a delayed response
      mockedApiClient.login.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          access: 'token',
          refresh: 'refresh'
        }), 100))
      );

      render(<Login />);

      const usernameInput = screen.getByRole('textbox', { name: /username/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Accessibility and User Experience', () => {
    test('form is accessible via keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Login />);

      const usernameInput = screen.getByRole('textbox', { name: /username/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Tab through form elements
      await user.tab();
      expect(usernameInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    test('user can submit form with Enter key', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.login.mockResolvedValueOnce({
        access: 'mock-token',
        refresh: 'mock-refresh',
      });

      render(<Login />);

      const usernameInput = screen.getByRole('textbox', { name: /username/i });
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockedApiClient.login).toHaveBeenCalled();
      });
    });

    test('error messages are announced to screen readers', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.login.mockRejectedValueOnce({
        response: {
          data: { detail: 'Account locked' },
          status: 423,
        },
      });

      render(<Login />);

      const usernameInput = screen.getByRole('textbox', { name: /username/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'lockeduser');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent(/account locked/i);
      });
    });
  });
});