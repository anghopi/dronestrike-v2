import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useMutation } from '@tanstack/react-query';
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

const TOKEN_PACKAGES = {
  starter: {
    name: "Starter Package",
    regular_tokens: 1000,
    mail_tokens: 0,
    price: 50.00,
    description: "Perfect for getting started"
  },
  professional: {
    name: "Professional Package",
    regular_tokens: 5000,
    mail_tokens: 100,
    price: 200.00,
    description: "Best value for professionals"
  },
  enterprise: {
    name: "Enterprise Package",
    regular_tokens: 15000,
    mail_tokens: 500,
    price: 500.00,
    description: "For high-volume users"
  },
  mail_special: {
    name: "Mail Token Special",
    regular_tokens: 0,
    mail_tokens: 1000,
    price: 800.00,
    description: "Specialized mail tokens ($0.80 each)"
  }
};

const TokenPurchaseModal: React.FC<TokenPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedPackage, setSelectedPackage] = useState<string>('professional');
  const [quantity, setQuantity] = useState(1);
  const [discountCode, setDiscountCode] = useState('');
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [step, setStep] = useState<'select' | 'payment' | 'processing' | 'success'>('select');
  const [error, setError] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  const package_data = TOKEN_PACKAGES[selectedPackage as keyof typeof TOKEN_PACKAGES];
  const totalAmount = package_data.price * quantity;

  // Purchase tokens mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ package_type, quantity, payment_method_id, save_payment_method }: any) => {
      const response = await fetch('/api/payments/tokens/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          package_type,
          quantity,
          payment_method_id,
          save_payment_method
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Purchase failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 'succeeded') {
        setStep('success');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        // Payment requires confirmation
        handlePaymentConfirmation(data);
      }
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
    
    if (!stripe || !elements) return;

    setError(null);
    setStep('processing');

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      setStep('payment');
      return;
    }

    try {
      // Create payment method
      const { error: methodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement
      });

      if (methodError) {
        setError(methodError.message || 'Failed to create payment method');
        setStep('payment');
        return;
      }

      // Process purchase
      purchaseMutation.mutate({
        package_type: selectedPackage,
        quantity,
        payment_method_id: paymentMethod?.id,
        save_payment_method: savePaymentMethod
      });

    } catch (err: any) {
      setError(err.message);
      setStep('payment');
    }
  };

  const handleClose = () => {
    setStep('select');
    setError(null);
    setSelectedPackage('professional');
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(TOKEN_PACKAGES).map(([key, pkg]) => (
                    <div
                      key={key}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedPackage === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPackage(key)}
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
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>{package_data.name} x{quantity}</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Regular Tokens</span>
                    <span>{(package_data.regular_tokens * quantity).toLocaleString()}</span>
                  </div>
                  {package_data.mail_tokens > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Mail Tokens</span>
                      <span>{(package_data.mail_tokens * quantity).toLocaleString()}</span>
                    </div>
                  )}
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

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

          {step === 'payment' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
                
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

                <div className="border rounded-lg p-4">
                  <CardElement
                    options={{
                      style: {
                        base: {
                          fontSize: '16px',
                          color: '#424770',
                          '::placeholder': {
                            color: '#aab7c4',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="save-payment"
                  type="checkbox"
                  checked={savePaymentMethod}
                  onChange={(e) => setSavePaymentMethod(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="save-payment" className="ml-2 text-sm text-gray-700">
                  Save payment method for future purchases
                </label>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setStep('select')}>
                  Back
                </Button>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total: ${totalAmount.toFixed(2)}</p>
                  <Button type="submit" disabled={!stripe}>
                    <CreditCardIcon className="h-4 w-4 mr-2" />
                    Purchase Tokens
                  </Button>
                </div>
              </div>
            </form>
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