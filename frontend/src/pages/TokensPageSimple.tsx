import React from 'react';
import { BoltIcon, CreditCardIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};

const TokensPageSimple: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="h-full space-y-8">
      {/* Page Header */}
      <div className="page-header text-center">
        <h1 className="page-title">Intelligence Tokens</h1>
        <p className="page-subtitle max-w-3xl mx-auto">
          Fuel your missions with our token system. Power SMS campaigns, 
          skip tracing, and direct mail operations with military precision.
        </p>
      </div>

      {/* Current Balance & Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700 hover:border-yellow-500 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">General Tokens</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatNumber(profile?.tokens || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Operations & SMS</p>
            </div>
            <BoltIcon className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700 hover:border-orange-500 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Mail Tokens</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatNumber(profile?.mail_tokens || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">$0.80 per mail</p>
            </div>
            <CreditCardIcon className="w-10 h-10 text-orange-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-lg p-6 border border-green-600 hover:border-green-400 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-200 text-sm font-medium">Total Value</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${formatNumber((profile?.tokens || 0) * 0.01 + (profile?.mail_tokens || 0) * 0.80)}
              </p>
              <p className="text-xs text-green-300 mt-1">Combined value</p>
            </div>
            <ChartBarIcon className="w-10 h-10 text-green-400" />
          </div>
        </div>
      </div>

      {/* Token Packages */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Strike Packages</h2>
          <p className="text-gray-300">Choose your arsenal for maximum operational efficiency</p>
        </div>

        <div className="dashboard-grid">
          <div className="enhanced-card p-6 relative hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-brand-color">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-color to-brand-color-light rounded-full mb-4">
                <BoltIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Scout Pack</h3>
              <p className="text-gray-300 mb-4">Perfect for reconnaissance missions</p>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">General Tokens:</span>
                  <span className="text-white font-medium">25,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mailer Tokens:</span>
                  <span className="text-white font-medium">10,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Value:</span>
                  <span className="text-white font-medium">35,000</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-brand-color mb-4">$25</div>
              <button className="btn-primary w-full">Purchase Package</button>
            </div>
          </div>

          <div className="enhanced-card p-6 relative hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-olive-green">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-olive-green to-success-green rounded-full mb-4">
                <CreditCardIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tactical Pack</h3>
              <p className="text-gray-300 mb-4">For strategic operations</p>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">General Tokens:</span>
                  <span className="text-white font-medium">50,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mailer Tokens:</span>
                  <span className="text-white font-medium">20,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Value:</span>
                  <span className="text-white font-medium">70,000</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-olive-green mb-4">$45</div>
              <button className="btn-primary w-full">Purchase Package</button>
            </div>
          </div>

          <div className="enhanced-card p-6 relative hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-alert-yellow">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-alert-yellow text-navy-blue-dark px-3 py-1 text-xs font-bold rounded-full">
                POPULAR
              </span>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-alert-yellow to-gold rounded-full mb-4">
                <ChartBarIcon className="w-8 h-8 text-navy-blue-dark" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Strike Pack</h3>
              <p className="text-gray-300 mb-4">For full-scale missions</p>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">General Tokens:</span>
                  <span className="text-white font-medium">100,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mailer Tokens:</span>
                  <span className="text-white font-medium">40,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Value:</span>
                  <span className="text-white font-medium">140,000</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-alert-yellow mb-4">$85</div>
              <button className="btn-primary w-full">Purchase Package</button>
            </div>
          </div>

          <div className="enhanced-card p-6 relative hover:shadow-lg transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-critical-red">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-critical-red to-red-600 rounded-full mb-4">
                <ChartBarIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Arsenal Pack</h3>
              <p className="text-gray-300 mb-4">Maximum firepower package</p>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">General Tokens:</span>
                  <span className="text-white font-medium">250,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mailer Tokens:</span>
                  <span className="text-white font-medium">100,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Value:</span>
                  <span className="text-white font-medium">350,000</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-critical-red mb-4">$200</div>
              <button className="btn-primary w-full">Purchase Package</button>
            </div>
          </div>
        </div>
      </div>

      {/* Token Usage Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="enhanced-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Token Usage Costs</h3>
          <div className="space-y-4">
            {[
              { action: 'SMS Message', cost: 8, icon: '📱' },
              { action: 'Phone Call (per minute)', cost: 100, icon: '📞' },
              { action: 'Email Send', cost: 0, icon: '📧' },
              { action: 'Skip Trace', cost: 800, icon: '🔍' },
              { action: 'Direct Mail', cost: 1, icon: '📮' }
            ].map(item => (
              <div key={item.action} className="flex items-center justify-between p-3 bg-navy-blue-light rounded">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-white">{item.action}</span>
                </div>
                <span className="text-brand-color font-medium">{item.cost} tokens</span>
              </div>
            ))}
          </div>
        </div>

        <div className="enhanced-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {[
              { type: 'Purchase', amount: '+25,000 GT', date: '2 hours ago', color: 'text-olive-green' },
              { type: 'SMS Campaign', amount: '-1,200 GT', date: '5 hours ago', color: 'text-critical-red' },
              { type: 'Mail Tokens', amount: '+5,000 MT', date: '1 day ago', color: 'text-olive-green' },
              { type: 'Skip Trace', amount: '-800 GT', date: '2 days ago', color: 'text-critical-red' }
            ].map((tx, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-navy-blue-light rounded">
                <div>
                  <div className="text-white text-sm font-medium">{tx.type}</div>
                  <div className="text-gray-400 text-xs">{tx.date}</div>
                </div>
                <span className={`font-medium ${tx.color}`}>{tx.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokensPageSimple;