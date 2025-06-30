import React, { useState, useEffect } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  XMarkIcon,
  CreditCardIcon,
  CurrencyDollarIcon as CoinsIcon,
  EnvelopeIcon as MailIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import stripeService from '../../services/stripeService';

interface TokenPackage {
  name: string;
  regular_tokens: number;
  mail_tokens: number;
  price: number;
  description: string;
}

interface TokenPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Token packages will be loaded from API

const TokenPurchaseModal: React.FC<TokenPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [discountCode, setDiscountCode] = useState('');
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [step, setStep] = useState<'select' | 'payment' | 'processing' | 'success'>('select');
  const [error, setError] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  // Load token packages from API
  const { data: packagesData, isLoading: packagesLoading, error: packagesError } = useQuery({
    queryKey: ['token-packages'],
    queryFn: stripeService.getTokenPackages,
    enabled: isOpen
  });

  // Load user token balance
  const { data: balanceData, refetch: refetchBalance } = useQuery({
    queryKey: ['token-balance'],
    queryFn: stripeService.getTokenBalance,
    enabled: isOpen
  });

  // Set default selected package when data loads
  useEffect(() => {
    if (packagesData?.packages && packagesData.packages.length > 0 && !selectedPackage) {
      setSelectedPackage(packagesData.packages[0].name);
    }
  }, [packagesData, selectedPackage]);

  const selectedPackageData = packagesData?.packages?.find(pkg => pkg.name === selectedPackage);
  const totalAmount = selectedPackageData ? selectedPackageData.price * quantity : 0;

  // Purchase tokens mutation using new Stripe service
  const purchaseMutation = useMutation({
    mutationFn: async (packageName: string) => {
      const result = await stripeService.purchaseTokenPackage(packageName);
      if (!result.success) {
        throw new Error(result.error || 'Purchase failed');
      }
      return result;
    },
    onSuccess: () => {
      setStep('success');
      refetchBalance(); // Refresh token balance
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    },
    onError: (error: any) => {
      setError(error.message);
      setStep('payment');
    }
  });

  const handlePaymentConfirmation = async (data: any) => {
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    try {
      const { error } = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: {
          card: cardElement
        }
      });

      if (error) {
        setError(error.message || 'Payment failed');
        setStep('payment');
      } else {
        setStep('success');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
      setStep('payment');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!selectedPackage || !selectedPackageData) {
      setError('Please select a package');
      return;
    }

    setError(null);
    setStep('processing');

    try {
      // Use the Stripe service to handle the purchase
      purchaseMutation.mutate(selectedPackage);
    } catch (err: any) {
      setError(err.message);
      setStep('payment');
    }
  };

  const handleClose = () => {
    setStep('select');
    setError(null);
    setSelectedPackage('');
    setQuantity(1);
    setDiscountCode('');
    setSavePaymentMethod(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Purchase Tokens</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-6">
              {/* Package Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Token Package</h3>
                
                {packagesLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading packages...</span>
                  </div>
                )}

                {packagesError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">Failed to load token packages</p>
                  </div>
                )}

                {packagesData?.packages && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packagesData.packages.map((pkg) => (
                      <div
                        key={pkg.name}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedPackage === pkg.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedPackage(pkg.name)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {pkg.mail_tokens > 0 ? (
                              <MailIcon className="h-6 w-6 text-orange-500" />
                            ) : (
                              <CoinsIcon className="h-6 w-6 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{pkg.name}</h4>
                            <p className="text-sm text-gray-600 mb-2">{pkg.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="text-sm">
                                {pkg.regular_tokens > 0 && (
                                  <span className="text-blue-600">{pkg.regular_tokens.toLocaleString()} regular</span>
                                )}
                                {pkg.regular_tokens > 0 && pkg.mail_tokens > 0 && <span className="text-gray-400"> + </span>}
                                {pkg.mail_tokens > 0 && (
                                  <span className="text-orange-600">{pkg.mail_tokens.toLocaleString()} mail</span>
                                )}
                              </div>
                              <div className="text-lg font-semibold text-gray-900">
                                ${pkg.price.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Current Balance Display */}
                {balanceData && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Current Balance</h4>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-blue-600">
                        <CoinsIcon className="h-4 w-4 inline mr-1" />
                        {balanceData.regular_tokens.toLocaleString()} regular
                      </span>
                      <span className="text-orange-600">
                        <MailIcon className="h-4 w-4 inline mr-1" />
                        {balanceData.mail_tokens.toLocaleString()} mail
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
              </div>

              {/* Discount Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Code (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="Enter discount code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available codes: 5STARGENERAL, INFANTRY, NEWUSER
                </p>
              </div>

              {/* Order Summary */}
              {selectedPackageData && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{selectedPackageData.name} x{quantity}</span>
                      <span>${totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Regular Tokens</span>
                      <span>{(selectedPackageData.regular_tokens * quantity).toLocaleString()}</span>
                    </div>
                    {selectedPackageData.mail_tokens > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Mail Tokens</span>
                        <span>{(selectedPackageData.mail_tokens * quantity).toLocaleString()}</span>
                      </div>
                    )}
                    <hr />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('payment')}>
                  Continue to Payment
                </Button>
              </div>
            </div>
          )}

          {step === 'payment' && selectedPackageData && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Purchase</h3>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Purchase Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-900 mb-2">Purchase Summary</h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <div>Package: {selectedPackageData.name}</div>
                    <div>Quantity: {quantity}</div>
                    <div>Regular Tokens: {(selectedPackageData.regular_tokens * quantity).toLocaleString()}</div>
                    {selectedPackageData.mail_tokens > 0 && (
                      <div>Mail Tokens: {(selectedPackageData.mail_tokens * quantity).toLocaleString()}</div>
                    )}
                    <div className="font-semibold pt-2 border-t border-blue-300">
                      Total: ${totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 space-y-2">
                  <p>• You will be redirected to Stripe's secure checkout</p>
                  <p>• Tokens will be added to your account after payment</p>
                  <p>• Payment is processed securely by Stripe</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setStep('select')}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={purchaseMutation.isPending}>
                  <CreditCardIcon className="h-4 w-4 mr-2" />
                  {purchaseMutation.isPending ? 'Processing...' : 'Continue to Checkout'}
                </Button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Payment</h3>
              <p className="text-gray-600">Please wait while we process your payment...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-gray-600">Your tokens have been added to your account.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenPurchaseModal;