import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
  CreditCard, 
  Coins, 
  Mail, 
  Star, 
  Crown, 
  Shield, 
  Package, 
  History,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { tokenAPI } from '../services/api';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_...');

interface TokenPackage {
  name: string;
  regular_tokens: number;
  mail_tokens: number;
  price: number;
  description: string;
}

interface TokenBalance {
  regular_tokens: number;
  mail_tokens: number;
  profile_tokens: number;
  profile_mail_tokens: number;
}

interface PurchaseHistory {
  purchases: Array<{
    id: number;
    type: string;
    package_name: string;
    regular_tokens: number;
    mail_tokens: number;
    total_price: string;
    payment_status: string;
    created_at: string;
  }>;
  transactions: Array<{
    id: number;
    type: string;
    token_type: string;
    transaction_type: string;
    tokens_changed: number;
    description: string;
    created_at: string;
  }>;
}

const PaymentForm: React.FC<{
  package: TokenPackage;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ package: pkg, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create payment intent
      const response = await tokenAPI.createPurchaseIntent(pkg.name);
      const { client_secret, error: apiError } = response as any;
      
      if (apiError) {
        setError(apiError);
        setLoading(false);
        return;
      }

      // Confirm payment
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError('Card element not found');
        setLoading(false);
        return;
      }

      const { error: stripeError } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement
        }
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    }
    
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-xl shadow-2xl border border-slate-700/50">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">Complete Purchase</h3>
        <p className="text-slate-400">Secure payment powered by Stripe</p>
      </div>
      
      <div className="mb-6 p-6 bg-slate-700/50 rounded-lg border border-slate-600/50">
        <h4 className="text-lg font-semibold text-white mb-4">{pkg.name}</h4>
        <div className="space-y-3">
          {pkg.regular_tokens > 0 && (
            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-2 text-slate-300">
                <Coins size={16} className="text-blue-400" />
                <span>Regular Tokens</span>
              </span>
              <span className="font-semibold text-blue-400">{pkg.regular_tokens.toLocaleString()}</span>
            </div>
          )}
          {pkg.mail_tokens > 0 && (
            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-2 text-slate-300">
                <Mail size={16} className="text-green-400" />
                <span>Mail Tokens</span>
              </span>
              <span className="font-semibold text-green-400">{pkg.mail_tokens.toLocaleString()}</span>
            </div>
          )}
          <div className="pt-3 border-t border-slate-600">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-slate-300">Total Price</span>
              <span className="text-2xl font-bold text-yellow-400">${pkg.price}</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Card Information</label>
          <div className="p-4 border border-slate-600 rounded-lg bg-slate-800/50 focus-within:border-blue-500 transition-colors">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#ffffff',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    '::placeholder': {
                      color: '#94a3b8',
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-600/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <X size={16} className="text-red-400" />
              <span className="text-red-200">{error}</span>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={!stripe || loading}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <CreditCard size={20} />
            )}
            <span className="font-medium">{loading ? 'Processing Payment...' : `Pay $${pkg.price}`}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

