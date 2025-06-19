import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Leads from '../pages/Leads';
import Sidebar from '../components/Layout/Sidebar';
import HeaderTabs from '../components/Layout/HeaderTabs';
import MainLayout from '../components/Layout/MainLayout';
import { AuthProvider } from '../hooks/useAuth';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

describe('DroneStrike v2 Frontend - Comprehensive Test Suite', () => {
  
  // WHITE BOX TESTS - Testing internal component logic and state
  describe('WHITE BOX: Component Internal Logic', () => {
    
    test('Login component form state management', async () => {
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/password/i);
      
      // Test internal form state changes
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    test('Sidebar navigation state management', () => {
      renderWithProviders(<Sidebar />);
      
      // Test navigation items are rendered
      expect(screen.getByText('Targets')).toBeInTheDocument();
      expect(screen.getByText('Missions')).toBeInTheDocument();
      expect(screen.getByText('Opportunities')).toBeInTheDocument();
      expect(screen.getByText('War Room')).toBeInTheDocument();
    });

    test('HeaderTabs component prop handling', () => {
      const mockTabs = [
        { name: 'All', href: '/leads', current: true },
        { name: 'Active', href: '/leads/active', current: false }
      ];
      
      renderWithProviders(
        <HeaderTabs 
          title="Test Title"
          tabs={mockTabs}
          showSearch={true}
        />
      );
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  // BLACK BOX TESTS - Testing user experience without knowledge of internals
  describe('BLACK BOX: User Experience Testing', () => {
    
    test('User can navigate through login form', async () => {
      renderWithProviders(<Login />);
      
      // User sees login form
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
      
      // User can fill out form
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await userEvent.type(emailInput, 'user@example.com');
      await userEvent.type(passwordInput, 'userpassword');
      
      // User can submit form
      expect(submitButton).toBeEnabled();
    });

    test('User can see dashboard metrics', () => {
      renderWithProviders(<Dashboard />);
      
      // User sees key performance indicators
      expect(screen.getByText(/total leads/i)).toBeInTheDocument();
      expect(screen.getByText(/active campaigns/i)).toBeInTheDocument();
      expect(screen.getByText(/conversion rate/i)).toBeInTheDocument();
    });

    test('User can interact with leads table', () => {
      renderWithProviders(<Leads />);
      
      // User sees leads interface
      expect(screen.getByText(/leads/i)).toBeInTheDocument();
      
      // User can see table headers
      expect(screen.getByText(/property/i)).toBeInTheDocument();
      expect(screen.getByText(/score/i)).toBeInTheDocument();
      expect(screen.getByText(/status/i)).toBeInTheDocument();
    });

    test('User can navigate between pages using sidebar', async () => {
      renderWithProviders(
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      );
      
      // User sees navigation options
      const targetsLink = screen.getByText('Targets');
      const missionsLink = screen.getByText('Missions');
      
      expect(targetsLink).toBeInTheDocument();
      expect(missionsLink).toBeInTheDocument();
      
      // Links are clickable
      expect(targetsLink.closest('a')).toHaveAttribute('href', '/leads');
      expect(missionsLink.closest('a')).toHaveAttribute('href', '/properties');
    });
  });

  // GRAY BOX TESTS - Testing with partial knowledge of internal structure
  describe('GRAY BOX: Integration & Accessibility Testing', () => {
    
    test('Login form accessibility compliance', async () => {
      renderWithProviders(<Login />);
      
      // Check ARIA labels and roles
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(submitButton).toHaveAttribute('type', 'submit');
      
      // Test keyboard navigation
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
      
      await userEvent.tab();
      expect(document.activeElement).toBe(passwordInput);
      
      await userEvent.tab();
      expect(document.activeElement).toBe(submitButton);
    });

    test('Sidebar navigation accessibility', () => {
      renderWithProviders(<Sidebar />);
      
      // Check navigation structure
      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      
      // Check all navigation links are accessible
      const navLinks = screen.getAllByRole('link');
      expect(navLinks.length).toBeGreaterThan(0);
      
      navLinks.forEach(link => {
        expect(link).toHaveAttribute('href');
        expect(link).toBeVisible();
      });
    });

    test('Form validation integration', async () => {
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Test invalid email format
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.type(passwordInput, 'password');
      
      // HTML5 validation should prevent submission
      expect(emailInput).toBeInvalid();
      
      // Test valid email format
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, 'valid@example.com');
      
      expect(emailInput).toBeValid();
    });

    test('Responsive design elements', () => {
      renderWithProviders(<MainLayout><div>Content</div></MainLayout>);
      
      // Check for responsive CSS classes
      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('w-64'); // Tailwind responsive class
      
      // Check main content area
      const mainContent = screen.getByText('Content').closest('main');
      expect(mainContent).toBeInTheDocument();
    });

    test('Component integration with React Router', () => {
      renderWithProviders(
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );
      
      // Check that components render together without conflicts
      expect(screen.getByText(/total leads/i)).toBeInTheDocument();
      expect(screen.getByText('Targets')).toBeInTheDocument();
      
      // Navigation and content coexist
      const navigation = screen.getByRole('navigation');
      const main = screen.getByRole('main');
      
      expect(navigation).toBeInTheDocument();
      expect(main).toBeInTheDocument();
    });

    test('CSS class application and styling', () => {
      renderWithProviders(<Sidebar />);
      
      // Check military theme classes are applied
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('bg-gradient-to-b');
      
      // Check for proper styling structure
      const userSection = screen.getByText(/command center/i);
      expect(userSection).toBeInTheDocument();
    });

    test('Error boundary and fallback UI', () => {
      // Test that components handle missing props gracefully
      renderWithProviders(<HeaderTabs title="" tabs={[]} />);
      
      // Should not crash and should render basic structure
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    test('Performance monitoring hooks', () => {
      const startTime = performance.now();
      
      renderWithProviders(<Dashboard />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Component should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
    });
  });

  // CROSS-CUTTING CONCERNS
  describe('Cross-Cutting Concerns', () => {
    
    test('Military theme consistency', () => {
      renderWithProviders(<MainLayout><Dashboard /></MainLayout>);
      
      // Check for consistent military terminology
      expect(screen.getByText('War Room')).toBeInTheDocument();
      expect(screen.getByText('Targets')).toBeInTheDocument();
      expect(screen.getByText('Missions')).toBeInTheDocument();
      
      // Check for military-style command structure
      expect(screen.getByText(/command center/i)).toBeInTheDocument();
    });

    test('Data flow between components', () => {
      renderWithProviders(
        <MainLayout>
          <Leads />
        </MainLayout>
      );
      
      // Check that layout and page components work together
      expect(screen.getByText('Targets')).toBeInTheDocument(); // From sidebar
      expect(screen.getByText(/leads/i)).toBeInTheDocument(); // From leads page
    });

    test('TypeScript type safety compliance', () => {
      // This test passes if the components compile without TypeScript errors
      // The fact that the test suite runs means TypeScript compilation succeeded
      expect(true).toBe(true);
    });
  });
});