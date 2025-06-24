import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { 
  CreditCardIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import PaymentMethodCard from './PaymentMethodCard';
import TokenPurchaseModal from './TokenPurchaseModal';
import SubscriptionModal from './SubscriptionModal';
import PaymentScheduleModal from './PaymentScheduleModal';
import PaymentAnalytics from './PaymentAnalytics';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  us_bank_account?: {
    bank_name: string;
    last4: string;
    account_type: string;
  };
  created: number;
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  trial_end?: number;
  cancel_at_period_end: boolean;
  canceled_at?: number;
  items: Array<{
    price_id: string;
    product_name: string;
    amount: number;
    currency: string;
    interval: string;
  }>;
}

interface PaymentAnalyticsData {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_amount: number;
    total_transactions: number;
    failed_transactions: number;
    success_rate: number;
    average_transaction: number;
  };
  subscriptions: {
    active_count: number;
    total_count: number;
  };
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    created: number;
  }>;
}

const PaymentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'methods' | 'subscriptions' | 'analytics'>('overview');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const queryClient = useQueryClient();

  // Fetch payment methods
  const { data: paymentMethods = [], isLoading: methodsLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const response = await fetch('/api/payments/payment-methods', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const data = await response.json();
      return data.payment_methods;
    }
  });

  // Fetch subscriptions
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/payments/subscriptions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      return response.json();
    }
  });

  // Fetch payment analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['payment-analytics', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      
      const response = await fetch(`/api/payments/analytics?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
  });

  // Delete payment method mutation
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch(`/api/payments/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to delete payment method');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    }
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, immediately }: { subscriptionId: string; immediately: boolean }) => {
      const response = await fetch(`/api/payments/subscriptions/${subscriptionId}?at_period_end=${!immediately}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to cancel subscription');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    }
  });

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trialing': return 'bg-blue-100 text-blue-800';
      case 'past_due': return 'bg-yellow-100 text-yellow-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'succeeded': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
          <p className="text-gray-600">Manage your payments, subscriptions, and billing information</p>
        </div>

        {/* Quick Stats */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(analytics.summary.total_amount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.total_transactions}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.success_rate.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <CreditCardIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.subscriptions.active_count}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: ChartBarIcon },
              { id: 'methods', name: 'Payment Methods', icon: CreditCardIcon },
              { id: 'subscriptions', name: 'Subscriptions', icon: CalendarIcon },
              { id: 'analytics', name: 'Analytics', icon: DocumentTextIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Payment Overview</h2>
                <div className="flex space-x-3">
                  <Button onClick={() => setShowTokenModal(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Buy Tokens
                  </Button>
                  <Button variant="outline" onClick={() => setShowSubscriptionModal(true)}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Subscribe
                  </Button>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analytics?.transactions.slice(0, 5).map((transaction: any) => (
                        <tr key={transaction.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.description || 'Payment'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={getStatusColor(transaction.status)}>
                              {transaction.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(transaction.created)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Subscriptions */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Active Subscriptions</h3>
                <div className="space-y-4">
                  {subscriptions.filter((sub: Subscription) => sub.status === 'active').map((subscription: Subscription) => (
                    <div key={subscription.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {subscription.items[0]?.product_name || 'Subscription'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(subscription.items[0]?.amount / 100)} / {subscription.items[0]?.interval}
                          </p>
                          <p className="text-sm text-gray-500">
                            Next billing: {formatDate(subscription.current_period_end)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(subscription.status)}>
                            {subscription.status}
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => cancelSubscriptionMutation.mutate({ subscriptionId: subscription.id, immediately: false })}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'methods' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
                <Button onClick={() => setShowTokenModal(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>

              <div className="grid gap-4">
                {methodsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading payment methods...</p>
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCardIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No payment methods added yet</p>
                    <Button className="mt-4" onClick={() => setShowTokenModal(true)}>
                      Add Payment Method
                    </Button>
                  </div>
                ) : (
                  paymentMethods.map((method: PaymentMethod) => (
                    <PaymentMethodCard
                      key={method.id}
                      method={method}
                      onDelete={() => deletePaymentMethodMutation.mutate(method.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Subscriptions</h2>
                <Button onClick={() => setShowSubscriptionModal(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Subscription
                </Button>
              </div>

              <div className="space-y-6">
                {subscriptionsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading subscriptions...</p>
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No subscriptions found</p>
                    <Button className="mt-4" onClick={() => setShowSubscriptionModal(true)}>
                      Create Subscription
                    </Button>
                  </div>
                ) : (
                  subscriptions.map((subscription: Subscription) => (
                    <div key={subscription.id} className="border rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {subscription.items[0]?.product_name || 'Subscription'}
                            </h3>
                            <Badge className={getStatusColor(subscription.status)}>
                              {subscription.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div>
                              <p className="text-sm font-medium text-gray-500">Amount</p>
                              <p className="text-lg text-gray-900">
                                {formatCurrency(subscription.items[0]?.amount / 100)} / {subscription.items[0]?.interval}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500">Current Period</p>
                              <p className="text-sm text-gray-900">
                                {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500">Status</p>
                              <p className="text-sm text-gray-900">
                                {subscription.cancel_at_period_end ? 'Canceling at period end' : 'Active'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => cancelSubscriptionMutation.mutate({ subscriptionId: subscription.id, immediately: false })}
                            >
                              Cancel
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Cog6ToothIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              <PaymentAnalytics data={analytics} loading={analyticsLoading} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Elements stripe={stripePromise}>
        <TokenPurchaseModal
          isOpen={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          onSuccess={() => {
            setShowTokenModal(false);
            queryClient.invalidateQueries({ queryKey: ['payment-analytics'] });
          }}
        />
      </Elements>

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={() => {
          setShowSubscriptionModal(false);
          queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        }}
      />

      <PaymentScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={() => {
          setShowScheduleModal(false);
          queryClient.invalidateQueries({ queryKey: ['payment-analytics'] });
        }}
      />
    </div>
  );
};

export default PaymentDashboard;