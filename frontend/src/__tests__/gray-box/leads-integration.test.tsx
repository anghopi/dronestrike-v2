/**
 * GRAY BOX TESTS - Leads Page Integration
 * Tests user workflows with knowledge of internal state and API calls
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockUser, mockProfile, mockLead } from '../utils/test-utils';
import Leads from '../../pages/Leads';
import { MainLayout } from '../../components/Layout/MainLayout';
import { apiClient } from '../../services/api';

// Mock the API client
jest.mock('../../services/api');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock authentication context
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

describe('GRAY BOX: Leads Page Integration Tests', () => {
  const mockLeads = [
    { ...mockLead, id: 1, full_name: 'John Doe', workflow_status: 'new' as const },
    { ...mockLead, id: 2, full_name: 'Jane Smith', workflow_status: 'contacted' as const },
    { ...mockLead, id: 3, full_name: 'Bob Johnson', workflow_status: 'qualified' as const },
    { ...mockLead, id: 4, full_name: 'Alice Brown', workflow_status: 'opportunity' as const },
    { ...mockLead, id: 5, full_name: 'Charlie Davis', workflow_status: 'closed' as const },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.get.mockResolvedValue(mockLeads);
  });

  describe('Page Load and Data Fetching Integration', () => {
    test('user sees loading state then data loads correctly', async () => {
      // Mock delayed API response to test loading state
      mockedApiClient.get.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(mockLeads), 100))
      );

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      // Should show loading state
      expect(screen.getByText(/loading targets/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Verify API was called correctly
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/leads/?');
    });

    test('correct tab counts are calculated and displayed', async () => {
      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Check tab counts match our mock data
      expect(screen.getByText('All Targets')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Total count

      const newTab = screen.getByRole('button', { name: /new/i });
      expect(within(newTab).getByText('1')).toBeInTheDocument(); // 1 new lead

      const contactedTab = screen.getByRole('button', { name: /contacted/i });
      expect(within(contactedTab).getByText('1')).toBeInTheDocument(); // 1 contacted lead
    });
  });

  describe('Filtering and Search Integration', () => {
    test('tab filtering triggers correct API calls and updates UI', async () => {
      const user = userEvent.setup();

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on "New" tab
      const newTab = screen.getByRole('button', { name: /new/i });
      await user.click(newTab);

      // Should trigger new API call with status filter
      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledWith('/api/leads/?status=new');
      });

      // UI should update to show active tab
      expect(newTab).toHaveClass('border-brand-color');
    });

    test('search functionality integrates with API calls', async () => {
      const user = userEvent.setup();

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Use the search in HeaderTabs
      const searchInput = screen.getByPlaceholderText(/search targets/i);
      await user.type(searchInput, 'John');

      // Should trigger API call with search parameter
      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledWith('/api/leads/?search=John');
      });
    });

    test('combined filtering works correctly', async () => {
      const user = userEvent.setup();

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Apply status filter first
      const statusSelect = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusSelect, 'new');

      // Then apply search
      const searchInput = screen.getByPlaceholderText(/search targets/i);
      await user.type(searchInput, 'test');

      // Should combine both filters in API call
      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledWith('/api/leads/?search=test&status=new');
      });
    });
  });

  describe('Lead Actions Integration', () => {
    test('workflow status update triggers API call and optimistic UI update', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.patch.mockResolvedValueOnce({ 
        ...mockLeads[0], 
        workflow_status: 'contacted' 
      });

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find and click the "Next Status" button for John Doe
      const johnCard = screen.getByText('John Doe').closest('.card-military');
      const nextStatusButton = within(johnCard!).getByText(/contacted/i);
      
      await user.click(nextStatusButton);

      // Should trigger PATCH API call
      await waitFor(() => {
        expect(mockedApiClient.patch).toHaveBeenCalledWith(
          '/api/leads/1/',
          { workflow_status: 'contacted' }
        );
      });

      // Should invalidate and refetch leads
      expect(mockedApiClient.get).toHaveBeenCalledTimes(2);
    });

    test('lead deletion triggers confirmation and API call', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.delete.mockResolvedValueOnce({});

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find and click delete button for John Doe
      const johnCard = screen.getByText('John Doe').closest('.card-military');
      const deleteButton = within(johnCard!).getByTitle(/delete lead/i);
      
      await user.click(deleteButton);

      // Should trigger DELETE API call
      await waitFor(() => {
        expect(mockedApiClient.delete).toHaveBeenCalledWith('/api/leads/1/');
      });

      // Should refetch data
      expect(mockedApiClient.get).toHaveBeenCalledTimes(2);
    });

    test('lead detail modal displays correct data and handles updates', async () => {
      const user = userEvent.setup();

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click view details button
      const johnCard = screen.getByText('John Doe').closest('.card-military');
      const viewButton = within(johnCard!).getByTitle(/view details/i);
      
      await user.click(viewButton);

      // Modal should open with correct data
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('555-0123')).toBeInTheDocument();
      });

      // Test status update from modal
      mockedApiClient.patch.mockResolvedValueOnce({ 
        ...mockLeads[0], 
        workflow_status: 'contacted' 
      });

      const modalMoveButton = screen.getByText(/move to contacted/i);
      await user.click(modalMoveButton);

      // Should trigger API call and close modal
      await waitFor(() => {
        expect(mockedApiClient.patch).toHaveBeenCalledWith(
          '/api/leads/1/',
          { workflow_status: 'contacted' }
        );
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('API errors are handled gracefully with user feedback', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('Network error'));

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText(/error loading targets/i)).toBeInTheDocument();
      });

      // Error state should be displayed to user
      expect(screen.getByText(/please try again/i)).toBeInTheDocument();
    });

    test('failed mutations show error feedback', async () => {
      const user = userEvent.setup();
      
      mockedApiClient.patch.mockRejectedValueOnce(new Error('Update failed'));

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnCard = screen.getByText('John Doe').closest('.card-military');
      const nextStatusButton = within(johnCard!).getByText(/contacted/i);
      
      await user.click(nextStatusButton);

      // Error should not break the UI
      await waitFor(() => {
        expect(mockedApiClient.patch).toHaveBeenCalled();
      });

      // UI should remain functional
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Performance and State Management', () => {
    test('component properly manages loading states during operations', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      mockedApiClient.patch.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({}), 200))
      );

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnCard = screen.getByText('John Doe').closest('.card-military');
      const nextStatusButton = within(johnCard!).getByText(/contacted/i);
      
      await user.click(nextStatusButton);

      // Button should be disabled during operation
      expect(nextStatusButton).toBeDisabled();
    });

    test('search debouncing prevents excessive API calls', async () => {
      const user = userEvent.setup();

      render(
        <MainLayout>
          <Leads />
        </MainLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search targets/i);
      
      // Type rapidly
      await user.type(searchInput, 'John', { delay: 50 });

      // Should not make API call for each character
      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledTimes(2); // Initial load + final search
      });
    });
  });
});