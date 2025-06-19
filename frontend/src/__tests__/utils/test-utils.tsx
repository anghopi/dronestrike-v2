import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../hooks/useAuth';

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock data generators
export const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_active: true,
  date_joined: '2024-01-01T00:00:00Z',
};

export const mockProfile = {
  id: 1,
  user: mockUser,
  role: 'admin' as const,
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
};

export const mockLead = {
  id: 1,
  owner: mockUser,
  first_name: 'John',
  last_name: 'Doe',
  owner_type: 'individual' as const,
  email: 'john@example.com',
  phone_cell: '555-0123',
  phone_other: '',
  birth_date: '1990-01-01',
  mailing_address_1: '123 Main St',
  mailing_address_2: '',
  mailing_street: 'Main St',
  mailing_city: 'Anytown',
  mailing_state: 'TX',
  mailing_zip5: '12345',
  mailing_zip4: '6789',
  mailing_place_id: 'place123',
  mailing_address_1_corrected: false,
  is_bad_address: false,
  geocoding: {},
  do_not_email: false,
  do_not_email_added: false,
  do_not_mail: false,
  email_added: '',
  email_added_date: '',
  returned_postcard: false,
  returned_postcard_date: '',
  returned_postcard_reason: '',
  is_business: false,
  is_dangerous: false,
  safety_concerns_notes: '',
  safety_concern_types: [],
  en: true,
  es: false,
  has_mortgage: false,
  monthly_income: '',
  lead_status: 'target_acquired' as const,
  last_contact: '',
  notes: 'Test notes',
  latitude: '32.7767',
  longitude: '-96.7970',
  score_value: 85,
  scored_at: '2024-01-01T00:00:00Z',
  workflow_stage: 'lead_identified' as const,
  botg_mission_id: '',
  tlc_loan_id: '',
  tlc_borrower_id: '',
  sent_to_botg: false,
  botg_response_received: false,
  sent_to_tlc: false,
  tlc_loan_created: false,
  source_batch: 'test_batch',
  imported_from: 'manual',
  full_name: 'John Doe',
  formatted_zip: '12345-6789',
  full_mailing_address: '123 Main St, Anytown, TX 12345',
  workflow_status: 'new' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  botg_assigned_at: '',
  botg_completed_at: '',
  tlc_sent_at: '',
};

export const mockDashboardStats = {
  total_leads: 150,
  by_status: [
    { lead_status: 'target_acquired', count: 50 },
    { lead_status: 'initial_contact', count: 30 },
    { lead_status: 'qualified', count: 25 },
    { lead_status: 'negotiation', count: 20 },
    { lead_status: 'closed_won', count: 15 },
    { lead_status: 'closed_lost', count: 10 },
  ],
  by_workflow_stage: [
    { workflow_stage: 'lead_identified', count: 40 },
    { workflow_stage: 'botg_assigned', count: 30 },
    { workflow_stage: 'botg_in_progress', count: 25 },
    { workflow_stage: 'botg_completed', count: 20 },
    { workflow_stage: 'opportunity_created', count: 15 },
    { workflow_stage: 'tlc_loan_originated', count: 10 },
    { workflow_stage: 'tlc_client_onboarded', count: 8 },
    { workflow_stage: 'loan_servicing', count: 2 },
  ],
  by_state: [
    { mailing_state: 'TX', count: 75 },
    { mailing_state: 'CA', count: 35 },
    { mailing_state: 'FL', count: 25 },
    { mailing_state: 'NY', count: 15 },
  ],
  average_score: 78.5,
  high_score_leads: 45,
  recent_leads: 12,
};