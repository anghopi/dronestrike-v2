import React, { useState } from 'react';
import { 
  BanknotesIcon, 
  CreditCardIcon, 
  ChartBarIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface TokenTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  savings: number;
  popular: boolean;
  description: string;
}

const Token: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'purchase' | 'history'>('overview');
  const [currentBalance] = useState(2500);
  const [monthlyUsage] = useState(450);
  const [loading, setLoading] = useState(false);

  // Mock data - replace with actual API calls
  const [transactions] = useState<TokenTransaction[]>([
    {
      id: '1',
      type: 'purchase',
      amount: 1000,
      description: 'Standard Package Purchase',
      date: '2024-01-15T10:30:00Z',
      status: 'completed'
    },
    {
      id: '2',
      type: 'usage',
      amount: -25,
      description: 'Target Intelligence Query - Property Search',
      date: '2024-01-15T09:15:00Z',
      status: 'completed'
    },
    {
      id: '3',
      type: 'usage',
      amount: -50,
      description: 'Advanced Lead Analysis - Financial Profile',
      date: '2024-01-14T16:45:00Z',
      status: 'completed'
    },
    {
      id: '4',
      type: 'bonus',
      amount: 100,
      description: 'Monthly Loyalty Bonus',
      date: '2024-01-01T00:00:00Z',
      status: 'completed'
    }
  ]);

  const [tokenPackages] = useState<TokenPackage[]>([
    {
      id: 'starter',
      name: 'Starter Pack',
      tokens: 500,
      price: 49.99,
      savings: 0,
      popular: false,
      description: 'Perfect for small operations'
    },
    {
      id: 'professional',
      name: 'Professional Pack',
      tokens: 1500,
      price: 129.99,
      savings: 20,
      popular: true,
      description: 'Most popular for growing teams'
    },
    {
      id: 'enterprise',
      name: 'Enterprise Pack',
      tokens: 5000,
      price: 399.99,
      savings: 35,
      popular: false,
      description: 'Maximum value for large operations'
    },
    {
      id: 'unlimited',
      name: 'Unlimited Monthly',
      tokens: -1, // -1 represents unlimited
      price: 599.99,
      savings: 50,
      popular: false,
      description: 'Unlimited usage for 30 days'
    }
  ]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <PlusIcon className="w-5 h-5 text-success-green" />;
      case 'usage':
        return <MinusIcon className="w-5 h-5 text-brand-color" />;
      case 'refund':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500" />;
      case 'bonus':
        return <CheckCircleIcon className="w-5 h-5 text-purple-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 text-success-green" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
      default:
        return <InformationCircleIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePurchase = async (packageId: string) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      alert(`Purchasing package: ${packageId}`);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-navy-blue text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-blue via-navy-blue-light to-brand-color p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <BanknotesIcon className="w-8 h-8 text-brand-color" />
            <h1 className="text-4xl font-bold text-white">Intelligence Tokens</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl">
            Manage your intelligence tokens and purchase additional credits for enhanced operations
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Current Balance Card */}
        <div className="enhanced-card p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-color rounded-full flex items-center justify-center mx-auto mb-4">
                <BanknotesIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">{currentBalance.toLocaleString()}</h3>
              <p className="text-gray-400">Current Balance</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChartBarIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">{monthlyUsage.toLocaleString()}</h3>
              <p className="text-gray-400">This Month Usage</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-success-green rounded-full flex items-center justify-center mx-auto mb-4">
                <ClockIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">~{Math.floor(currentBalance / 25)}</h3>
              <p className="text-gray-400">Estimated Queries Left</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="enhanced-card p-0 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-brand-color text-white border-b-2 border-brand-color'
                  : 'text-gray-400 hover:text-white hover:bg-navy-blue-light'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('purchase')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 ${
                activeTab === 'purchase'
                  ? 'bg-brand-color text-white border-b-2 border-brand-color'
                  : 'text-gray-400 hover:text-white hover:bg-navy-blue-light'
              }`}
            >
              Purchase Tokens
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-brand-color text-white border-b-2 border-brand-color'
                  : 'text-gray-400 hover:text-white hover:bg-navy-blue-light'
              }`}
            >
              Transaction History
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Usage Breakdown */}
            <div className="enhanced-card p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Token Usage Breakdown</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-navy-blue-light p-4 rounded-lg">
                  <h3 className="font-semibold text-white mb-2">Property Searches</h3>
                  <div className="text-2xl font-bold text-brand-color">180</div>
                  <div className="text-sm text-gray-400">25 tokens each</div>
                </div>
                <div className="bg-navy-blue-light p-4 rounded-lg">
                  <h3 className="font-semibold text-white mb-2">Lead Analysis</h3>
                  <div className="text-2xl font-bold text-orange-500">85</div>
                  <div className="text-sm text-gray-400">50 tokens each</div>
                </div>
                <div className="bg-navy-blue-light p-4 rounded-lg">
                  <h3 className="font-semibold text-white mb-2">Market Research</h3>
                  <div className="text-2xl font-bold text-purple-500">45</div>
                  <div className="text-sm text-gray-400">75 tokens each</div>
                </div>
                <div className="bg-navy-blue-light p-4 rounded-lg">
                  <h3 className="font-semibold text-white mb-2">Advanced Reports</h3>
                  <div className="text-2xl font-bold text-success-green">12</div>
                  <div className="text-sm text-gray-400">100 tokens each</div>
                </div>
              </div>
            </div>

            {/* Token Rate Guide */}
            <div className="enhanced-card p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Token Rate Guide</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-navy-blue-light rounded-lg">
                  <span className="text-white">Basic Property Lookup</span>
                  <span className="status-badge bg-brand-color/20 text-brand-color">25 tokens</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-navy-blue-light rounded-lg">
                  <span className="text-white">Advanced Lead Analysis</span>
                  <span className="status-badge bg-orange-500/20 text-orange-500">50 tokens</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-navy-blue-light rounded-lg">
                  <span className="text-white">Market Intelligence Report</span>
                  <span className="status-badge bg-purple-500/20 text-purple-500">75 tokens</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-navy-blue-light rounded-lg">
                  <span className="text-white">Comprehensive Analysis</span>
                  <span className="status-badge bg-success-green/20 text-success-green">100 tokens</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Tab */}
        {activeTab === 'purchase' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tokenPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`enhanced-card p-6 relative ${
                  pkg.popular ? 'ring-2 ring-brand-color' : ''
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-brand-color text-white px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{pkg.description}</p>
                  
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-brand-color">
                      {pkg.tokens === -1 ? '∞' : pkg.tokens.toLocaleString()}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {pkg.tokens === -1 ? 'Unlimited Tokens' : 'Intelligence Tokens'}
                    </div>
                  </div>
                  
                  <div className="text-2xl font-bold text-white mb-2">
                    ${pkg.price}
                  </div>
                  
                  {pkg.savings > 0 && (
                    <div className="text-success-green text-sm">
                      Save {pkg.savings}%
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={loading}
                  className={`w-full btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCardIcon className="w-4 h-4 mr-2" />
                  )}
                  Purchase Now
                </button>
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="enhanced-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-blue-light border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-navy-blue-light transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          <span className="capitalize text-white font-medium">
                            {transaction.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${
                          transaction.amount > 0 ? 'text-success-green' : 'text-brand-color'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {transaction.description}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transaction.status)}
                          <span className={`capitalize text-sm ${
                            transaction.status === 'completed' ? 'text-success-green' :
                            transaction.status === 'pending' ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {transaction.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Token;