const TokensManagement: React.FC = () => {
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
  const [activeTab, setActiveTab] = useState<'buy' | 'history' | 'subscription'>('buy');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load token balance
      const balance = await tokenAPI.getBalance();
      setTokenBalance(balance as TokenBalance);

      // Load token packages
      const packagesData = await tokenAPI.getPackages();
      setPackages((packagesData as any).packages);

      // Load purchase history
      const history = await tokenAPI.getPurchaseHistory();
      setPurchaseHistory(history as PurchaseHistory);

    } catch (error) {
      console.error('Error loading token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSuccess = () => {
    setSelectedPackage(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-gray-100 flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
      {/* Header */}
      <div className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Token Management</h1>
              <p className="text-slate-400 mt-2">Manage your DroneStrike tokens and subscriptions</p>
            </div>
            
            {/* Token Balance Display */}
            {tokenBalance && (
              <div className="flex space-x-8">
                <div className="text-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="flex items-center justify-center space-x-2 text-blue-400 mb-2">
                    <Coins size={24} />
                    <span className="text-sm font-medium text-slate-300">Regular Tokens</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-400">
                    {tokenBalance.regular_tokens.toLocaleString()}
                  </div>
                </div>
                <div className="text-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="flex items-center justify-center space-x-2 text-green-400 mb-2">
                    <Mail size={24} />
                    <span className="text-sm font-medium text-slate-300">Mail Tokens</span>
                  </div>
                  <div className="text-3xl font-bold text-green-400">
                    {tokenBalance.mail_tokens.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('buy')}
              className={`py-6 px-4 border-b-2 font-medium text-sm transition-all duration-200 ${
                activeTab === 'buy'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              } rounded-t-lg`}
            >
              <Package className="inline mr-2" size={18} />
              Buy Tokens
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`py-6 px-4 border-b-2 font-medium text-sm transition-all duration-200 ${
                activeTab === 'subscription'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              } rounded-t-lg`}
            >
              <Crown className="inline mr-2" size={18} />
              Subscription
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-6 px-4 border-b-2 font-medium text-sm transition-all duration-200 ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              } rounded-t-lg`}
            >
              <History className="inline mr-2" size={18} />
              Purchase History
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Buy Tokens Tab */}
        {activeTab === 'buy' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-3">Token Packages</h2>
              <p className="text-slate-400 text-lg">
                Choose from our token packages below. Regular tokens cost $0.001 each, Mail tokens cost $0.80 each.
              </p>
              
              {/* Token Usage Guide */}
              <div className="mt-6 p-6 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Token Usage Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 bg-slate-700/30 rounded">
                    <div className="font-medium text-blue-400 mb-1">SMS Texts</div>
                    <div className="text-slate-300">8 regular tokens</div>
                    <div className="text-slate-400 text-xs">$0.008 per text</div>
                  </div>
                  <div className="p-3 bg-slate-700/30 rounded">
                    <div className="font-medium text-green-400 mb-1">Phone Minutes</div>
                    <div className="text-slate-300">100 regular tokens</div>
                    <div className="text-slate-400 text-xs">$0.10 per minute</div>
                  </div>
                  <div className="p-3 bg-slate-700/30 rounded">
                    <div className="font-medium text-yellow-400 mb-1">Skip Trace</div>
                    <div className="text-slate-300">800 regular tokens</div>
                    <div className="text-slate-400 text-xs">$0.80 per lookup</div>
                  </div>
                  <div className="p-3 bg-slate-700/30 rounded">
                    <div className="font-medium text-purple-400 mb-1">Mail Out</div>
                    <div className="text-slate-300">1 regular + 1 mail token</div>
                    <div className="text-slate-400 text-xs">$0.80 per mail piece</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {packages.map((pkg, index) => (
                <div key={index} className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-8 hover:border-slate-600/50 transition-all duration-300 shadow-xl hover:shadow-2xl">
                  <div className="text-center mb-6">
                    <div className="mb-4">
                      <Package size={32} className="mx-auto text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{pkg.name}</h3>
                    <div className="text-4xl font-bold text-blue-400 mb-3">
                      ${pkg.price}
                    </div>
                    <p className="text-slate-400">{pkg.description}</p>
                  </div>

                  <div className="space-y-4 mb-8">
                    {pkg.regular_tokens > 0 && (
                      <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
                        <span className="flex items-center space-x-2 text-slate-300">
                          <Coins size={18} className="text-blue-400" />
                          <span>Regular Tokens</span>
                        </span>
                        <span className="font-bold text-blue-400">{pkg.regular_tokens.toLocaleString()}</span>
                      </div>
                    )}
                    {pkg.mail_tokens > 0 && (
                      <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
                        <span className="flex items-center space-x-2 text-slate-300">
                          <Mail size={18} className="text-green-400" />
                          <span>Mail Tokens</span>
                        </span>
                        <span className="font-bold text-green-400">{pkg.mail_tokens.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedPackage(pkg)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Purchase Package
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-3">DroneStrike Professional</h2>
              <p className="text-slate-400 text-lg">
                Get unlimited access to the DroneStrike platform with our professional subscription.
              </p>
            </div>

            <div className="max-w-lg mx-auto">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-8 text-center shadow-2xl">
                <Crown className="mx-auto mb-6 text-yellow-400" size={56} />
                <h3 className="text-3xl font-bold text-white mb-4">Professional Plan</h3>
                <div className="text-5xl font-bold text-blue-400 mb-2">
                  $799<span className="text-xl text-slate-400">/month</span>
                </div>
                <p className="text-slate-400 mb-8">Everything you need to dominate the market</p>
                
                <div className="space-y-4 mb-8 text-left">
                  <div className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                    <Check size={20} className="text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">Unlimited lead management</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                    <Check size={20} className="text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">BOTG mission coordination</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                    <Check size={20} className="text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">TLC loan origination integration</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                    <Check size={20} className="text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">Advanced analytics and reporting</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                    <Check size={20} className="text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">Priority support</span>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Discount Code</label>
                  <input
                    type="text"
                    placeholder="5STARGENERAL, INFANTRY"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <button className="w-full px-6 py-4 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white font-bold rounded-lg hover:from-yellow-700 hover:to-yellow-800 transition-all duration-200 shadow-lg hover:shadow-xl text-lg">
                  Subscribe Now
                </button>

                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-center space-x-2 text-yellow-400">
                      <Star size={16} className="fill-current" />
                      <span className="font-medium">5 Star Generals: 50% off for life</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2 text-blue-400">
                      <Shield size={16} />
                      <span className="font-medium">Infantry: 50% off first 3 months</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Purchase History Tab */}
        {activeTab === 'history' && purchaseHistory && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-3">Purchase History</h2>
              <p className="text-slate-400 text-lg">
                View your token purchases and usage history.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Purchases */}
              <div>
                <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <CreditCard size={20} className="text-blue-400" />
                  <span>Recent Purchases</span>
                </h3>
                <div className="space-y-4">
                  {purchaseHistory.purchases.map((purchase) => (
                    <div key={purchase.id} className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-all duration-200">
                      <div className="flex justify-between items-start mb-4">
                        <span className="font-bold text-white text-lg">{purchase.package_name}</span>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          purchase.payment_status === 'succeeded' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {purchase.payment_status}
                        </span>
                      </div>
                      <div className="space-y-2 text-slate-300">
                        <div className="flex justify-between">
                          <span>Regular Tokens:</span>
                          <span className="font-semibold text-blue-400">{purchase.regular_tokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mail Tokens:</span>
                          <span className="font-semibold text-green-400">{purchase.mail_tokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-700 pt-2">
                          <span>Total:</span>
                          <span className="font-bold text-yellow-400">${purchase.total_price}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span className="font-medium">{new Date(purchase.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transactions */}
              <div>
                <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <History size={20} className="text-green-400" />
                  <span>Token Usage</span>
                </h3>
                <div className="space-y-4">
                  {purchaseHistory.transactions.slice(0, 10).map((transaction) => (
                    <div key={transaction.id} className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-all duration-200">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-white capitalize">
                          {transaction.transaction_type} - {transaction.token_type}
                        </span>
                        <span className={`font-bold text-lg ${
                          transaction.tokens_changed > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {transaction.tokens_changed > 0 ? '+' : ''}{transaction.tokens_changed}
                        </span>
                      </div>
                      <div className="space-y-2 text-slate-400">
                        <div className="text-slate-300">{transaction.description}</div>
                        <div className="text-sm">Date: {new Date(transaction.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="max-w-lg w-full">
            <Elements stripe={stripePromise}>
              <PaymentForm
                package={selectedPackage}
                onSuccess={handlePurchaseSuccess}
                onCancel={() => setSelectedPackage(null)}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokensManagement;