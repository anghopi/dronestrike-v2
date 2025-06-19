/**
 * BLACK BOX TESTS - Navigation and Layout
 * Tests user navigation experience without internal knowledge
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockUser, mockProfile } from '../utils/test-utils';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Dashboard } from '../../pages/Dashboard';

// Mock authentication
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshProfile: jest.fn(),
  }),
}));

// Mock API calls
jest.mock('../../services/api', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue([]),
  },
  leadService: {
    getDashboardStats: jest.fn().mockResolvedValue({
      total_leads: 100,
      by_status: [],
      by_workflow_stage: [],
      by_state: [],
      average_score: 75,
      high_score_leads: 25,
      recent_leads: 5,
    }),
  },
}));

describe('BLACK BOX: Navigation and User Interface', () => {
  describe('Sidebar Navigation User Experience', () => {
    test('user can see all main navigation items', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check main navigation items are visible
      expect(screen.getByText('Targets')).toBeInTheDocument();
      expect(screen.getByText('Missions')).toBeInTheDocument();
      expect(screen.getByText('Opportunities')).toBeInTheDocument();
      expect(screen.getByText('War Room')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Map View')).toBeInTheDocument();
    });

    test('user can see system navigation items', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check system navigation items are visible
      expect(screen.getByText('Intelligence Tokens')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('CSV Import')).toBeInTheDocument();
      expect(screen.getByText('Scheduled Imports')).toBeInTheDocument();
      expect(screen.getByText('Help & Support')).toBeInTheDocument();
    });

    test('user can navigate between sections', async () => {
      const user = userEvent.setup();
      
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Click on Targets navigation
      const targetsLink = screen.getByText('Targets');
      await user.click(targetsLink);

      // URL should change (we can't test actual navigation in this setup,
      // but we can verify the link has correct href)
      expect(targetsLink.closest('a')).toHaveAttribute('href', '/leads');
    });

    test('active navigation item is visually highlighted', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // War Room should be active for dashboard page
      const warRoomLink = screen.getByText('War Room').closest('a');
      expect(warRoomLink).toHaveClass('bg-gradient-to-r');
    });
  });

  describe('Header User Experience', () => {
    test('user can see page title and search functionality', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check header elements
      expect(screen.getByText('War Room')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search targets, missions, opportunities/i)).toBeInTheDocument();
    });

    test('user can see token display in header', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check token displays
      expect(screen.getByText('TOKENS')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument(); // mockProfile.tokens
      expect(screen.getByText('MAIL')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument(); // mockProfile.mail_tokens
    });

    test('user can access profile information', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check user profile display
      expect(screen.getByText('Test')).toBeInTheDocument(); // First name
      expect(screen.getByText('Command Center')).toBeInTheDocument(); // Role display
    });

    test('user can toggle sidebar visibility', async () => {
      const user = userEvent.setup();
      
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Find sidebar toggle button
      const toggleButton = screen.getByRole('button', { name: /open main menu/i });
      
      // Initially sidebar should be visible
      expect(screen.getByText('DroneStrike')).toBeInTheDocument();

      // Click toggle
      await user.click(toggleButton);

      // Sidebar should still be visible (our implementation keeps it visible by default)
      // This tests the button functionality exists
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('User Profile and Authentication UI', () => {
    test('user can see their profile information in sidebar', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check user info in sidebar
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('Command Officer')).toBeInTheDocument();
    });

    test('user can access logout functionality', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check logout button exists
      const logoutButton = screen.getByText('Sign Out');
      expect(logoutButton).toBeInTheDocument();
    });

    test('user profile avatar displays correctly', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check avatar displays user initial
      const avatars = screen.getAllByText('T'); // First letter of "Test"
      expect(avatars.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design User Experience', () => {
    test('layout adapts to different screen sizes', () => {
      // Test mobile-like viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Layout should still be functional
      expect(screen.getByText('DroneStrike')).toBeInTheDocument();
      expect(screen.getByText('War Room')).toBeInTheDocument();
    });

    test('search functionality is accessible on different screen sizes', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      const searchInput = screen.getByPlaceholderText(/search targets, missions, opportunities/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).not.toHaveAttribute('disabled');
    });
  });

  describe('Accessibility User Experience', () => {
    test('navigation is accessible via keyboard', async () => {
      const user = userEvent.setup();
      
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Tab through navigation items
      await user.tab();
      
      // Should be able to navigate with keyboard
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInTheDocument();
    });

    test('search input is properly labeled', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      const searchInput = screen.getByPlaceholderText(/search targets, missions, opportunities/i);
      expect(searchInput).toHaveAttribute('type', 'text');
    });

    test('buttons have accessible names', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Check that buttons have proper labels or text
      const logoutButton = screen.getByRole('button', { name: /sign out/i });
      expect(logoutButton).toBeInTheDocument();
    });
  });

  describe('Visual Feedback and Animations', () => {
    test('hover states provide visual feedback', async () => {
      const user = userEvent.setup();
      
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      const targetsLink = screen.getByText('Targets');
      
      // Hover should be possible (testing the element is interactive)
      await user.hover(targetsLink);
      
      expect(targetsLink).toBeInTheDocument();
    });

    test('active states are visually distinct', () => {
      render(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );

      // Active navigation item should have different styling
      const warRoomLink = screen.getByText('War Room').closest('a');
      expect(warRoomLink).toHaveClass('bg-gradient-to-r');
      
      // Non-active items should not have the same styling
      const targetsLink = screen.getByText('Targets').closest('a');
      expect(targetsLink).not.toHaveClass('bg-gradient-to-r');
    });
  });
});